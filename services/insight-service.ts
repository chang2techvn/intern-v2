import pool from '../db/database';
import { Insight, AuditLog } from '../shared/models';
import { AuthData } from "../auth/index";
import { publishSNSEvent, InsightEventType, InsightEventPayload } from '../events/sns-topics';

/**
 * Sets up the PostgreSQL session with the workspace_id for Row Level Security
 */
async function setupRLS(client: any, workspaceId: string | number): Promise<void> {
    try {
        // Set the app.workspace_id value for the current session
        // This is used by RLS policies to filter data by workspace
        // Using string concatenation instead of parameterized query because
        // PostgreSQL doesn't support parameters for SET commands
        await client.query(`SET LOCAL app.workspace_id = '${workspaceId.toString()}'`);
    } catch (error) {
        console.error('Error setting up RLS:', error);
        throw error;
    }
}

/**
 * Logs actions to the audit_log table
 */
async function logAuditAction(
    entityType: string,
    entityId: number | null,
    action: string,
    userId: string,
    workspaceId: string,
    details: Record<string, any> = {}
): Promise<void> {
    try {
        const client = await pool.connect();
        try {
            // Set up RLS before executing queries
            await setupRLS(client, workspaceId);
            
            await client.query(
                'INSERT INTO audit_log (entity_type, entity_id, action, user_id, workspace_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
                [entityType, entityId, action, userId, parseInt(workspaceId), JSON.stringify(details)]
            );
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error logging audit action:', error);
        // We don't throw here to prevent audit logging from breaking the main functionality
    }
}

/**
 * Get all insights for the workspace
 */
export async function listInsights(
    authData: AuthData,
    limit: number = 20,
    offset: number = 0,
    category?: number,
    status: number | string = 'active'  // Changed default from 1 to 'active'
): Promise<{insights: Insight[], total: number, error?: string}> {
    try {
        const client = await pool.connect();
        try {
            const workspaceId = parseInt(authData.workspaceID);
            
            // Set up RLS with workspace ID
            await setupRLS(client, workspaceId);
            
            // Build the query with optional filters
            let query = 'SELECT * FROM insights WHERE workspace_id = $1';
            let countQuery = 'SELECT COUNT(*) FROM insights WHERE workspace_id = $1';
            const params: any[] = [workspaceId]; // Change to any[] to allow both string and number values
            
            if (category !== undefined) {
                query += ' AND category = $' + (params.length + 1);
                countQuery += ' AND category = $' + (params.length + 1);
                params.push(category);
            }
            
            if (status !== undefined) {
                query += ' AND status = $' + (params.length + 1);
                countQuery += ' AND status = $' + (params.length + 1);
                params.push(status);
            }
            
            query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
            params.push(limit, offset);
            
            console.log("Query:", query);
            console.log("Parameters:", params);
            
            // Get insights
            const result = await client.query(query, params);
            console.log("Query result:", result.rows.length, "rows found");
            
            // Get total count for pagination
            const countResult = await client.query(countQuery, params.slice(0, -2));
            const total = parseInt(countResult.rows[0].count);
            
            // Log this action
            await logAuditAction(
                'insight',
                null,
                'list',
                authData.userID,
                authData.workspaceID,
                { category, status, limit, offset }
            );
            
            return {
                insights: result.rows,
                total
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching insights:', error);
        return {
            insights: [],
            total: 0,
            error: `Error: ${(error as Error).message}`
        };
    }
}

/**
 * Get a single insight by ID
 */
export async function getInsightById(
    insightId: string, 
    authData: AuthData
): Promise<{insight: Insight | null, error?: string}> {
    try {
        if (!insightId) {
            return {
                insight: null,
                error: "Insight ID is required"
            };
        }

        const client = await pool.connect();
        try {
            const workspaceId = parseInt(authData.workspaceID);
            
            // Set up RLS with workspace ID
            await setupRLS(client, workspaceId);
            
            const result = await client.query(
                'SELECT * FROM insights WHERE id = $1 AND workspace_id = $2',
                [insightId, workspaceId]
            );
            
            if (result.rows.length === 0) {
                return {
                    insight: null,
                    error: "Insight not found"
                };
            }
            
            // Log this action
            await logAuditAction(
                'insight',
                parseInt(insightId),
                'view',
                authData.userID,
                authData.workspaceID
            );
            
            return {
                insight: result.rows[0]
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching insight:', error);
        return {
            insight: null,
            error: `Error: ${(error as Error).message}`
        };
    }
}

/**
 * Create a new insight
 */
export async function createInsight(
    title: string,
    content: string,
    authData: AuthData,
    category?: string,
    source?: string,
    relevance?: number,
    metadata?: Record<string, any>
): Promise<{insight: Insight | null, error?: string}> {
    try {
        if (!title || !content) {
            return {
                insight: null,
                error: "Title and content are required"
            };
        }

        const workspaceId = parseInt(authData.workspaceID);
        const userId = authData.userID;
        
        const client = await pool.connect();
        try {
            // Set up RLS with workspace ID
            await setupRLS(client, workspaceId);
            
            const result = await client.query(
                `INSERT INTO insights 
                (title, content, category, source, relevance, status, metadata, created_by, workspace_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *`,
                [title, content, category || null, source || null, relevance || null, 'active', 
                 JSON.stringify(metadata || {}), userId, workspaceId]
            );
            
            const newInsight = result.rows[0];
            
            // Log this action
            await logAuditAction(
                'insight',
                newInsight.id,
                'create',
                authData.userID,
                authData.workspaceID,
                { title, category, source }
            );
            
            // Publish SNS event for Insight.New
            try {
                const eventPayload: InsightEventPayload = {
                    eventType: InsightEventType.NEW,
                    timestamp: new Date().toISOString(),
                    insight: {
                        id: newInsight.id,
                        title: newInsight.title,
                        category: newInsight.category,
                        workspace_id: workspaceId,
                        created_by: userId
                    },
                    metadata: {
                        userID: authData.userID,
                        workspaceID: authData.workspaceID
                    }
                };
                await publishSNSEvent(InsightEventType.NEW, eventPayload);
            } catch (snsError) {
                console.error('Error publishing Insight.New event:', snsError);
                // Continue even if SNS publishing fails
            }
            
            return {
                insight: newInsight
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating insight:', error);
        return {
            insight: null,
            error: `Error: ${(error as Error).message}`
        };
    }
}

/**
 * Update an existing insight
 */
export async function updateInsight(
    id: string,
    authData: AuthData,
    updates: {
        title?: string,
        content?: string,
        category?: string,
        source?: string,
        relevance?: number,
        status?: string,
        metadata?: Record<string, any>
    }
): Promise<{insight: Insight | null, error?: string}> {
    try {
        if (!id) {
            return {
                insight: null,
                error: "Insight ID is required"
            };
        }

        const client = await pool.connect();
        try {
            const workspaceId = parseInt(authData.workspaceID);
            
            // Set up RLS with workspace ID
            await setupRLS(client, workspaceId);
            
            // Check if insight exists
            const checkResult = await client.query(
                'SELECT * FROM insights WHERE id = $1 AND workspace_id = $2',
                [id, workspaceId]
            );
            
            if (checkResult.rows.length === 0) {
                return {
                    insight: null,
                    error: "Insight not found"
                };
            }
            
            const currentInsight = checkResult.rows[0];
            
            // Build the update query dynamically
            const updates_clean: Record<string, any> = {};
            for (const [key, value] of Object.entries(updates)) {
                if (value !== undefined) {
                    updates_clean[key] = value;
                }
            }
            
            // If no updates provided, return the current insight
            if (Object.keys(updates_clean).length === 0) {
                return { insight: currentInsight };
            }
            
            // Create the SET part of the SQL query
            const setClauses = [];
            const values = [];
            let paramCounter = 1;
            
            for (const [key, value] of Object.entries(updates_clean)) {
                setClauses.push(`${key} = $${paramCounter}`);
                values.push(key === 'metadata' ? JSON.stringify(value) : value);
                paramCounter++;
            }
            
            // Add where clause parameters
            values.push(id, workspaceId);
            
            const updateQuery = `
                UPDATE insights 
                SET ${setClauses.join(', ')}, updated_at = NOW()
                WHERE id = $${paramCounter} AND workspace_id = $${paramCounter + 1}
                RETURNING *
            `;
            
            const result = await client.query(updateQuery, values);
            
            // Log this action
            await logAuditAction(
                'insight',
                parseInt(id),
                'update',
                authData.userID,
                authData.workspaceID,
                updates_clean
            );
            
            return {
                insight: result.rows[0]
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating insight:', error);
        return {
            insight: null,
            error: `Error: ${(error as Error).message}`
        };
    }
}

/**
 * Delete an insight
 */
export async function deleteInsight(
    id: string,
    authData: AuthData
): Promise<{success: boolean, message: string, error?: string}> {
    try {
        if (!id) {
            return {
                success: false,
                message: "Failed to delete insight",
                error: "Insight ID is required"
            };
        }

        const client = await pool.connect();
        try {
            const workspaceId = parseInt(authData.workspaceID);
            
            // Set up RLS with workspace ID
            await setupRLS(client, workspaceId);
            
            // Check if insight exists
            const checkResult = await client.query(
                'SELECT * FROM insights WHERE id = $1 AND workspace_id = $2',
                [id, workspaceId]
            );
            
            if (checkResult.rows.length === 0) {
                return {
                    success: false,
                    message: "Failed to delete insight",
                    error: "Insight not found"
                };
            }
            
            // Delete the insight
            await client.query(
                'DELETE FROM insights WHERE id = $1 AND workspace_id = $2',
                [id, workspaceId]
            );
            
            // Log this action
            await logAuditAction(
                'insight',
                parseInt(id),
                'delete',
                authData.userID,
                authData.workspaceID
            );
            
            return {
                success: true,
                message: "Insight deleted successfully"
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error deleting insight:', error);
        return {
            success: false,
            message: "Failed to delete insight",
            error: `Error: ${(error as Error).message}`
        };
    }
}
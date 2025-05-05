import pool from '../db/database';
import { AuthData } from "../auth/index";
import { logAccessAttempt } from './admin-service';

// Định nghĩa interface Application trực tiếp trong file
interface Application {
    id: number;
    lead_id: number;
    plan_id?: number;
    status: string;
    submitted_date: Date;
    decision_date?: Date;
    workspace_id: number;
    created_at: Date;
    updated_at: Date;
}

/**
 * Lấy danh sách applications theo workspace
 */
export async function getApplications(
    authData: AuthData,
    page: number = 1,
    limit: number = 10
): Promise<{ applications: Application[], error?: string }> {
    try {
        // Fix for page and limit parameters
        // Convert to integers and ensure they have reasonable default values
        const validPage = Math.max(1, Math.floor(Number(page) || 1));
        const validLimit = Math.max(1, Math.floor(Number(limit) || 10));
        
        console.log(`Using validated parameters - page: ${validPage}, limit: ${validLimit}`);
        
        // Check if admin access
        const isAdminAccess = authData.workspaceID === '207732' || 
                              authData.scopes.includes('admin:access');
        
        const offset = (validPage - 1) * validLimit;
        const client = await pool.connect();
        
        try {
            let result;
            
            if (isAdminAccess) {
                // Admin can view all data
                result = await client.query(
                    'SELECT * FROM application ORDER BY created_at DESC LIMIT $1 OFFSET $2', 
                    [validLimit, offset]
                );
                
                logAccessAttempt(
                    "/applications",
                    "list all applications (admin)",
                    true,
                    authData.userID,
                    "all",
                    `Retrieved ${result.rows.length} applications`,
                    "application"
                );
            } else {
                // Regular users can only see their workspace data
                const workspaceId = authData.workspaceID;
                result = await client.query(
                    'SELECT * FROM application WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', 
                    [workspaceId, validLimit, offset]
                );
                
                logAccessAttempt(
                    "/applications",
                    "list applications",
                    true,
                    authData.userID,
                    workspaceId,
                    `Retrieved ${result.rows.length} applications`,
                    "application"
                );
            }
            
            // Return results with explicit check for empty array
            if (!result.rows || result.rows.length === 0) {
                console.log(`No applications found for workspace ID: ${authData.workspaceID}`);
            }
            
            return {
                applications: result.rows || []
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching applications:', error);
        
        logAccessAttempt(
            "/applications",
            "list applications",
            false,
            authData?.userID || "unknown",
            authData?.workspaceID || "unknown",
            `Error: ${(error as Error).message}`,
            "application"
        );
        
        return {
            applications: [],
            error: `Error: ${(error as Error).message}`
        };
    }
}

/**
 * Tạo application mới
 */
export async function createNewApplication(
    authData: AuthData,
    applicationData: {
        lead_id: number;
        plan_id?: number;
        status?: string;
    }
): Promise<{ application: Application | null, error?: string }> {
    try {
        if (!applicationData.lead_id) {
            logAccessAttempt(
                "/applications/create",
                "create application",
                false,
                authData.userID,
                authData.workspaceID,
                "Missing required field: lead_id",
                "application"
            );
            
            return {
                application: null,
                error: "Lead ID is required"
            };
        }

        // Get workspace ID from JWT token
        const workspaceId = parseInt(authData.workspaceID);
        
        const client = await pool.connect();
        try {
            // Verify that the lead exists and belongs to this workspace
            const leadCheck = await client.query(
                'SELECT id FROM lead WHERE id = $1 AND workspace_id = $2',
                [applicationData.lead_id, workspaceId]
            );
            
            if (leadCheck.rows.length === 0) {
                logAccessAttempt(
                    "/applications/create",
                    "create application",
                    false,
                    authData.userID,
                    authData.workspaceID,
                    `Lead not found or does not belong to workspace: ${applicationData.lead_id}`,
                    "application"
                );
                
                return {
                    application: null,
                    error: "Lead not found or does not belong to this workspace"
                };
            }
            
            // Verify plan_id if provided
            if (applicationData.plan_id) {
                const planCheck = await client.query(
                    'SELECT id FROM plan WHERE id = $1 AND workspace_id = $2',
                    [applicationData.plan_id, workspaceId]
                );
                
                if (planCheck.rows.length === 0) {
                    logAccessAttempt(
                        "/applications/create",
                        "create application",
                        false,
                        authData.userID,
                        authData.workspaceID,
                        `Plan not found or does not belong to workspace: ${applicationData.plan_id}`,
                        "application"
                    );
                    
                    return {
                        application: null,
                        error: "Plan not found or does not belong to this workspace"
                    };
                }
            }
            
            // Use default status if not provided
            const status = applicationData.status || 'pending';
            const submittedDate = new Date();
            
            // Execute the query with parameter binding
            const result = await client.query(
                'INSERT INTO application (lead_id, plan_id, status, submitted_date, workspace_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [applicationData.lead_id, applicationData.plan_id, status, submittedDate, workspaceId]
            );
            
            logAccessAttempt(
                "/applications/create",
                "create application",
                true,
                authData.userID,
                authData.workspaceID,
                `Created application: ${result.rows[0].id} for lead: ${applicationData.lead_id}`,
                "application"
            );
            
            return {
                application: result.rows[0]
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating application:', error);
        
        logAccessAttempt(
            "/applications/create",
            "create application",
            false,
            authData.userID,
            authData.workspaceID,
            `Error: ${(error as Error).message}`,
            "application"
        );
        
        return {
            application: null,
            error: `Error: ${(error as Error).message}`
        };
    }
}
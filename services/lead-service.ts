import pool from '../db/database';
import { AuthData } from "../auth/index";
import { logAccessAttempt } from './admin-service';
import { LeadEvents, LeadEventType, LeadEventPayload } from '../events/sns-topics';

// Định nghĩa interface Lead trực tiếp trong file
interface Lead {
    id: number;
    name: string;
    email: string;
    phone?: string;
    status: string;
    source?: string;
    notes?: string;
    workspace_id: number;
    created_at: Date;
    updated_at: Date;
}

/**
 * Lấy danh sách leads theo workspace
 */
export async function getLeads(
    authData: AuthData,
    page: number = 1,
    limit: number = 10
): Promise<{ leads: Lead[], error?: string }> {
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
                    'SELECT * FROM lead ORDER BY created_at DESC LIMIT $1 OFFSET $2', 
                    [validLimit, offset]
                );
                
                logAccessAttempt(
                    "/leads",
                    "list all leads (admin)",
                    true,
                    authData.userID,
                    "all",
                    `Retrieved ${result.rows.length} leads`,
                    "lead"
                );
            } else {
                // Regular users can only see their workspace data
                const workspaceId = authData.workspaceID;
                result = await client.query(
                    'SELECT * FROM lead WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', 
                    [workspaceId, validLimit, offset]
                );
                
                logAccessAttempt(
                    "/leads",
                    "list leads",
                    true,
                    authData.userID,
                    workspaceId,
                    `Retrieved ${result.rows.length} leads`,
                    "lead"
                );
            }
            
            // Return results with explicit check for empty array
            if (!result.rows || result.rows.length === 0) {
                console.log(`No leads found for workspace ID: ${authData.workspaceID}`);
            }
            
            return {
                leads: result.rows || []
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching leads:', error);
        
        logAccessAttempt(
            "/leads",
            "list leads",
            false,
            authData?.userID || "unknown",
            authData?.workspaceID || "unknown",
            `Error: ${(error as Error).message}`,
            "lead"
        );
        
        return {
            leads: [],
            error: `Error: ${(error as Error).message}`
        };
    }
}

/**
 * Tạo lead mới
 */
export async function createNewLead(
    authData: AuthData,
    leadData: {
        name: string;
        email: string;
        phone?: string;
        status?: string;
        source?: string;
        notes?: string;
    }
): Promise<{ lead: Lead | null, error?: string }> {
    try {
        if (!leadData.name || !leadData.email) {
            logAccessAttempt(
                "/leads/create",
                "create lead",
                false,
                authData.userID,
                authData.workspaceID,
                "Missing required fields: name or email",
                "lead"
            );
            
            return {
                lead: null,
                error: "Name and email are required"
            };
        }

        // Get workspace ID from JWT token
        const workspaceId = parseInt(authData.workspaceID);
        
        const client = await pool.connect();
        try {
            // Use default status if not provided
            const status = leadData.status || 'new';
            
            // Execute query with parameter binding
            const result = await client.query(
                'INSERT INTO lead (name, email, phone, status, source, notes, workspace_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [leadData.name, leadData.email, leadData.phone, status, leadData.source, leadData.notes, workspaceId]
            );
            
            const newLead = result.rows[0];
            
            // Publish Lead.New event to SNS topic
            try {
                const event: LeadEventPayload = {
                    eventType: LeadEventType.NEW,
                    timestamp: new Date().toISOString(),
                    lead: {
                        id: newLead.id,
                        name: newLead.name,
                        email: newLead.email,
                        phone: newLead.phone,
                        status: newLead.status,
                        source: newLead.source,
                        workspace_id: newLead.workspace_id
                    },
                    metadata: {
                        userID: authData.userID,
                        workspaceID: authData.workspaceID
                    }
                };
                
                console.log(`Publishing Lead.New event for lead ${newLead.id}`);
                await LeadEvents.publish(event);
                console.log(`Successfully published Lead.New event for lead ${newLead.id}`);
            } catch (eventError) {
                console.error("Error publishing lead event:", eventError);
            }
            
            logAccessAttempt(
                "/leads/create",
                "create lead",
                true,
                authData.userID,
                authData.workspaceID,
                `Created lead: ${newLead.id} - ${leadData.name}`,
                "lead"
            );
            
            return {
                lead: newLead
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating lead:', error);
        
        logAccessAttempt(
            "/leads/create",
            "create lead",
            false,
            authData.userID,
            authData.workspaceID,
            `Error: ${(error as Error).message}`,
            "lead"
        );
        
        return {
            lead: null,
            error: `Error: ${(error as Error).message}`
        };
    }
}
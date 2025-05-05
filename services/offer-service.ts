import pool from '../db/database';
import { AuthData } from "../auth/index";
import { logAccessAttempt } from './admin-service';
import { trackQuote } from './quote-analytics-service';

// Định nghĩa interface Offer trực tiếp trong file
interface Offer {
    id: number;
    application_id: number;
    terms: string;           // Sửa để phù hợp với database
    amount: number;
    interest_rate: number;   
    duration_months: number;  // Đổi từ term_months
    status: string;
    expiration_date?: Date;   // Đổi từ expire_date
    workspace_id: number;
    created_at: Date;
    updated_at: Date;
}

/**
 * Lấy danh sách offers theo workspace
 */
export async function getOffers(
    authData: AuthData,
    page: number = 1,
    limit: number = 10
): Promise<{ offers: Offer[], error?: string }> {
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
                    'SELECT * FROM offer ORDER BY created_at DESC LIMIT $1 OFFSET $2', 
                    [validLimit, offset]
                );
                
                logAccessAttempt(
                    "/offers",
                    "list all offers (admin)",
                    true,
                    authData.userID,
                    "all",
                    `Retrieved ${result.rows.length} offers`,
                    "offer"
                );
            } else {
                // Regular users can only see their workspace data
                const workspaceId = authData.workspaceID;
                result = await client.query(
                    'SELECT * FROM offer WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', 
                    [workspaceId, validLimit, offset]
                );
                
                logAccessAttempt(
                    "/offers",
                    "list offers",
                    true,
                    authData.userID,
                    workspaceId,
                    `Retrieved ${result.rows.length} offers`,
                    "offer"
                );
            }
            
            // Return results with explicit check for empty array
            if (!result.rows || result.rows.length === 0) {
                console.log(`No offers found for workspace ID: ${authData.workspaceID}`);
            }
            
            return {
                offers: result.rows || []
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching offers:', error);
        
        logAccessAttempt(
            "/offers",
            "list offers",
            false,
            authData?.userID || "unknown",
            authData?.workspaceID || "unknown",
            `Error: ${(error as Error).message}`,
            "offer"
        );
        
        return {
            offers: [],
            error: `Error: ${(error as Error).message}`
        };
    }
}

/**
 * Tạo offer mới
 */
export async function createNewOffer(
    authData: AuthData,
    offerData: {
        application_id: number;
        duration_months: number; // Đổi từ term_months
        amount: number;
        interest_rate: number;
        terms?: string;         // Thêm trường terms
        status?: string;
        expiration_date?: Date; // Đổi từ expire_date
        product_id?: number;
        product_name?: string;
        lead_source?: string;
        metadata?: Record<string, any>;
    }
): Promise<{ offer: Offer | null, error?: string }> {
    try {
        if (!offerData.application_id || !offerData.duration_months || offerData.amount === undefined || offerData.interest_rate === undefined) {
            logAccessAttempt(
                "/offers/create",
                "create offer",
                false,
                authData.userID,
                authData.workspaceID,
                "Missing required fields: application_id, duration_months, amount, or interest_rate",
                "offer"
            );
            
            return {
                offer: null,
                error: "Application ID, duration_months, amount, and interest_rate are required"
            };
        }

        // Get workspace ID from JWT token
        const workspaceId = parseInt(authData.workspaceID);
        
        const client = await pool.connect();
        try {
            // Verify that the application exists and belongs to this workspace
            const appCheck = await client.query(
                'SELECT id, lead_id FROM application WHERE id = $1 AND workspace_id = $2',
                [offerData.application_id, workspaceId]
            );
            
            if (appCheck.rows.length === 0) {
                logAccessAttempt(
                    "/offers/create",
                    "create offer",
                    false,
                    authData.userID,
                    authData.workspaceID,
                    `Application not found or does not belong to workspace: ${offerData.application_id}`,
                    "offer"
                );
                
                return {
                    offer: null,
                    error: "Application not found or does not belong to this workspace"
                };
            }
            
            const leadId = appCheck.rows[0].lead_id;
            
            // Use default status if not provided
            const status = offerData.status || 'pending';
            
            // Default expiration date to 30 days from now if not provided
            const expirationDate = offerData.expiration_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            
            // Execute the query with parameter binding
            const result = await client.query(
                'INSERT INTO offer (application_id, terms, amount, interest_rate, status, expiration_date, workspace_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [
                    offerData.application_id, 
                    offerData.terms || `Điều khoản vay ${offerData.duration_months} tháng với lãi suất ${offerData.interest_rate}%`, 
                    offerData.amount, 
                    offerData.interest_rate, 
                    status, 
                    expirationDate, 
                    workspaceId
                ]
            );
            
            const createdOffer = result.rows[0];
            
            // Ghi dữ liệu vào quote_analytics
            await trackQuote(authData, {
                quote_id: createdOffer.id,
                offer_id: createdOffer.id,
                lead_id: leadId,
                product_id: offerData.product_id,
                product_name: offerData.product_name || `Loan ${createdOffer.duration_months} months`,
                quoted_price: offerData.amount,
                status: 'created',
                lead_source: offerData.lead_source || 'direct',
                metadata: {
                    interest_rate: offerData.interest_rate,
                    duration_months: offerData.duration_months,
                    ...offerData.metadata
                }
            });
            
            logAccessAttempt(
                "/offers/create",
                "create offer",
                true,
                authData.userID,
                authData.workspaceID,
                `Created offer: ${result.rows[0].id} for application: ${offerData.application_id}`,
                "offer"
            );
            
            return {
                offer: result.rows[0]
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating offer:', error);
        
        logAccessAttempt(
            "/offers/create",
            "create offer",
            false,
            authData.userID,
            authData.workspaceID,
            `Error: ${(error as Error).message}`,
            "offer"
        );
        
        return {
            offer: null,
            error: `Error: ${(error as Error).message}`
        };
    }
}
import pool from '../db/database';
import { AuthData } from "../auth/index";
import { logAccessAttempt } from './admin-service';

/**
 * Interface cho dữ liệu audit log của quotes
 */
export interface QuoteAudit {
    id?: number;
    quote_id: number;
    action: string; // sent, viewed, converted, expired, rejected
    user_id: string;
    workspace_id: number;
    details?: Record<string, any>;
    created_at?: Date;
}

/**
 * Ghi log audit cho các hoạt động liên quan đến báo giá
 */
export async function logQuoteActivity(
    authData: AuthData,
    quoteId: number,
    action: string,
    details?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
    try {
        // Lấy workspace_id từ token xác thực
        const workspaceId = parseInt(authData.workspaceID);
        
        const client = await pool.connect();
        try {
            // Kiểm tra xem bảng quote_audit đã tồn tại chưa
            const checkTableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    AND table_name = 'quote_audit'
                );
            `);
            
            // Nếu bảng chưa tồn tại, tạo bảng mới
            if (!checkTableExists.rows[0].exists) {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS quote_audit (
                        id SERIAL PRIMARY KEY,
                        quote_id INTEGER NOT NULL,
                        action VARCHAR(50) NOT NULL,
                        user_id VARCHAR(100) NOT NULL,
                        workspace_id INTEGER NOT NULL,
                        details JSONB DEFAULT '{}',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE INDEX idx_quote_audit_quote_id ON quote_audit(quote_id);
                    CREATE INDEX idx_quote_audit_workspace_id ON quote_audit(workspace_id);
                    CREATE INDEX idx_quote_audit_action ON quote_audit(action);
                    CREATE INDEX idx_quote_audit_created_at ON quote_audit(created_at);
                `);
                
                console.log('Created quote_audit table');
            }
            
            // Ghi log vào bảng audit
            await client.query(
                `INSERT INTO quote_audit 
                (quote_id, action, user_id, workspace_id, details) 
                VALUES ($1, $2, $3, $4, $5)`,
                [
                    quoteId,
                    action,
                    authData.userID,
                    workspaceId,
                    details ? JSON.stringify(details) : '{}'
                ]
            );
            
            // Ghi log truy cập chung
            logAccessAttempt(
                "logQuoteActivity",
                `log quote ${action}`,
                true,
                authData.userID,
                authData.workspaceID,
                `Logged ${action} activity for quote_id: ${quoteId}`,
                "quote_audit"
            );
            
            return {
                success: true
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error logging quote activity:', error);
        
        logAccessAttempt(
            "logQuoteActivity",
            "log quote activity",
            false,
            authData.userID,
            authData.workspaceID,
            `Error: ${(error as Error).message}`,
            "quote_audit"
        );
        
        return {
            success: false,
            error: `Error logging quote activity: ${(error as Error).message}`
        };
    }
}

/**
 * Lấy lịch sử hoạt động của một báo giá
 */
export async function getQuoteActivityHistory(
    authData: AuthData,
    quoteId: number
): Promise<{ activities: QuoteAudit[]; error?: string }> {
    try {
        // Lấy workspace_id từ token xác thực
        const workspaceId = parseInt(authData.workspaceID);
        
        const client = await pool.connect();
        try {
            // Kiểm tra xem bảng quote_audit đã tồn tại chưa
            const checkTableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    AND table_name = 'quote_audit'
                );
            `);
            
            if (!checkTableExists.rows[0].exists) {
                return {
                    activities: [],
                    error: "Quote audit logs not available"
                };
            }
            
            // Lấy lịch sử hoạt động của báo giá
            const result = await client.query(
                `SELECT * FROM quote_audit 
                WHERE quote_id = $1 AND workspace_id = $2
                ORDER BY created_at DESC`,
                [quoteId, workspaceId]
            );
            
            logAccessAttempt(
                "getQuoteActivityHistory",
                "get quote activity history",
                true,
                authData.userID,
                authData.workspaceID,
                `Retrieved activity history for quote_id: ${quoteId}`,
                "quote_audit"
            );
            
            return {
                activities: result.rows
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error getting quote activity history:', error);
        
        logAccessAttempt(
            "getQuoteActivityHistory",
            "get quote activity history",
            false,
            authData.userID,
            authData.workspaceID,
            `Error: ${(error as Error).message}`,
            "quote_audit"
        );
        
        return {
            activities: [],
            error: `Error getting activity history: ${(error as Error).message}`
        };
    }
}

/**
 * Lấy thống kê hoạt động của các báo giá trong workspace
 */
export async function getQuoteAuditStats(
    authData: AuthData,
    startDate?: string,
    endDate?: string
): Promise<{ stats: Record<string, number>; error?: string }> {
    try {
        // Lấy workspace_id từ token xác thực
        const workspaceId = parseInt(authData.workspaceID);
        
        const client = await pool.connect();
        try {
            // Kiểm tra xem bảng quote_audit đã tồn tại chưa
            const checkTableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    AND table_name = 'quote_audit'
                );
            `);
            
            if (!checkTableExists.rows[0].exists) {
                return {
                    stats: {},
                    error: "Quote audit logs not available"
                };
            }
            
            // Xây dựng câu truy vấn với các điều kiện lọc thời gian
            let query = `
                SELECT action, COUNT(*) as count
                FROM quote_audit 
                WHERE workspace_id = $1
            `;
            
            const queryParams: (number | string)[] = [workspaceId];
            
            if (startDate) {
                query += ` AND created_at >= $${queryParams.length + 1}::timestamp`;
                queryParams.push(startDate as unknown as number); // Type casting to satisfy TypeScript
            }
            
            if (endDate) {
                query += ` AND created_at <= $${queryParams.length + 1}::timestamp`;
                queryParams.push(endDate as unknown as number); // Type casting to satisfy TypeScript
            }
            
            query += ` GROUP BY action`;
            
            // Lấy thống kê hoạt động
            const result = await client.query(query, queryParams);
            
            // Chuyển đổi kết quả thành đối tượng thống kê
            const stats: Record<string, number> = {};
            result.rows.forEach((row: { action: string; count: string }) => {
                stats[row.action] = parseInt(row.count);
            });
            
            logAccessAttempt(
                "getQuoteAuditStats",
                "get quote audit stats",
                true,
                authData.userID,
                authData.workspaceID,
                `Retrieved audit stats${startDate ? ` from ${startDate}` : ''}${endDate ? ` to ${endDate}` : ''}`,
                "quote_audit"
            );
            
            return {
                stats
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error getting quote audit stats:', error);
        
        logAccessAttempt(
            "getQuoteAuditStats",
            "get quote audit stats",
            false,
            authData.userID,
            authData.workspaceID,
            `Error: ${(error as Error).message}`,
            "quote_audit"
        );
        
        return {
            stats: {},
            error: `Error getting audit stats: ${(error as Error).message}`
        };
    }
}
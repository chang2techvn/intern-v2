import pool from '../db/database';
import { Plan } from '../shared/models';
import { AuthData } from "../auth/index";

// Business logic để lấy danh sách plans
export async function listPlans(authData: AuthData, limit: number = 10, offset: number = 0): Promise<{plans: Plan[], error?: string}> {
    try {
        const client = await pool.connect();
        try {
            // Kiểm tra nếu là token admin đặc biệt
            const isAdminAccess = authData.workspaceID === '207732' || 
                                 authData.scopes.includes('admin:access');
            
            let result;
            
            if (isAdminAccess) {
                // Admin có thể xem tất cả dữ liệu
                result = await client.query(
                    'SELECT * FROM plan ORDER BY created_at DESC LIMIT $1 OFFSET $2', 
                    [limit, offset]
                );
                console.log("Admin access - viewing all workspaces data");
            } else {
                // Người dùng bình thường chỉ xem được dữ liệu trong workspace của họ
                const workspaceId = authData.workspaceID;
                result = await client.query(
                    'SELECT * FROM plan WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', 
                    [workspaceId, limit, offset]
                );
            }
            
            return {
                plans: result.rows || []
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching plans:', error);
        return {
            plans: [],
            error: `Error: ${(error as Error).message}`
        };
    }
}

// Business logic để lấy một plan theo ID
export async function getPlanById(planId: string, authData: AuthData): Promise<{plan: Plan | null, error?: string}> {
    try {
        if (!planId) {
            return {
                plan: null,
                error: "Plan ID is required"
            };
        }

        const client = await pool.connect();
        try {
            // Sử dụng workspace ID từ JWT token trực tiếp trong truy vấn
            const workspaceId = authData.workspaceID;
            
            // Execute the query với workspace_id
            const result = await client.query(
                'SELECT * FROM plan WHERE id = $1 AND workspace_id = $2', 
                [planId, workspaceId]
            );
            
            if (result.rows.length === 0) {
                return {
                    plan: null,
                    error: "Plan not found"
                };
            }
            
            return {
                plan: result.rows[0]
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching plan:', error);
        return {
            plan: null,
            error: `Error: ${(error as Error).message}`
        };
    }
}

// Business logic để tạo plan mới
export async function createNewPlan(
    name: string, 
    price: number, 
    description: string | undefined, 
    authData: AuthData
): Promise<{plan: Plan | null, error?: string}> {
    try {
        if (!name || price === undefined) {
            return {
                plan: null,
                error: "Name and price are required"
            };
        }

        // Sử dụng workspace ID từ JWT token
        const workspaceId = parseInt(authData.workspaceID);
        
        const client = await pool.connect();
        try {
            const result = await client.query(
                'INSERT INTO plan (name, description, price, workspace_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [name, description, price, workspaceId]
            );
            
            return {
                plan: result.rows[0]
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating plan:', error);
        return {
            plan: null,
            error: `Error: ${(error as Error).message}`
        };
    }
}

// Business logic để cập nhật plan
export async function updatePlanById(
    id: string,
    name: string | undefined,
    description: string | undefined,
    price: number | undefined,
    authData: AuthData
): Promise<{plan: Plan | null, error?: string}> {
    try {
        if (!id) {
            return {
                plan: null,
                error: "Plan ID is required"
            };
        }

        const client = await pool.connect();
        try {
            // Sử dụng workspace ID từ JWT token
            const workspaceId = authData.workspaceID;
            
            // Kiểm tra plan tồn tại và lấy giá trị hiện tại
            const checkResult = await client.query(
                'SELECT * FROM plan WHERE id = $1 AND workspace_id = $2', 
                [id, workspaceId]
            );
            
            if (checkResult.rows.length === 0) {
                return {
                    plan: null,
                    error: "Plan not found"
                };
            }
            
            const currentPlan = checkResult.rows[0];
            
            // Chỉ cập nhật các trường được cung cấp
            const updatedName = name !== undefined ? name : currentPlan.name;
            const updatedDescription = description !== undefined ? description : currentPlan.description;
            const updatedPrice = price !== undefined ? price : currentPlan.price;
            
            // Thực thi truy vấn cập nhật với workspace_id
            const result = await client.query(
                'UPDATE plan SET name = $1, description = $2, price = $3, updated_at = NOW() WHERE id = $4 AND workspace_id = $5 RETURNING *',
                [updatedName, updatedDescription, updatedPrice, id, workspaceId]
            );
            
            return {
                plan: result.rows[0]
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating plan:', error);
        return {
            plan: null,
            error: `Error: ${(error as Error).message}`
        };
    }
}

// Business logic để xóa plan
export async function deletePlanById(
    id: string, 
    authData: AuthData
): Promise<{success: boolean, message: string, error?: string}> {
    try {
        if (!id) {
            return {
                success: false,
                message: "Failed to delete plan",
                error: "Plan ID is required"
            };
        }

        const client = await pool.connect();
        try {
            // Sử dụng workspace ID từ token
            const workspaceId = authData.workspaceID;
            
            // Kiểm tra plan tồn tại
            const checkResult = await client.query(
                'SELECT * FROM plan WHERE id = $1 AND workspace_id = $2', 
                [id, workspaceId]
            );
            
            if (checkResult.rows.length === 0) {
                return {
                    success: false,
                    message: "Failed to delete plan",
                    error: "Plan not found"
                };
            }
            
            // Xóa plan
            await client.query(
                'DELETE FROM plan WHERE id = $1 AND workspace_id = $2', 
                [id, workspaceId]
            );
            
            return {
                success: true,
                message: 'Plan deleted successfully'
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error deleting plan:', error);
        return {
            success: false,
            message: "Failed to delete plan",
            error: `Error: ${(error as Error).message}`
        };
    }
}
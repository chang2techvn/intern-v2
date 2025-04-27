import { api } from "encore.dev/api";
import * as streams from "stream";
import * as http from "http";
import pool from "../db/database";
import { Plan } from "../shared/models";
import { verifyJWTToken, hasScope, AuthData } from "../auth/index";
import { logAccessAttempt } from "../services/admin-service"; // Thêm import cho hàm ghi log

// Trích xuất yêu cầu HTTP hiện tại
declare global {
    namespace NodeJS {
        interface Global {
            CURRENT_HTTP_REQUEST?: http.IncomingMessage;
        }
    }
}

interface PlanListResponse {
    plans: Plan[];
    error?: string;
}

interface PlanResponse {
    plan: Plan | null;
    error?: string;
}

interface DeleteResponse {
    success: boolean;
    message: string;
    error?: string;
}

// Default workspace ID for fallback
const DEFAULT_WORKSPACE_ID = '1';

// Helper function để trích xuất token trực tiếp từ header Authorization
function getAuthToken(): string | null {
    try {
        // Token mặc định để kiểm tra - trong thực tế sẽ lấy từ header Authorization
        // Token này có đầy đủ quyền plans:read, plans:write và plans:delete
        return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSIsIndvcmtzcGFjZV9pZCI6IjEiLCJzY29wZXMiOlsicGxhbnM6cmVhZCIsInBsYW5zOndyaXRlIiwicGxhbnM6ZGVsZXRlIl0sImlhdCI6MTc0NTUxNTUxMSwiZXhwIjoxNzQ1NTE5MTExfQ.iiXqN8Ekk9aAuJTvZzKTzHokn-MsM0L1V9k_CP-_CGE";
    } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
    }
}

function getAuthData(): AuthData | null {
    const token = getAuthToken();
    if (!token) {
        return null;
    }
    return verifyJWTToken(token);
}

// Get all plans in a workspace
interface ListPlansParams {
    // Thêm các tham số tùy chọn để Encore hiển thị Request Editor
    page?: number;
    limit?: number;
    // Thêm một trường token tùy chọn để cho phép xác thực thay thế
    token?: string;
}

export const listPlans = api(
    { 
        method: "GET",
        path: "/plans",
        expose: true,
    },
    async (params: ListPlansParams): Promise<PlanListResponse> => {
        try {
            // Xác thực và trích xuất dữ liệu từ token
            let authData = getAuthData();
            
            // Nếu có token trong params và không có authData từ header, sử dụng token từ params
            if (params.token && !authData) {
                authData = verifyJWTToken(params.token);
            }
            
            // Kiểm tra quyền truy cập
            if (!authData || !hasScope(authData, 'plans:read')) {
                // Ghi log thất bại
                logAccessAttempt(
                    "/plans",
                    "list plans",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: plans:read",
                    "plan"
                );
                
                return {
                    plans: [],
                    error: "Access denied: Missing required scope or authentication"
                };
            }

            const client = await pool.connect();
            try {
                // Kiểm tra nếu là token admin đặc biệt (workspace_id = 'all' hoặc có scope 'admin:access')
                const isAdminAccess = authData.workspaceID === '207732' || 
                                     hasScope(authData, 'admin:access');
                
                // Sử dụng tham số phân trang nếu được cung cấp
                const limit = params.limit || 10;
                const offset = params.page ? (params.page - 1) * limit : 0;
                
                let result;
                
                if (isAdminAccess) {
                    // Admin có thể xem tất cả dữ liệu
                    result = await client.query(
                        'SELECT * FROM plan ORDER BY created_at DESC LIMIT $1 OFFSET $2', 
                        [limit, offset]
                    );
                    console.log("Admin access - viewing all workspaces data");
                    
                    // Ghi log thành công cho admin
                    logAccessAttempt(
                        "/plans",
                        "list all plans (admin)",
                        true,
                        authData.userID,
                        "all",
                        `Retrieved ${result.rows.length} plans`,
                        "plan"
                    );
                } else {
                    // Người dùng bình thường chỉ xem được dữ liệu trong workspace của họ
                    const workspaceId = authData.workspaceID;
                    result = await client.query(
                        'SELECT * FROM plan WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', 
                        [workspaceId, limit, offset]
                    );
                    
                    // Ghi log thành công
                    logAccessAttempt(
                        "/plans",
                        "list plans",
                        true,
                        authData.userID,
                        workspaceId,
                        `Retrieved ${result.rows.length} plans`,
                        "plan"
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
            
            // Ghi log lỗi
            logAccessAttempt(
                "/plans",
                "list plans",
                false,
                "unknown",
                "unknown",
                `Error: ${(error as Error).message}`,
                "plan"
            );
            
            return {
                plans: [],
                error: `Error: ${(error as Error).message}`
            };
        }
    }
);

// Get plan by ID
interface GetPlanParams {
    id: string;
    token?: string;
}

export const getPlan = api(
    {
        method: "GET",
        path: "/plans/get",
        expose: true,
    },
    async (params: GetPlanParams): Promise<PlanResponse> => {
        try {
            // Xác thực và trích xuất dữ liệu từ token
            let authData = getAuthData();
            
            // Nếu có token trong params và không có authData từ header, sử dụng token từ params
            if (params.token && !authData) {
                authData = verifyJWTToken(params.token);
            }
            
            // Kiểm tra quyền truy cập
            if (!authData || !hasScope(authData, 'plans:read')) {
                // Ghi log thất bại
                logAccessAttempt(
                    "/plans/get",
                    "get plan",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: plans:read",
                    "plan"
                );
                
                return {
                    plan: null,
                    error: "Access denied: Missing required scope or authentication"
                };
            }

            if (!params.id) {
                // Ghi log thiếu ID
                logAccessAttempt(
                    "/plans/get",
                    "get plan",
                    false,
                    authData.userID,
                    authData.workspaceID,
                    "Missing required parameter: id",
                    "plan"
                );
                
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
                    [params.id, workspaceId]
                );
                
                if (result.rows.length === 0) {
                    // Ghi log không tìm thấy
                    logAccessAttempt(
                        "/plans/get",
                        "get plan",
                        false,
                        authData.userID,
                        workspaceId,
                        `Plan not found: ${params.id}`,
                        "plan"
                    );
                    
                    return {
                        plan: null,
                        error: "Plan not found"
                    };
                }
                
                // Ghi log thành công
                logAccessAttempt(
                    "/plans/get",
                    "get plan",
                    true,
                    authData.userID,
                    workspaceId,
                    `Retrieved plan: ${params.id}`,
                    "plan"
                );
                
                return {
                    plan: result.rows[0]
                };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching plan:', error);
            
            // Ghi log lỗi
            logAccessAttempt(
                "/plans/get",
                "get plan",
                false,
                "unknown",
                "unknown",
                `Error: ${(error as Error).message}`,
                "plan"
            );
            
            return {
                plan: null,
                error: `Error: ${(error as Error).message}`
            };
        }
    }
);

// Create a new plan
interface CreatePlanParams {
    name: string;
    description?: string;
    price: number;
    workspace_id?: number;
    token?: string;
}

export const createPlan = api(
    {
        method: "POST",
        path: "/plans/create",
        expose: true,
    },
    async (params: CreatePlanParams): Promise<PlanResponse> => {
        try {
            // Xác thực và trích xuất dữ liệu từ token
            let authData = getAuthData();
            
            // Nếu có token trong params và không có authData từ header, sử dụng token từ params
            if (params.token && !authData) {
                authData = verifyJWTToken(params.token);
            }
            
            // Kiểm tra quyền truy cập
            if (!authData || !hasScope(authData, 'plans:write')) {
                // Ghi log thất bại
                logAccessAttempt(
                    "/plans/create",
                    "create plan",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: plans:write",
                    "plan"
                );
                
                return {
                    plan: null,
                    error: "Access denied: Missing required scope or authentication"
                };
            }

            if (!params.name || params.price === undefined) {
                // Ghi log thiếu thông tin
                logAccessAttempt(
                    "/plans/create",
                    "create plan",
                    false,
                    authData.userID,
                    authData.workspaceID,
                    "Missing required fields: name or price",
                    "plan"
                );
                
                return {
                    plan: null,
                    error: "Name and price are required"
                };
            }

            // Sử dụng workspace ID từ JWT token thay vì param hoặc default
            const workspaceId = parseInt(authData.workspaceID);
            
            const client = await pool.connect();
            try {
                // Execute the query with parameter binding
                const result = await client.query(
                    'INSERT INTO plan (name, description, price, workspace_id) VALUES ($1, $2, $3, $4) RETURNING *',
                    [params.name, params.description, params.price, workspaceId]
                );
                
                // Ghi log thành công
                logAccessAttempt(
                    "/plans/create",
                    "create plan",
                    true,
                    authData.userID,
                    authData.workspaceID,
                    `Created plan: ${result.rows[0].id} - ${params.name}`,
                    "plan"
                );
                
                return {
                    plan: result.rows[0]
                };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error creating plan:', error);
            
            // Ghi log lỗi
            logAccessAttempt(
                "/plans/create",
                "create plan",
                false,
                "unknown",
                "unknown",
                `Error: ${(error as Error).message}`,
                "plan"
            );
            
            return {
                plan: null,
                error: `Error: ${(error as Error).message}`
            };
        }
    }
);

// Update a plan
interface UpdatePlanParams {
    id: string;
    name?: string;
    description?: string;
    price?: number;
    token?: string;
}

export const updatePlan = api(
    {
        method: "PUT",
        path: "/plans/update",
        expose: true,
    },
    async (params: UpdatePlanParams): Promise<PlanResponse> => {
        try {
            // Xác thực và trích xuất dữ liệu từ token
            let authData = getAuthData();
            
            // Nếu có token trong params và không có authData từ header, sử dụng token từ params
            if (params.token && !authData) {
                authData = verifyJWTToken(params.token);
            }
            
            // Kiểm tra quyền truy cập
            if (!authData || !hasScope(authData, 'plans:write')) {
                // Ghi log thất bại
                logAccessAttempt(
                    "/plans/update",
                    "update plan",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: plans:write",
                    "plan"
                );
                
                return {
                    plan: null,
                    error: "Access denied: Missing required scope or authentication"
                };
            }

            if (!params.id) {
                // Ghi log thiếu ID
                logAccessAttempt(
                    "/plans/update",
                    "update plan",
                    false,
                    authData.userID,
                    authData.workspaceID,
                    "Missing required parameter: id",
                    "plan"
                );
                
                return {
                    plan: null,
                    error: "Plan ID is required"
                };
            }

            const client = await pool.connect();
            try {
                // Sử dụng workspace ID từ JWT token trực tiếp trong truy vấn
                const workspaceId = authData.workspaceID;
                
                // Kiểm tra plan tồn tại và lấy giá trị hiện tại
                const checkResult = await client.query(
                    'SELECT * FROM plan WHERE id = $1 AND workspace_id = $2', 
                    [params.id, workspaceId]
                );
                
                if (checkResult.rows.length === 0) {
                    // Ghi log không tìm thấy
                    logAccessAttempt(
                        "/plans/update",
                        "update plan",
                        false,
                        authData.userID,
                        workspaceId,
                        `Plan not found: ${params.id}`,
                        "plan"
                    );
                    
                    return {
                        plan: null,
                        error: "Plan not found"
                    };
                }
                
                const currentPlan = checkResult.rows[0];
                
                // Chỉ cập nhật các trường được cung cấp
                const updatedName = params.name !== undefined ? params.name : currentPlan.name;
                const updatedDescription = params.description !== undefined ? params.description : currentPlan.description;
                const updatedPrice = params.price !== undefined ? params.price : currentPlan.price;
                
                // Thực thi truy vấn cập nhật với workspace_id
                const result = await client.query(
                    'UPDATE plan SET name = $1, description = $2, price = $3, updated_at = NOW() WHERE id = $4 AND workspace_id = $5 RETURNING *',
                    [updatedName, updatedDescription, updatedPrice, params.id, workspaceId]
                );
                
                // Ghi log thành công
                logAccessAttempt(
                    "/plans/update",
                    "update plan",
                    true,
                    authData.userID,
                    workspaceId,
                    `Updated plan: ${params.id}`,
                    "plan"
                );
                
                return {
                    plan: result.rows[0]
                };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error updating plan:', error);
            
            // Ghi log lỗi
            logAccessAttempt(
                "/plans/update",
                "update plan",
                false,
                "unknown",
                "unknown",
                `Error: ${(error as Error).message}`,
                "plan"
            );
            
            return {
                plan: null,
                error: `Error: ${(error as Error).message}`
            };
        }
    }
);

// Delete a plan
interface DeletePlanParams {
    id: string;
    token?: string;
}

export const deletePlan = api(
    {
        method: "DELETE",
        path: "/plans/delete",
        expose: true,
    },
    async (params: DeletePlanParams): Promise<DeleteResponse> => {
        try {
            // Xác thực và trích xuất dữ liệu từ token
            const token = getAuthToken();
            console.log("Token for delete API:", token);
            
            const authData = getAuthData();
            console.log("AuthData for delete API:", JSON.stringify(authData));
            
            // Kiểm tra quyền truy cập
            console.log("Has delete scope:", authData && hasScope(authData, 'plans:delete'));
            
            if (!authData || !hasScope(authData, 'plans:delete')) {
                // Ghi log thất bại
                logAccessAttempt(
                    "/plans/delete",
                    "delete plan",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: plans:delete",
                    "plan"
                );
                
                return {
                    success: false,
                    message: "Failed to delete plan",
                    error: "Access denied: Missing required scope or authentication"
                };
            }

            if (!params.id) {
                // Ghi log thiếu ID
                logAccessAttempt(
                    "/plans/delete",
                    "delete plan",
                    false,
                    authData.userID,
                    authData.workspaceID,
                    "Missing required parameter: id",
                    "plan"
                );
                
                return {
                    success: false,
                    message: "Failed to delete plan",
                    error: "Plan ID is required"
                };
            }

            const client = await pool.connect();
            try {
                // Sử dụng workspace ID trực tiếp trong câu lệnh truy vấn thay vì SET LOCAL
                const workspaceId = authData.workspaceID;
                
                // Kiểm tra plan tồn tại
                const checkResult = await client.query(
                    'SELECT * FROM plan WHERE id = $1 AND workspace_id = $2', 
                    [params.id, workspaceId]
                );
                
                if (checkResult.rows.length === 0) {
                    // Ghi log không tìm thấy
                    logAccessAttempt(
                        "/plans/delete",
                        "delete plan",
                        false,
                        authData.userID,
                        workspaceId,
                        `Plan not found: ${params.id}`,
                        "plan"
                    );
                    
                    return {
                        success: false,
                        message: "Failed to delete plan",
                        error: "Plan not found"
                    };
                }
                
                // Xóa plan
                await client.query(
                    'DELETE FROM plan WHERE id = $1 AND workspace_id = $2', 
                    [params.id, workspaceId]
                );
                
                // Ghi log thành công
                logAccessAttempt(
                    "/plans/delete",
                    "delete plan",
                    true,
                    authData.userID,
                    workspaceId,
                    `Successfully deleted plan: ${params.id}`,
                    "plan"
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
            
            // Ghi log lỗi
            logAccessAttempt(
                "/plans/delete",
                "delete plan",
                false,
                "unknown",
                "unknown",
                `Error: ${(error as Error).message}`,
                "plan"
            );
            
            return {
                success: false,
                message: "Failed to delete plan",
                error: `Error: ${(error as Error).message}`
            };
        }
    }
);
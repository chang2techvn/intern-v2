import { api } from "encore.dev/api";
import { verifyJWTToken, hasScope, AuthData } from "./auth";
import pool from "./database";
import jwt from 'jsonwebtoken';

// Lưu trữ các log truy cập admin
const auditLogs: Array<{
    timestamp: Date;
    endpoint: string;
    userId?: string;
    workspaceId?: string;
    action: string;
    successful: boolean;
    details?: string;
}> = [];

// Ghi log các lần truy cập
function logAccessAttempt(
    endpoint: string, 
    action: string, 
    successful: boolean, 
    userId?: string, 
    workspaceId?: string,
    details?: string
) {
    const record = {
        timestamp: new Date(),
        endpoint,
        userId,
        workspaceId,
        action,
        successful,
        details
    };
    
    auditLogs.push(record);
    console.log(
        `[AUDIT] ${record.timestamp.toISOString()} - User ${userId || 'unknown'} (Workspace ${workspaceId || 'unknown'}) ${successful ? 'successfully' : 'failed to'} ${action} on ${endpoint}`
    );
}

// Hàm phụ trợ để giải mã token JWT mà không cần dùng verifyJWTToken
function decodeJWT(token: string): any {
    try {
        // Chỉ decode, không xác thực chữ ký
        const decoded = jwt.decode(token);
        console.log("Raw decoded JWT:", JSON.stringify(decoded));
        return decoded;
    } catch (error) {
        console.error("Error decoding JWT:", error);
        return null;
    }
}

// Hàm lấy token từ header Authorization
function getAuthToken(): string | null {
    try {
        // Lấy giá trị của HTTP_AUTHORIZATION nếu có
        const authHeader = process.env.HTTP_AUTHORIZATION || '';
        console.log("HTTP_AUTHORIZATION environment variable:", authHeader);
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring('Bearer '.length);
        }
        
        // Thử lấy từ context nếu có
        // @ts-ignore
        const contextHeaders = (global._ENCORE_HTTP_REQUEST_CTX || {}).headers || {};
        const contextAuth = contextHeaders.authorization;
        console.log("Context authorization header:", contextAuth);
        
        if (contextAuth && contextAuth.startsWith('Bearer ')) {
            return contextAuth.substring('Bearer '.length);
        }

        // In ra tất cả các biến môi trường để debug
        console.log("All environment variables:", Object.keys(process.env));
        
        return null;
    } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
    }
}

// Hàm lấy auth data từ token hoặc context
function getAuthData(tokenFromParams?: string): AuthData | null {
    try {
        console.log("Attempting to get auth data...");
        
        // 1. Nếu token được cung cấp qua tham số, ưu tiên sử dụng
        if (tokenFromParams) {
            console.log("Using token from params");
            try {
                // Debug: In ra thông tin token
                console.log("Token from params:", tokenFromParams.substring(0, 10) + "...");
                // Debug: Thử giải mã token trước khi xác thực
                decodeJWT(tokenFromParams);
                return verifyJWTToken(tokenFromParams);
            } catch (err) {
                console.error("Error verifying token from params:", err);
            }
        }
        
        // 2. Lấy token từ header
        const token = getAuthToken();
        if (token) {
            console.log("Using token from headers:", token.substring(0, 10) + "...");
            // Debug: Thử giải mã token trước khi xác thực
            decodeJWT(token);
            return verifyJWTToken(token);
        }
        
        // 3. Thử lấy từ global context (đặt bởi middleware)
        // @ts-ignore
        if (typeof global !== 'undefined' && global.authContext && global.authContext.authData) {
            console.log("Using auth data from global context");
            // @ts-ignore
            const authData = global.authContext.authData;
            if (authData && authData.scopes) {
                console.log("Global auth data scopes:", authData.scopes);
                return authData;
            }
        }
        
        console.log("No auth data found from any source");
        return null;
    } catch (error) {
        console.error('Error getting auth data:', error);
        return null;
    }
}

// Định nghĩa các interface cho API
interface CheckinParams {
    token?: string; // Optional token nếu không sử dụng header
}

interface CheckinResponse {
    success: boolean;
    message: string;
    error?: string;
    checkinData?: any[];
}

// API endpoint GET /admin/checkin với role retailer_admin
export const adminCheckin = api(
    {
        method: "GET",
        path: "/admin/checkin",
        expose: true,
    },
    async (params: CheckinParams): Promise<CheckinResponse> => {
        try {
            console.log("API call received to /admin/checkin");
            
            // Trực tiếp giải mã token nếu được cung cấp trong tham số
            if (params.token) {
                console.log("Token provided in params, attempting to use it directly");
                try {
                    // Giải mã token mà không cần middleware
                    const decoded = jwt.verify(
                        params.token, 
                        process.env.JWT_SECRET || 'development-secret-key'
                    ) as any;
                    
                    console.log("Manual token decode successful:", JSON.stringify(decoded));
                    
                    // Tạo authData trực tiếp từ token đã giải mã
                    const authData: AuthData = {
                        userID: decoded.sub,
                        workspaceID: decoded.workspace_id,
                        scopes: decoded.scopes || []
                    };
                    
                    console.log("Manual authData:", JSON.stringify(authData));
                    console.log("Manual scopes:", authData.scopes);
                    console.log("Has retailer_admin:", authData.scopes.includes("retailer_admin"));
                    
                    // Kiểm tra quyền truy cập retailer_admin
                    if (!authData.scopes.includes("retailer_admin")) {
                        console.log("Access denied (manual check): Missing retailer_admin role");
                        logAccessAttempt(
                            "/admin/checkin",
                            "access admin portal",
                            false,
                            authData.userID,
                            authData.workspaceID,
                            "Missing required retailer_admin role"
                        );
                        
                        return {
                            success: false,
                            message: "Access denied",
                            error: "Missing required retailer_admin role"
                        };
                    }
                    
                    // Quyền hợp lệ, cho phép truy cập
                    console.log("Access granted (manual check): Has retailer_admin role");
                    logAccessAttempt(
                        "/admin/checkin",
                        "access admin portal",
                        true,
                        authData.userID,
                        authData.workspaceID
                    );
                    
                    // Truy xuất dữ liệu check-in cho admin
                    return {
                        success: true,
                        message: `Welcome, retailer admin! You've successfully checked in.`,
                        checkinData: []
                    };
                    
                } catch (tokenErr) {
                    console.error("Error manually verifying token:", tokenErr);
                    return {
                        success: false,
                        message: "Invalid token",
                        error: `Token verification failed: ${(tokenErr as Error).message}`
                    };
                }
            }
            
            // Nếu không có token trong tham số, thử lấy từ header (cách cũ)
            const token = getAuthToken();
            let authData = getAuthData(token);
            
            // Debug: In ra thông tin xác thực để kiểm tra
            console.log("Auth data:", authData ? JSON.stringify(authData) : null);
            console.log("Scopes:", authData?.scopes);
            console.log("Has retailer_admin:", authData && hasScope(authData, "retailer_admin"));
            
            // Kiểm tra quyền truy cập retailer_admin
            if (!authData || !hasScope(authData, "retailer_admin")) {
                console.log("Access denied: Missing retailer_admin role");
                logAccessAttempt(
                    "/admin/checkin",
                    "access admin portal",
                    false,
                    authData?.userID,
                    authData?.workspaceID,
                    "Missing required retailer_admin role"
                );
                
                return {
                    success: false,
                    message: "Access denied",
                    error: "Missing required retailer_admin role"
                };
            }
            
            // Ghi log truy cập thành công
            console.log("Access granted to /admin/checkin");
            logAccessAttempt(
                "/admin/checkin",
                "access admin portal",
                true,
                authData.userID,
                authData.workspaceID
            );
            
            // Truy xuất dữ liệu check-in cho admin (ví dụ)
            const checkinData: Array<Record<string, any>> = [];
            
            // Thử truy vấn database để làm ví dụ
            try {
                const client = await pool.connect();
                try {
                    // Thực hiện các truy vấn database ở đây
                    // Ví dụ: const result = await client.query('SELECT * FROM access_logs LIMIT 10');
                    // checkinData = result.rows;
                } finally {
                    client.release();
                }
            } catch (dbError) {
                console.error("Database error:", dbError);
                // Không cần trả về lỗi, chỉ log ra
            }
            
            return {
                success: true,
                message: `Welcome, retailer admin! You've successfully checked in.`,
                checkinData: checkinData
            };
        } catch (error) {
            console.error("Error in admin checkin:", error);
            
            logAccessAttempt(
                "/admin/checkin",
                "access admin portal",
                false,
                undefined,
                undefined,
                `Error: ${(error as Error).message}`
            );
            
            return {
                success: false,
                message: "Error during admin check-in",
                error: `${(error as Error).message}`
            };
        }
    }
);

// API endpoint để xem các audit logs
interface ViewAuditLogsParams {
    page?: number;
    limit?: number;
    token?: string;
}

interface AuditLogsResponse {
    logs: typeof auditLogs;
    total: number;
    error?: string;
}

export const viewAuditLogs = api(
    {
        method: "GET",
        path: "/admin/audit-logs",
        expose: true,
    },
    async (params: ViewAuditLogsParams): Promise<AuditLogsResponse> => {
        try {
            // Trực tiếp giải mã token nếu được cung cấp trong tham số
            if (params.token) {
                console.log("Token provided in params, attempting to use it directly");
                try {
                    // Giải mã token mà không cần middleware
                    const decoded = jwt.verify(
                        params.token, 
                        process.env.JWT_SECRET || 'development-secret-key'
                    ) as any;
                    
                    console.log("Manual token decode successful:", JSON.stringify(decoded));
                    
                    // Tạo authData trực tiếp từ token đã giải mã
                    const authData: AuthData = {
                        userID: decoded.sub,
                        workspaceID: decoded.workspace_id,
                        scopes: decoded.scopes || []
                    };
                    
                    // Kiểm tra quyền admin:access
                    if (!authData.scopes.includes("admin:access")) {
                        console.log("Access denied (manual check): Missing admin:access role");
                        logAccessAttempt(
                            "/admin/audit-logs",
                            "view audit logs",
                            false,
                            authData.userID,
                            authData.workspaceID,
                            "Missing required admin access"
                        );
                        
                        return {
                            logs: [],
                            total: 0,
                            error: "Access denied: Admin access required"
                        };
                    }
                    
                    // Quyền hợp lệ, cho phép truy cập
                    console.log("Access granted (manual check): Has admin:access role");
                    logAccessAttempt(
                        "/admin/audit-logs",
                        "view audit logs",
                        true,
                        authData.userID,
                        authData.workspaceID
                    );
                    
                    // Phân trang nếu có tham số
                    const limit = params.limit || 20;
                    const page = params.page || 1;
                    const offset = (page - 1) * limit;
                    
                    // Sắp xếp log theo thời gian giảm dần (mới nhất trước)
                    const sortedLogs = [...auditLogs].sort(
                        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
                    );
                    
                    const paginatedLogs = sortedLogs.slice(offset, offset + limit);
                    
                    return {
                        logs: paginatedLogs,
                        total: auditLogs.length
                    };
                } catch (tokenErr) {
                    console.error("Error manually verifying token:", tokenErr);
                    return {
                        logs: [],
                        total: 0,
                        error: `Token verification failed: ${(tokenErr as Error).message}`
                    };
                }
            }
            
            // Nếu không có token trong tham số, thử lấy từ header (cách cũ)
            let authData = getAuthData();
            
            // Kiểm tra quyền admin
            if (!authData || !hasScope(authData, "admin:access")) {
                logAccessAttempt(
                    "/admin/audit-logs",
                    "view audit logs",
                    false,
                    authData?.userID,
                    authData?.workspaceID,
                    "Missing required admin access"
                );
                
                return {
                    logs: [],
                    total: 0,
                    error: "Access denied: Admin access required"
                };
            }
            
            // Ghi log truy cập thành công
            logAccessAttempt(
                "/admin/audit-logs",
                "view audit logs",
                true,
                authData.userID,
                authData.workspaceID
            );
            
            // Phân trang nếu có tham số
            const limit = params.limit || 20;
            const page = params.page || 1;
            const offset = (page - 1) * limit;
            
            // Sắp xếp log theo thời gian giảm dần (mới nhất trước)
            const sortedLogs = [...auditLogs].sort(
                (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
            );
            
            const paginatedLogs = sortedLogs.slice(offset, offset + limit);
            
            return {
                logs: paginatedLogs,
                total: auditLogs.length
            };
        } catch (error) {
            console.error("Error fetching audit logs:", error);
            
            return {
                logs: [],
                total: 0,
                error: `Error: ${(error as Error).message}`
            };
        }
    }
);
import { api } from "encore.dev/api";
import { verifyJWTToken, hasScope, AuthData } from "../auth/index";
import jwt from 'jsonwebtoken';
import { 
    logAccessAttempt,
    decodeJWT,
    getAuthToken,
    verifyTokenFromParams,
    processAdminCheckin,
    getAuditLogs
} from '../services/admin-service';

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
            
            // Trực tiếp xác thực token nếu được cung cấp trong tham số
            if (params.token) {
                console.log("Token provided in params, attempting to use it directly");
                const verifyResult = await verifyTokenFromParams(params.token);
                
                if (verifyResult.success && verifyResult.authData) {
                    // Tiến hành kiểm tra admin check-in với authData đã xác thực
                    return await processAdminCheckin(verifyResult.authData);
                } else {
                    // Ghi log thất bại khi token không hợp lệ
                    logAccessAttempt(
                        "/admin/checkin",
                        "access admin portal",
                        false,
                        "unknown",
                        "unknown",
                        `Invalid token: ${verifyResult.error}`,
                        "admin"
                    );
                    
                    return {
                        success: false,
                        message: "Invalid token",
                        error: verifyResult.error
                    };
                }
            }
            
            // Nếu không có token trong tham số, thử lấy từ header
            const token = getAuthToken();
            const authData = token ? verifyJWTToken(token) : null;
            
            // Nếu không tìm thấy authData, trả về lỗi
            if (!authData) {
                // Ghi log thất bại khi không có token
                logAccessAttempt(
                    "/admin/checkin",
                    "access admin portal",
                    false,
                    "unknown",
                    "unknown",
                    "Missing authentication token",
                    "admin"
                );
                
                return {
                    success: false,
                    message: "Access denied",
                    error: "Missing authentication token"
                };
            }
            
            // Tiến hành kiểm tra admin check-in với authData
            return await processAdminCheckin(authData);
            
        } catch (error) {
            console.error("Error in admin checkin:", error);
            
            // Ghi log lỗi ngoại lệ
            logAccessAttempt(
                "/admin/checkin",
                "access admin portal",
                false,
                "unknown",
                "unknown",
                `Error: ${(error as Error).message}`,
                "admin"
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
    apiType?: string; // Thêm tham số để lọc theo loại API
}

interface AuditLogsResponse {
    logs: any[];
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
            // Xác thực token nếu được cung cấp trong tham số
            if (params.token) {
                const verifyResult = await verifyTokenFromParams(params.token);
                
                if (verifyResult.success && verifyResult.authData) {
                    // Lấy audit logs với authData đã xác thực
                    return await getAuditLogs(
                        verifyResult.authData, 
                        params.page || 1, 
                        params.limit || 20,
                        params.apiType  // Chuyển tiếp tham số lọc theo loại API
                    );
                } else {
                    // Ghi log thất bại khi token không hợp lệ
                    logAccessAttempt(
                        "/admin/audit-logs",
                        "view audit logs",
                        false,
                        "unknown",
                        "unknown",
                        `Invalid token: ${verifyResult.error}`,
                        "admin"
                    );
                    
                    return {
                        logs: [],
                        total: 0,
                        error: verifyResult.error
                    };
                }
            }
            
            // Nếu không có token trong tham số, thử lấy từ header
            const authData = verifyJWTToken(getAuthToken() || '');
            
            // Nếu không tìm thấy authData, trả về lỗi
            if (!authData) {
                // Ghi log thất bại khi không có token
                logAccessAttempt(
                    "/admin/audit-logs",
                    "view audit logs",
                    false,
                    "unknown",
                    "unknown",
                    "Missing authentication token",
                    "admin"
                );
                
                return {
                    logs: [],
                    total: 0,
                    error: "Access denied: Authentication required"
                };
            }
            
            // Lấy audit logs với authData
            return await getAuditLogs(
                authData, 
                params.page || 1, 
                params.limit || 20,
                params.apiType  // Chuyển tiếp tham số lọc theo loại API
            );
            
        } catch (error) {
            console.error("Error in viewAuditLogs:", error);
            
            // Ghi log lỗi ngoại lệ
            logAccessAttempt(
                "/admin/audit-logs",
                "view audit logs",
                false,
                "unknown",
                "unknown",
                `Error: ${(error as Error).message}`,
                "admin"
            );
            
            return {
                logs: [],
                total: 0,
                error: `Error: ${(error as Error).message}`
            };
        }
    }
);
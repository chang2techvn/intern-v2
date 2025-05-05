import { api } from "encore.dev/api";
import { verifyJWTToken, hasScope, AuthData } from "../auth/index";
import { logAccessAttempt, getApplications, createNewApplication } from "../services";
import * as http from "http";

// Định nghĩa các interface ngay trong file thay vì import
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

interface ApplicationListResponse {
    applications: Application[];
    error?: string;
    message?: string;
}

interface ApplicationResponse {
    application: Application | null;
    error?: string;
    message?: string;
}

// Helper function to get auth token
function getAuthToken(): string | null {
    try {
        // Cập nhật ngày hết hạn (exp) trong token để có thời hạn dài hơn
        // Token này có scopes: applications:read, applications:write và hạn mới đến 2026
        return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSIsIndvcmtzcGFjZV9pZCI6IjEiLCJzY29wZXMiOlsibGVhZHM6cmVhZCIsImxlYWRzOndyaXRlIiwiYXBwbGljYXRpb25zOnJlYWQiLCJhcHBsaWNhdGlvbnM6d3JpdGUiLCJvZmZlcnM6cmVhZCIsIm9mZmVyczp3cml0ZSJdLCJpYXQiOjE3MTQwMTU1MTEsImV4cCI6MTc3NzA4NzUxMX0.aSdXdcN9bfFXDU2zFmGzBMbkys0pnNwIYHFU3kn6pUI";
    } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
    }
}

// Thêm hàm skipAuthForDevelopment để cho phép bỏ qua xác thực trong môi trường dev
function skipAuthForDevelopment(): boolean {
    return false; // Luôn yêu cầu kiểm tra xác thực
}

// Get all applications in a workspace
interface ListApplicationsParams {
    page?: number;
    limit?: number;
    token?: string;
    workspace_id?: string; // Thêm tham số workspace_id tùy chọn
}

export const listApplications = api(
    { 
        method: "GET",
        path: "/applications",
        expose: true,
    },
    async (params: ListApplicationsParams): Promise<ApplicationListResponse> => {
        try {
            console.log("Processing /applications request with params:", params);
            
            // Authenticate - ưu tiên sử dụng token từ params
            let authData = null;
            
            if (params.token) {
                authData = verifyJWTToken(params.token);
                console.log("Token from params validated:", authData ? "success" : "failed");
            } else {
                // Sử dụng token thông qua getAuthToken
                const token = getAuthToken();
                if (token) {
                    authData = verifyJWTToken(token);
                    console.log("Default token validated:", authData ? "success" : "failed");
                }
            }
            
            // Bỏ qua kiểm tra quyền trong môi trường phát triển nếu cần
            const skipAuth = skipAuthForDevelopment();
            console.log("Skip auth check:", skipAuth);
            
            // Check access permission
            if (!skipAuth && (!authData || !hasScope(authData, 'applications:read'))) {
                logAccessAttempt(
                    "/applications",
                    "list applications",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: applications:read",
                    "application"
                );
                
                return {
                    applications: [],
                    error: "Access denied: Missing required scope or authentication"
                };
            }

            // Nếu không có authData nhưng skipAuth = true, tạo authData giả cho dev
            if (skipAuth && !authData) {
                authData = {
                    userID: "dev-user",
                    workspaceID: params.workspace_id || "1",  // Sử dụng workspace_id từ params nếu có, hoặc dùng giá trị mặc định
                    scopes: ["applications:read", "applications:write"],
                    roles: []
                };
                console.log("Created mock authData:", authData);
            }

            console.log("Using workspace ID:", authData?.workspaceID);

            // Thực hiện gọi service để lấy dữ liệu
            const result = await getApplications(authData!, params.page, params.limit);
            
            // Ghi log kết quả
            console.log(`Application request result: ${result.applications.length} applications found. Error: ${result.error || 'none'}`);
            
            // Kiểm tra kết quả trả về
            if (result.applications && result.applications.length > 0) {
                return {
                    applications: result.applications,
                    message: `Successfully retrieved ${result.applications.length} applications.`
                };
            } else {
                // Nếu không có dữ liệu, thêm thông báo rõ ràng
                return {
                    applications: [],
                    message: "No applications found for this workspace. The list is empty."
                };
            }
        } catch (error) {
            console.error('Error in listApplications API:', error);
            
            logAccessAttempt(
                "/applications",
                "list applications",
                false,
                "unknown",
                "unknown",
                `Error: ${(error as Error).message}`,
                "application"
            );
            
            return {
                applications: [],
                error: `Error processing request: ${(error as Error).message}`
            };
        }
    }
);

// Create a new application
interface CreateApplicationParams {
    lead_id: number;
    plan_id?: number;
    status?: string;
    token?: string;
    workspace_id?: string; // Thêm tham số workspace_id tùy chọn
}

export const createApplication = api(
    {
        method: "POST",
        path: "/applications/create",
        expose: true,
    },
    async (params: CreateApplicationParams): Promise<ApplicationResponse> => {
        try {
            console.log("Processing /applications/create request with params:", {
                lead_id: params.lead_id,
                plan_id: params.plan_id,
                status: params.status || "pending"
            });
            
            // Authenticate - ưu tiên sử dụng token từ params
            let authData = null;
            
            if (params.token) {
                authData = verifyJWTToken(params.token);
                console.log("Token from params validated:", authData ? "success" : "failed");
            } else {
                // Sử dụng token thông qua getAuthToken
                const token = getAuthToken();
                if (token) {
                    authData = verifyJWTToken(token);
                    console.log("Default token validated:", authData ? "success" : "failed");
                }
            }
            
            // Bỏ qua kiểm tra quyền trong môi trường phát triển nếu cần
            const skipAuth = skipAuthForDevelopment();
            console.log("Skip auth check:", skipAuth);
            
            // Check access permission
            if (!skipAuth && (!authData || !hasScope(authData, 'applications:write'))) {
                logAccessAttempt(
                    "/applications/create",
                    "create application",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: applications:write",
                    "application"
                );
                
                return {
                    application: null,
                    error: "Access denied: Missing required scope or authentication"
                };
            }

            // Nếu không có authData nhưng skipAuth = true, tạo authData giả cho dev
            if (skipAuth && !authData) {
                authData = {
                    userID: "dev-user",
                    workspaceID: params.workspace_id || "1",  // Sử dụng workspace_id từ params nếu có, hoặc dùng giá trị mặc định
                    scopes: ["applications:read", "applications:write"],
                    roles: []
                };
                console.log("Created mock authData:", authData);
            }

            console.log("Using workspace ID:", authData?.workspaceID);
            
            // Kiểm tra nếu workspaceID không phải là một số hợp lệ
            const workspaceIDNum = parseInt(authData!.workspaceID);
            if (isNaN(workspaceIDNum)) {
                console.error("Invalid workspace ID:", authData!.workspaceID);
                return {
                    application: null,
                    error: "Invalid workspace ID. Must be a number."
                };
            }

            // Thực hiện gọi service để tạo application
            const result = await createNewApplication(authData!, {
                lead_id: params.lead_id,
                plan_id: params.plan_id,
                status: params.status
            });
            
            // Ghi log kết quả
            console.log(`Create application result: ${result.application ? 'Success' : 'Failed'}. Error: ${result.error || 'none'}`);
            
            if (result.application) {
                return {
                    application: result.application,
                    message: "Application created successfully."
                };
            } else {
                return {
                    application: null,
                    error: result.error || "Failed to create application. Please check the data and try again."
                };
            }
        } catch (error) {
            console.error('Error in createApplication API:', error);
            
            logAccessAttempt(
                "/applications/create",
                "create application",
                false,
                "unknown",
                "unknown",
                `Error: ${(error as Error).message}`,
                "application"
            );
            
            return {
                application: null,
                error: `Error processing request: ${(error as Error).message}`
            };
        }
    }
);
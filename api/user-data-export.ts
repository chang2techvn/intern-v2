import { api } from "encore.dev/api";
import { verifyJWTToken, hasScope, AuthData } from "../auth/index";
import { logAccessAttempt } from "../services";
import pool from "../db/database";

/**
 * Tham số cho endpoint xuất dữ liệu người dùng
 */
interface UserDataExportParams {
    token?: string;
    user_id?: string;
    email?: string;
    format?: 'json' | 'csv';
}

/**
 * Phản hồi từ endpoint xuất dữ liệu người dùng
 */
interface UserDataExportResponse {
    success: boolean;
    data?: Record<string, any>;
    export_id?: string;
    download_url?: string;
    error?: string | null;
}

/**
 * Tham số cho endpoint tải xuống dữ liệu người dùng
 */
interface UserDataDownloadParams {
    export_id: string;
    format?: 'json' | 'csv';
    token?: string;
}

/**
 * Phản hồi từ endpoint tải xuống dữ liệu người dùng
 */
interface UserDataDownloadResponse {
    success: boolean;
    contentType?: string;
    fileName?: string;
    data?: any;
    error?: string | null;
}

/**
 * Interface đại diện cho cấu trúc bản ghi quote từ cơ sở dữ liệu
 */
interface QuoteRecord {
    id: number;
    quote_id: number;
    offer_id: number;
    lead_id: number;
    agent_id: string;
    status: string;
    quoted_price?: string;
    final_price?: string;
    workspace_id: number;
    [key: string]: any; // Các trường khác
}

/**
 * Interface đại diện cho cấu trúc bản ghi offer từ cơ sở dữ liệu
 */
interface OfferRecord {
    id: number;
    application_id: number;
    workspace_id: number;
    [key: string]: any; // Các trường khác
}

/**
 * Tạo ID xuất dữ liệu duy nhất
 */
function generateExportId(): string {
    return `export-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Hàm chuyển đổi dữ liệu thành CSV
 */
function convertToCSV(data: Record<string, any>): string {
    const csvParts: string[] = [];
    
    for (const [category, items] of Object.entries(data)) {
        csvParts.push(`# ${category}`);
        
        if (Array.isArray(items)) {
            // Xử lý mảng các đối tượng
            if (items.length > 0) {
                // Lấy tiêu đề từ khóa của đối tượng đầu tiên
                const headers = Object.keys(items[0]).join(',');
                csvParts.push(headers);
                
                // Thêm dữ liệu từng dòng
                items.forEach(item => {
                    const values = Object.values(item).join(',');
                    csvParts.push(values);
                });
            }
        } else if (typeof items === 'object' && items !== null) {
            // Xử lý đối tượng đơn lẻ
            const headers = Object.keys(items).join(',');
            csvParts.push(headers);
            
            const values = Object.values(items).join(',');
            csvParts.push(values);
        }
        
        // Thêm dòng trống giữa các phần
        csvParts.push('');
    }
    
    return csvParts.join('\n');
}

// Helper function để lấy token xác thực
function getAuthToken(): string | null {
    try {
        // Sử dụng token từ process.env hoặc một phương thức khác
        return process.env.AUTH_TOKEN || null;
    } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
    }
}

/**
 * Hàm thu thập dữ liệu người dùng từ các bảng
 */
async function collectUserData(authData: AuthData, userId: string): Promise<Record<string, any>> {
    const client = await pool.connect();
    try {
        console.log(`Collecting data for user ID: ${userId} in workspace ID: ${authData.workspaceID}`);
        
        // Thu thập thông tin cá nhân
        const userData = {
            personal_info: {},
            leads: [],
            applications: [],
            quotes: [],
            activities: []
        };
        
        // Lấy thông tin từ các bảng khác nhau
        
        // 1. Thông tin cá nhân từ bảng users (nếu có)
        // Lưu ý: Dự án hiện tại không có bảng users nên chỉ sử dụng thông tin từ JWT token
        userData.personal_info = {
            user_id: userId,
            workspace_id: authData.workspaceID,
            scopes: authData.scopes,
            roles: authData.roles
        };
        
        // 2. Lấy quotes của người dùng trước (vì sẽ dùng để lọc leads và applications)
        const quotesResult = await client.query(
            'SELECT * FROM quote_analytics WHERE workspace_id = $1 AND agent_id = $2',
            [parseInt(authData.workspaceID), userId]
        );
        userData.quotes = quotesResult.rows;
        console.log(`Found ${quotesResult.rows.length} quotes for user ${userId}`);
        
        // 3. Trích xuất tất cả lead_ids từ quotes để lọc leads
        const leadIdsFromQuotes = new Set(
            quotesResult.rows.map((quote: QuoteRecord) => quote.lead_id)
        );
        
        // 4. Lấy các leads liên quan đến người dùng (dựa trên quotes)
        if (leadIdsFromQuotes.size > 0) {
            // Chuyển Set thành array để sử dụng trong câu truy vấn SQL
            const leadIdsArray = Array.from(leadIdsFromQuotes);
            const leadsResult = await client.query(
                'SELECT * FROM lead WHERE workspace_id = $1 AND id = ANY($2::int[])',
                [parseInt(authData.workspaceID), leadIdsArray]
            );
            userData.leads = leadsResult.rows;
            console.log(`Found ${leadsResult.rows.length} leads related to user ${userId}'s quotes`);
        }
        
        // 5. Activities - chỉ lấy activities mà người dùng đã thực hiện
        const activitiesResult = await client.query(
            'SELECT * FROM quote_audit WHERE workspace_id = $1 AND user_id = $2',
            [parseInt(authData.workspaceID), userId]
        );
        userData.activities = activitiesResult.rows;
        console.log(`Found ${activitiesResult.rows.length} activities for user ${userId}`);
        
        // 6. Lấy tất cả các quote_ids để tìm applications liên quan
        const quoteIds = quotesResult.rows.map((quote: QuoteRecord) => quote.offer_id).filter((id: number | null) => id);
        
        // 7. Lấy applications dựa trên offers (từ quotes)
        if (quoteIds.length > 0) {
            // Đầu tiên lấy offers dựa trên quote_ids (offer_id)
            const offersResult = await client.query(
                'SELECT * FROM offer WHERE workspace_id = $1 AND id = ANY($2::int[])',
                [parseInt(authData.workspaceID), quoteIds]
            );
            console.log(`Found ${offersResult.rows.length} offers related to user ${userId}'s quotes`);
            
            // Sau đó lấy các application_ids từ offers
            const applicationIds = offersResult.rows
                .map((offer: OfferRecord) => offer.application_id)
                .filter((id: number | null) => id);
            
            // Cuối cùng lấy applications dựa trên application_ids
            if (applicationIds.length > 0) {
                const applicationsResult = await client.query(
                    'SELECT * FROM application WHERE workspace_id = $1 AND id = ANY($2::int[])',
                    [parseInt(authData.workspaceID), applicationIds]
                );
                userData.applications = applicationsResult.rows;
                console.log(`Found ${applicationsResult.rows.length} applications related to user ${userId}`);
            }
        }
        
        return userData;
    } catch (error) {
        console.error(`Error collecting user data for user ${userId}:`, error);
        return {
            personal_info: {
                user_id: userId,
                workspace_id: authData.workspaceID,
                scopes: authData.scopes,
                roles: authData.roles
            },
            error: `Error collecting data: ${(error as Error).message}`
        };
    } finally {
        client.release();
    }
}

/**
 * Endpoint xuất dữ liệu người dùng theo GDPR/CCPA
 * Cho phép người dùng yêu cầu xuất toàn bộ dữ liệu cá nhân của họ từ hệ thống
 */
export const exportUserData = api(
    {
        method: "POST",
        path: "/user-data/export",
        expose: true,
    },
    async (params: UserDataExportParams): Promise<UserDataExportResponse> => {
        try {
            console.log("Processing /user-data/export request with params:", {
                user_id: params.user_id,
                email: params.email,
                format: params.format || 'json'
            });
            
            // Xác thực người dùng
            let authData: AuthData | null = null;
            
            if (params.token) {
                authData = verifyJWTToken(params.token);
            } else {
                const token = getAuthToken();
                if (token) {
                    authData = verifyJWTToken(token);
                }
            }
            
            // Kiểm tra quyền truy cập
            if (!authData || !hasScope(authData, 'user:export')) {
                logAccessAttempt(
                    "/user-data/export",
                    "export user data",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: user:export",
                    "user-data"
                );
                
                return {
                    success: false,
                    error: "Access denied: Missing required scope or authentication"
                };
            }
            
            // Xác định user_id: ưu tiên từ tham số, nếu không có thì dùng từ token
            const targetUserId = params.user_id || authData.userID;
            
            // Thu thập dữ liệu người dùng từ các bảng khác nhau
            const userData = await collectUserData(authData, targetUserId);
            
            // Tạo ID xuất duy nhất
            const exportId = generateExportId();
            
            // Ghi log truy cập thành công
            logAccessAttempt(
                "/user-data/export",
                "export user data",
                true,
                authData.userID,
                authData.workspaceID,
                `User data exported successfully with ID: ${exportId} for user ${targetUserId}`,
                "user-data"
            );
            
            // Trả về kết quả
            return {
                success: true,
                data: userData,
                export_id: exportId,
                download_url: `/user-data/download/${exportId}`,
                error: null
            };
        } catch (error) {
            console.error('Error in exportUserData API:', error);
            
            return {
                success: false,
                error: `Error processing request: ${(error as Error).message}`
            };
        }
    }
);

/**
 * Endpoint tải xuống dữ liệu người dùng theo GDPR/CCPA
 * Cho phép người dùng tải xuống dữ liệu đã được xuất trước đó
 */
export const downloadUserData = api(
    {
        method: "GET",
        path: "/user-data/download/:export_id",
        expose: true,
    },
    async (params: UserDataDownloadParams): Promise<UserDataDownloadResponse> => {
        try {
            // Xác thực người dùng
            let authData: AuthData | null = null;
            
            if (params.token) {
                authData = verifyJWTToken(params.token);
            } else {
                const token = getAuthToken();
                if (token) {
                    authData = verifyJWTToken(token);
                }
            }
            
            // Kiểm tra quyền truy cập
            if (!authData || !hasScope(authData, 'user:export')) {
                logAccessAttempt(
                    `/user-data/download/${params.export_id}`,
                    "download user data",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: user:export",
                    "user-data"
                );
                
                return {
                    success: false,
                    error: "Access denied"
                };
            }
            
            // Ở đây bạn sẽ tải dữ liệu từ nơi lưu trữ tạm thời hoặc tạo lại
            // Trong trường hợp thực tế, bạn có thể lưu trữ bản xuất dữ liệu trong một thời gian ngắn
            
            // Giả lập việc tải dữ liệu theo export_id
            const userData = await collectUserData(authData, authData.userID);
            
            // Định dạng dữ liệu theo yêu cầu
            const format = params.format || 'json';
            
            if (format === 'csv') {
                // Chuyển đổi sang CSV
                const csvData = convertToCSV(userData);
                
                return {
                    success: true,
                    contentType: 'text/csv',
                    fileName: `user-data-${authData.userID}.csv`,
                    data: csvData,
                    error: null
                };
            } else {
                // Trả về dạng JSON
                return {
                    success: true,
                    contentType: 'application/json',
                    fileName: `user-data-${authData.userID}.json`,
                    data: userData,
                    error: null
                };
            }
        } catch (error) {
            console.error('Error in downloadUserData API:', error);
            
            return {
                success: false,
                error: `Error processing download: ${(error as Error).message}`
            };
        }
    }
);
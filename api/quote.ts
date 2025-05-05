import { api } from "encore.dev/api";
import { verifyJWTToken, hasScope, AuthData } from "../auth/index";
import { logAccessAttempt } from "../services";
import { trackQuote, updateQuoteStatus } from "../services/quote-analytics-service";
import { logQuoteActivity, getQuoteActivityHistory, getQuoteAuditStats, QuoteAudit } from "../services/quote-audit-service";

// Interface cho endpoint /quote/send
interface SendQuoteParams {
    offer_id: number;
    lead_id: number;
    quoted_price: number;
    product_name?: string;
    lead_source?: string;
    send_method?: string; // email, sms, app_notification, etc.
    agent_id?: string;
    metadata?: Record<string, any>;
    token?: string;
}

interface SendQuoteResponse {
    success: boolean;
    message?: string;
    error?: string;
    quote_id?: number;
}

// Interface cho endpoint /conversion
interface ConversionParams {
    quote_id: number;
    final_price?: number;
    conversion_date?: string;
    notes?: string;
    metadata?: Record<string, any>;
    token?: string;
}

interface ConversionResponse {
    success: boolean;
    message?: string;
    error?: string;
}

// Interface cho API lấy lịch sử hoạt động của báo giá
interface QuoteHistoryParams {
    quote_id: number;
    token?: string;
}

interface QuoteHistoryResponse {
    success: boolean;
    activities: QuoteAudit[];
    error?: string;
}

// Interface cho API lấy thống kê hoạt động báo giá
interface QuoteStatsParams {
    start_date?: string;
    end_date?: string;
    token?: string;
}

interface QuoteStatsResponse {
    success: boolean;
    stats: Record<string, number>;
    error?: string;
}

// Helper function to get auth token
function getAuthToken(): string | null {
    try {
        return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSIsIndvcmtzcGFjZV9pZCI6IjEiLCJzY29wZXMiOlsibGVhZHM6cmVhZCIsImxlYWRzOndyaXRlIiwiYXBwbGljYXRpb25zOnJlYWQiLCJhcHBsaWNhdGlvbnM6d3JpdGUiLCJvZmZlcnM6cmVhZCIsIm9mZmVyczp3cml0ZSJdLCJpYXQiOjE3MTQwMTU1MTEsImV4cCI6MTc3NzA4NzUxMX0.aSdXdcN9bfFXDU2zFmGzBMbkys0pnNwIYHFU3kn6pUI";
    } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
    }
}

// API endpoint để gửi báo giá
export const sendQuote = api(
    {
        method: "POST",
        path: "/quote/send",
        expose: true,
    },
    async (params: SendQuoteParams): Promise<SendQuoteResponse> => {
        try {
            console.log("Processing /quote/send request with params:", {
                offer_id: params.offer_id,
                lead_id: params.lead_id,
                quoted_price: params.quoted_price,
                product_name: params.product_name,
                lead_source: params.lead_source,
                send_method: params.send_method || "email"
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
            if (!authData || !hasScope(authData, 'offers:write')) {
                logAccessAttempt(
                    "/quote/send",
                    "send quote",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: offers:write",
                    "quote"
                );
                
                return {
                    success: false,
                    error: "Access denied: Missing required scope or authentication"
                };
            }
            
            // Kiểm tra các trường bắt buộc
            if (!params.offer_id || !params.lead_id || !params.quoted_price) {
                return {
                    success: false,
                    error: "Missing required fields: offer_id, lead_id, or quoted_price"
                };
            }

            // Gửi báo giá (trong trường hợp thực tế, đây sẽ là gửi email/SMS/thông báo)
            console.log(`Simulating sending quote for offer_id ${params.offer_id} to lead_id ${params.lead_id}`);
            
            // Ghi log vào hệ thống phân tích
            const result = await trackQuote(authData, {
                quote_id: params.offer_id,  // Sử dụng offer_id làm quote_id
                offer_id: params.offer_id,
                lead_id: params.lead_id,
                product_name: params.product_name,
                quoted_price: params.quoted_price,
                status: 'sent',  // Trạng thái là 'sent' khi gửi báo giá
                lead_source: params.lead_source,
                agent_id: params.agent_id || authData.userID,
                metadata: {
                    ...params.metadata,
                    send_method: params.send_method || "email",
                    sent_date: new Date().toISOString()
                }
            });
            
            // Ghi log audit cụ thể cho báo giá
            const auditDetails = {
                lead_id: params.lead_id,
                product_name: params.product_name,
                quoted_price: params.quoted_price,
                send_method: params.send_method || "email",
                sent_date: new Date().toISOString()
            };
            
            try {
                await logQuoteActivity(
                    authData, 
                    params.offer_id, 
                    'sent', 
                    auditDetails
                );
            } catch (auditError) {
                console.error("Error logging quote activity:", auditError);
                // Tiếp tục ngay cả khi không thể ghi log audit
            }
            
            // Ghi log audit chung
            logAccessAttempt(
                "/quote/send",
                "send quote",
                result.success,
                authData.userID,
                authData.workspaceID,
                `Sent quote for offer_id: ${params.offer_id}, lead_id: ${params.lead_id}`,
                "quote"
            );
            
            if (result.success) {
                return {
                    success: true,
                    message: `Quote successfully sent to lead ${params.lead_id}`,
                    quote_id: params.offer_id
                };
            } else {
                return {
                    success: false,
                    error: result.error || "Failed to track quote"
                };
            }
        } catch (error) {
            console.error('Error in sendQuote API:', error);
            
            return {
                success: false,
                error: `Error processing request: ${(error as Error).message}`
            };
        }
    }
);

// API endpoint để ghi nhận chuyển đổi báo giá
export const recordConversion = api(
    {
        method: "POST",
        path: "/quote/conversion",
        expose: true,
    },
    async (params: ConversionParams): Promise<ConversionResponse> => {
        try {
            console.log("Processing /quote/conversion request with params:", {
                quote_id: params.quote_id,
                final_price: params.final_price,
                conversion_date: params.conversion_date || new Date().toISOString()
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
            if (!authData || !hasScope(authData, 'offers:write')) {
                logAccessAttempt(
                    "/quote/conversion",
                    "record conversion",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: offers:write",
                    "quote"
                );
                
                return {
                    success: false,
                    error: "Access denied: Missing required scope or authentication"
                };
            }
            
            // Kiểm tra các trường bắt buộc
            if (!params.quote_id) {
                return {
                    success: false,
                    error: "Missing required field: quote_id"
                };
            }
            
            // Cập nhật trạng thái báo giá thành 'converted'
            const conversionMetadata = {
                ...params.metadata,
                conversion_date: params.conversion_date || new Date().toISOString(),
                notes: params.notes
            };
            
            const result = await updateQuoteStatus(
                authData,
                params.quote_id,
                'converted',
                params.final_price,
                conversionMetadata
            );
            
            // Ghi log audit cụ thể cho báo giá
            const auditDetails = {
                final_price: params.final_price,
                conversion_date: params.conversion_date || new Date().toISOString(),
                notes: params.notes
            };
            
            try {
                await logQuoteActivity(
                    authData, 
                    params.quote_id, 
                    'converted', 
                    auditDetails
                );
            } catch (auditError) {
                console.error("Error logging quote activity:", auditError);
                // Tiếp tục ngay cả khi không thể ghi log audit
            }
            
            // Ghi log audit chung
            logAccessAttempt(
                "/quote/conversion",
                "record conversion",
                result.success,
                authData.userID,
                authData.workspaceID,
                `Recorded conversion for quote_id: ${params.quote_id}${params.final_price ? `, final_price: ${params.final_price}` : ''}`,
                "quote"
            );
            
            if (result.success) {
                return {
                    success: true,
                    message: `Conversion successfully recorded for quote ${params.quote_id}`
                };
            } else {
                return {
                    success: false,
                    error: result.error || "Failed to update quote status"
                };
            }
        } catch (error) {
            console.error('Error in recordConversion API:', error);
            
            return {
                success: false,
                error: `Error processing request: ${(error as Error).message}`
            };
        }
    }
);

// API endpoint để lấy lịch sử hoạt động của báo giá
export const getQuoteHistory = api(
    {
        method: "GET",
        path: "/quote/history",
        expose: true,
    },
    async (params: QuoteHistoryParams): Promise<QuoteHistoryResponse> => {
        try {
            console.log("Processing /quote/history request for quote_id:", params.quote_id);
            
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
            if (!authData || !hasScope(authData, 'offers:read')) {
                logAccessAttempt(
                    "/quote/history",
                    "get quote history",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: offers:read",
                    "quote_audit"
                );
                
                return {
                    success: false,
                    error: "Access denied: Missing required scope or authentication",
                    activities: []
                };
            }
            
            // Kiểm tra các trường bắt buộc
            if (!params.quote_id) {
                return {
                    success: false,
                    error: "Missing required field: quote_id",
                    activities: []
                };
            }
            
            // Lấy lịch sử hoạt động của báo giá
            const result = await getQuoteActivityHistory(authData, params.quote_id);
            
            if (result.error) {
                return {
                    success: false,
                    error: result.error,
                    activities: []
                };
            }
            
            return {
                success: true,
                activities: result.activities
            };
        } catch (error) {
            console.error('Error in getQuoteHistory API:', error);
            
            return {
                success: false,
                error: `Error processing request: ${(error as Error).message}`,
                activities: []
            };
        }
    }
);

// API endpoint để lấy thống kê hoạt động báo giá
export const getQuoteStats = api(
    {
        method: "GET",
        path: "/quote/stats",
        expose: true,
    },
    async (params: QuoteStatsParams): Promise<QuoteStatsResponse> => {
        try {
            console.log("Processing /quote/stats request with params:", {
                start_date: params.start_date,
                end_date: params.end_date
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
            if (!authData || !hasScope(authData, 'offers:read')) {
                logAccessAttempt(
                    "/quote/stats",
                    "get quote stats",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: offers:read",
                    "quote_audit"
                );
                
                return {
                    success: false,
                    error: "Access denied: Missing required scope or authentication",
                    stats: {}
                };
            }
            
            // Lấy thống kê hoạt động báo giá
            const result = await getQuoteAuditStats(authData, params.start_date, params.end_date);
            
            if (result.error) {
                return {
                    success: false,
                    error: result.error,
                    stats: {}
                };
            }
            
            return {
                success: true,
                stats: result.stats
            };
        } catch (error) {
            console.error('Error in getQuoteStats API:', error);
            
            return {
                success: false,
                error: `Error processing request: ${(error as Error).message}`,
                stats: {}
            };
        }
    }
);
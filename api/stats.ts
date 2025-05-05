import { api } from "encore.dev/api";
import { verifyJWTToken, hasScope, AuthData } from "../auth/index";
import { logAccessAttempt } from "../services";
import { getQuoteStats } from "../services/quote-analytics-service";

// Interface cho endpoint /stats/quote-rate
interface QuoteRateParams {
    start_date?: string;
    end_date?: string;
    product_name?: string;
    lead_source?: string;
    agent_id?: string;
    group_by?: 'day' | 'month';
    token?: string;
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

// API endpoint để trả về thông tin tỷ lệ chuyển đổi báo giá theo tenant
export const getQuoteRate = api(
    {
        method: "GET",
        path: "/stats/quote-rate",
        expose: true,
    },
    async (params: QuoteRateParams) => {
        try {
            console.log("Processing /stats/quote-rate request with params:", {
                start_date: params.start_date,
                end_date: params.end_date,
                product_name: params.product_name,
                lead_source: params.lead_source,
                agent_id: params.agent_id,
                group_by: params.group_by
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
                    "/stats/quote-rate",
                    "get quote rate statistics",
                    false,
                    authData?.userID || "unknown",
                    authData?.workspaceID || "unknown",
                    "Missing required scope: offers:read",
                    "stats"
                );
                
                return {
                    success: false,
                    error: "Access denied: Missing required scope or authentication",
                    stats: null
                };
            }
            
            // Lấy thông tin thống kê tỷ lệ chuyển đổi báo giá
            const result = await getQuoteStats(authData, {
                start_date: params.start_date,
                end_date: params.end_date,
                product_name: params.product_name,
                lead_source: params.lead_source,
                agent_id: params.agent_id,
                group_by: params.group_by
            });
            
            if (result.error) {
                return {
                    success: false,
                    error: result.error,
                    stats: null
                };
            }
            
            // Ghi log truy cập
            logAccessAttempt(
                "/stats/quote-rate",
                "get quote rate statistics",
                true,
                authData.userID,
                authData.workspaceID,
                `Retrieved quote rate statistics with filters: ${Object.keys(params).filter(key => key !== 'token').join(', ')}`,
                "stats"
            );
            
            // Thêm dữ liệu dashboard mô phỏng (thông tin dashboard cho frontend)
            const dashboardData = {
                charts: [
                    {
                        type: "line",
                        title: "Conversion Rate Trend",
                        data: result.stats.date_breakdown || {}
                    },
                    {
                        type: "pie",
                        title: "Product Conversion Distribution",
                        data: result.stats.product_breakdown || {}
                    },
                    {
                        type: "bar",
                        title: "Lead Source Performance",
                        data: result.stats.source_breakdown || {}
                    },
                    {
                        type: "area",
                        title: "Monthly Performance",
                        data: result.stats.month_breakdown || {}
                    }
                ],
                summary: {
                    total_quotes: result.stats.total_quotes,
                    total_converted: result.stats.total_converted,
                    conversion_rate: result.stats.conversion_rate,
                    average_quote_price: result.stats.average_quote_price,
                    average_final_price: result.stats.average_final_price,
                    average_conversion_time: result.stats.average_conversion_time,
                    average_discount_percentage: result.stats.average_discount_percentage
                },
                last_updated: new Date().toISOString()
            };
            
            return {
                success: true,
                stats: result.stats,
                dashboard: dashboardData
            };
        } catch (error) {
            console.error('Error in getQuoteRate API:', error);
            
            return {
                success: false,
                error: `Error processing request: ${(error as Error).message}`,
                stats: null
            };
        }
    }
);
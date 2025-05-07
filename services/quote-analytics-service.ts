import pool from '../db/database';
import { AuthData } from "../auth/index";
import { logAccessAttempt } from './admin-service';

/**
 * Interface cho dữ liệu quote analytics
 */
export interface QuoteAnalytics {
    id?: number;
    quote_id: number;
    offer_id: number;
    lead_id: number;
    workspace_id?: number;
    product_id?: number;
    product_name?: string;
    quoted_price?: number;
    final_price?: number;
    status: string;
    conversion_time_seconds?: number;
    lead_source?: string;
    agent_id?: string;
    metadata?: Record<string, any>;
    created_at?: Date;
    updated_at?: Date;
    // Thêm các trường mới
    duration_months?: number;
    quote_date?: string;
    quote_month?: string;
    discount_percentage?: number;
}

/**
 * Interface cho dữ liệu thống kê quote
 */
export interface QuoteStats {
    total_quotes: number;
    total_converted: number;
    conversion_rate: number;
    average_quote_price?: number;
    average_final_price?: number;
    average_conversion_time?: number;
    // Thêm các trường thống kê mới
    average_discount_percentage?: number;
    product_breakdown?: Record<string, {
        total: number;
        converted: number;
        rate: number;
        avg_discount?: number;
    }>;
    source_breakdown?: Record<string, {
        total: number;
        converted: number;
        rate: number;
    }>;
    date_breakdown?: Record<string, {
        total: number;
        converted: number;
        rate: number;
    }>;
    // Thêm thống kê theo tháng
    month_breakdown?: Record<string, {
        total: number;
        converted: number;
        rate: number;
    }>;
}

/**
 * Interface cho các bộ lọc thống kê
 */
interface QuoteStatsFilter {
    start_date?: string;
    end_date?: string;
    product_id?: number;
    product_name?: string;  // Sửa kiểu dữ liệu từ number thành string
    agent_id?: string;
    lead_source?: string;
    group_by?: 'day' | 'month';  // Thêm tùy chọn nhóm theo ngày hoặc tháng
}

/**
 * Ghi thông tin báo giá vào bảng phân tích
 */
export async function trackQuote(
    authData: AuthData,
    quoteData: Omit<QuoteAnalytics, 'workspace_id'>
): Promise<{ success: boolean; error?: string }> {
    try {
        // Lấy workspace_id từ token xác thực
        const workspaceId = parseInt(authData.workspaceID);
        
        // Kiểm tra các trường bắt buộc
        if (!quoteData.quote_id || !quoteData.offer_id || !quoteData.lead_id || !quoteData.status) {
            return {
                success: false,
                error: "Missing required fields: quote_id, offer_id, lead_id, or status"
            };
        }
        
        const client = await pool.connect();
        try {
            // Trích xuất duration_months từ metadata nếu có
            let durationMonths = quoteData.duration_months;
            if (!durationMonths && quoteData.metadata && quoteData.metadata.duration_months) {
                durationMonths = quoteData.metadata.duration_months;
                // Xóa duration_months ra khỏi metadata để tránh trùng lặp
                const { duration_months, ...restMetadata } = quoteData.metadata;
                quoteData.metadata = restMetadata;
            }
            
            // Chuẩn bị dữ liệu để chèn vào bảng
            const result = await client.query(
                `INSERT INTO quote_analytics 
                (quote_id, offer_id, lead_id, workspace_id, product_id, product_name, quoted_price, 
                final_price, status, conversion_time_seconds, lead_source, agent_id, metadata, duration_months) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id`,
                [
                    quoteData.quote_id,
                    quoteData.offer_id,
                    quoteData.lead_id,
                    workspaceId,
                    quoteData.product_id || null,
                    quoteData.product_name || null,
                    quoteData.quoted_price || null,
                    quoteData.final_price || null,
                    quoteData.status,
                    quoteData.conversion_time_seconds || null,
                    quoteData.lead_source || null,
                    quoteData.agent_id || authData.userID || null,
                    quoteData.metadata ? JSON.stringify(quoteData.metadata) : '{}',
                    durationMonths || null
                ]
            );
            
            // Luôn refresh materialized views sau khi thêm dữ liệu mới
            try {
                await client.query('SELECT refresh_quote_analytics_stats()');
                console.log(`Refreshed materialized views after tracking quote_id: ${quoteData.quote_id}`);
            } catch (refreshError) {
                // Nếu có lỗi khi refresh, ghi log nhưng không làm gián đoạn quy trình
                console.warn(`Warning: Failed to refresh materialized views: ${(refreshError as Error).message}`);
            }
            
            logAccessAttempt(
                "trackQuote",
                "track quote analytics",
                true,
                authData.userID,
                authData.workspaceID,
                `Tracked quote analytics for quote_id: ${quoteData.quote_id}, offer_id: ${quoteData.offer_id}`,
                "analytics"
            );
            
            return {
                success: true
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error tracking quote analytics:', error);
        
        logAccessAttempt(
            "trackQuote",
            "track quote analytics",
            false,
            authData.userID,
            authData.workspaceID,
            `Error: ${(error as Error).message}`,
            "analytics"
        );
        
        return {
            success: false,
            error: `Error tracking quote: ${(error as Error).message}`
        };
    }
}

/**
 * Cập nhật trạng thái báo giá
 */
export async function updateQuoteStatus(
    authData: AuthData,
    quoteId: number,
    status: string,
    finalPrice?: number,
    metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
    try {
        // Lấy workspace_id từ token xác thực
        const workspaceId = parseInt(authData.workspaceID);
        
        const client = await pool.connect();
        try {
            // Kiểm tra xem quote có thuộc về workspace này không
            const checkQuoteOwnership = await client.query(
                'SELECT id FROM quote_analytics WHERE quote_id = $1 AND workspace_id = $2',
                [quoteId, workspaceId]
            );
            
            if (checkQuoteOwnership.rows.length === 0) {
                return {
                    success: false,
                    error: "Quote not found or does not belong to this workspace"
                };
            }
            
            // Nếu chuyển sang trạng thái "converted", tính thời gian chuyển đổi
            let conversionTime: number | null = null;
            if (status === 'converted') {
                const quoteData = await client.query(
                    'SELECT created_at FROM quote_analytics WHERE quote_id = $1 AND workspace_id = $2',
                    [quoteId, workspaceId]
                );
                
                if (quoteData.rows.length > 0) {
                    const createdAt = new Date(quoteData.rows[0].created_at);
                    conversionTime = Math.floor((Date.now() - createdAt.getTime()) / 1000); // Thời gian chuyển đổi tính theo giây
                }
            }
            
            // Cập nhật các trường trong bảng
            let updateFields: string[] = ['status'];
            let updateValues: any[] = [status];
            let paramIndex = 3; // Bắt đầu từ $3 vì $1 là quote_id và $2 là workspace_id
            
            // Nếu có final_price, thêm vào cập nhật
            if (finalPrice !== undefined) {
                updateFields.push('final_price');
                updateValues.push(finalPrice);
                paramIndex++;
            }
            
            // Nếu có conversion_time, thêm vào cập nhật
            if (conversionTime !== null) {
                updateFields.push('conversion_time_seconds');
                updateValues.push(conversionTime);
                paramIndex++;
            }
            
            // Nếu có metadata, thêm vào cập nhật
            let metadataValue: string | null = null;
            if (metadata) {
                updateFields.push('metadata');
                metadataValue = JSON.stringify(metadata);
                updateValues.push(metadataValue);
            }
            
            // Tạo câu truy vấn cập nhật
            const updateQuery = `
                UPDATE quote_analytics 
                SET ${updateFields.map((field, index) => `${field} = $${index + 3}`).join(', ')} 
                WHERE quote_id = $1 AND workspace_id = $2
            `;
            
            // Thực hiện cập nhật
            await client.query(
                updateQuery,
                [quoteId, workspaceId, ...updateValues]
            );
            
            logAccessAttempt(
                "updateQuoteStatus",
                "update quote status",
                true,
                authData.userID,
                authData.workspaceID,
                `Updated quote status to '${status}' for quote_id: ${quoteId}`,
                "analytics"
            );
            
            return {
                success: true
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating quote status:', error);
        
        logAccessAttempt(
            "updateQuoteStatus",
            "update quote status",
            false,
            authData.userID,
            authData.workspaceID,
            `Error: ${(error as Error).message}`,
            "analytics"
        );
        
        return {
            success: false,
            error: `Error updating quote status: ${(error as Error).message}`
        };
    }
}

/**
 * Lấy thống kê về tỷ lệ chuyển đổi báo giá
 */
export async function getQuoteStats(
    authData: AuthData,
    filters: QuoteStatsFilter = {}
): Promise<{ stats: QuoteStats; error?: string }> {
    try {
        // Lấy workspace_id từ token xác thực
        const workspaceId = parseInt(authData.workspaceID);
        
        const client = await pool.connect();
        try {
            // Kiểm tra xem materialized view có tồn tại không
            const checkViewsExist = await client.query(`
                SELECT COUNT(*) > 0 AS exists 
                FROM pg_catalog.pg_class c 
                JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace 
                WHERE c.relname = 'quote_stats_monthly' 
                AND n.nspname = 'public'
            `);
            
            // Chỉ sử dụng view nếu nó tồn tại và không có lọc theo ngày
            const useViews = !filters.start_date && !filters.end_date && checkViewsExist.rows[0].exists;
            
            let statsResult, productBreakdown, sourceBreakdown;
            let dateBreakdown, monthBreakdown;
            
            if (useViews) {
                // Sử dụng materialized views nếu không có lọc theo ngày
                const statsQuery = `
                    SELECT 
                        SUM(total_quotes) AS total_quotes,
                        SUM(converted_quotes) AS total_converted,
                        AVG(avg_quoted_price) AS avg_quote_price,
                        AVG(avg_final_price) AS avg_final_price,
                        AVG(avg_conversion_time) AS avg_conversion_time,
                        AVG(avg_discount_percentage) AS avg_discount_percentage
                    FROM quote_stats_monthly
                    WHERE workspace_id = $1
                    ${filters.product_name ? ' AND product_name = $2' : ''}
                    ${filters.lead_source ? ` AND lead_source = $${filters.product_name ? 3 : 2}` : ''}
                `;
                
                const queryParams: (number | string)[] = [workspaceId];
                if (filters.product_name) queryParams.push(filters.product_name);
                if (filters.lead_source) queryParams.push(filters.lead_source);
                
                statsResult = await client.query(statsQuery, queryParams);
                
                // Lấy phân tích theo sản phẩm từ materialized view
                const productQuery = `
                    SELECT 
                        product_name AS product,
                        SUM(total_quotes) AS total,
                        SUM(converted_quotes) AS converted,
                        AVG(avg_discount_percentage) AS avg_discount
                    FROM quote_stats_monthly
                    WHERE workspace_id = $1
                    ${filters.lead_source ? ' AND lead_source = $2' : ''}
                    GROUP BY product_name
                `;
                
                const productParams: (number | string)[] = [workspaceId];
                if (filters.lead_source) productParams.push(filters.lead_source);
                
                productBreakdown = await client.query(productQuery, productParams);
                
                // Lấy phân tích theo nguồn từ materialized view
                const sourceQuery = `
                    SELECT 
                        lead_source AS source,
                        SUM(total_quotes) AS total,
                        SUM(converted_quotes) AS converted
                    FROM quote_stats_monthly
                    WHERE workspace_id = $1
                    ${filters.product_name ? ' AND product_name = $2' : ''}
                    GROUP BY lead_source
                `;
                
                const sourceParams: (number | string)[] = [workspaceId];
                if (filters.product_name) sourceParams.push(filters.product_name);
                
                sourceBreakdown = await client.query(sourceQuery, sourceParams);
                
                // Phân tích theo tháng
                monthBreakdown = await client.query(`
                    SELECT 
                        quote_month AS month,
                        SUM(total_quotes) AS total,
                        SUM(converted_quotes) AS converted
                    FROM quote_stats_monthly
                    WHERE workspace_id = $1
                    ${filters.product_name ? ' AND product_name = $2' : ''}
                    ${filters.lead_source ? ` AND lead_source = $${filters.product_name ? 3 : 2}` : ''}
                    GROUP BY quote_month
                    ORDER BY quote_month
                `, queryParams);
                
                // Phân tích theo ngày - lấy 30 ngày gần nhất
                dateBreakdown = await client.query(`
                    SELECT 
                        quote_date::TEXT AS date,
                        SUM(total_quotes) AS total,
                        SUM(converted_quotes) AS converted
                    FROM quote_stats_daily
                    WHERE workspace_id = $1
                    ${filters.product_name ? ' AND product_name = $2' : ''}
                    ${filters.lead_source ? ` AND lead_source = $${filters.product_name ? 3 : 2}` : ''}
                    AND quote_date >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY quote_date
                    ORDER BY quote_date
                `, queryParams);
            } else {
                // Sử dụng truy vấn trực tiếp khi cần lọc theo ngày
                // Xây dựng các điều kiện lọc
                const whereConditions: string[] = ['workspace_id = $1'];
                const queryParams: any[] = [workspaceId];
                let paramIndex = 2;
                
                // Thêm các điều kiện lọc
                if (filters.start_date) {
                    whereConditions.push(`created_at >= $${paramIndex}`);
                    queryParams.push(filters.start_date);
                    paramIndex++;
                }
                
                if (filters.end_date) {
                    whereConditions.push(`created_at <= $${paramIndex}`);
                    queryParams.push(filters.end_date);
                    paramIndex++;
                }
                
                if (filters.product_id !== undefined) {
                    whereConditions.push(`product_id = $${paramIndex}`);
                    queryParams.push(filters.product_id);
                    paramIndex++;
                }
                
                if (filters.product_name) {
                    whereConditions.push(`product_name = $${paramIndex}`);
                    queryParams.push(filters.product_name);
                    paramIndex++;
                }
                
                if (filters.agent_id) {
                    whereConditions.push(`agent_id = $${paramIndex}`);
                    queryParams.push(filters.agent_id);
                    paramIndex++;
                }
                
                if (filters.lead_source) {
                    whereConditions.push(`lead_source = $${paramIndex}`);
                    queryParams.push(filters.lead_source);
                    paramIndex++;
                }
                
                // Xây dựng câu truy vấn WHERE
                const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
                
                // Truy vấn tổng số báo giá và số đã chuyển đổi
                const statsQuery = `
                    SELECT 
                        COUNT(*) AS total_quotes,
                        COUNT(CASE WHEN status = 'converted' THEN 1 END) AS total_converted,
                        AVG(CASE WHEN status = 'converted' THEN quoted_price ELSE NULL END) AS avg_quote_price,
                        AVG(CASE WHEN status = 'converted' THEN final_price ELSE NULL END) AS avg_final_price,
                        AVG(CASE WHEN status = 'converted' THEN conversion_time_seconds ELSE NULL END) AS avg_conversion_time,
                        AVG(discount_percentage) AS avg_discount_percentage
                    FROM quote_analytics
                    ${whereClause}
                `;
                
                statsResult = await client.query(statsQuery, queryParams);
                
                // Phân tích chi tiết sản phẩm
                const productBreakdownQuery = `
                    SELECT 
                        COALESCE(product_name, 'Unknown') AS product,
                        COUNT(*) AS total,
                        COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted,
                        AVG(discount_percentage) AS avg_discount
                    FROM quote_analytics
                    ${whereClause}
                    GROUP BY COALESCE(product_name, 'Unknown')
                `;
                
                productBreakdown = await client.query(productBreakdownQuery, queryParams);
                
                // Phân tích chi tiết nguồn
                const sourceBreakdownQuery = `
                    SELECT 
                        COALESCE(lead_source, 'direct') AS source,
                        COUNT(*) AS total,
                        COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted
                    FROM quote_analytics
                    ${whereClause}
                    GROUP BY COALESCE(lead_source, 'direct')
                `;
                
                sourceBreakdown = await client.query(sourceBreakdownQuery, queryParams);
                
                // Phân tích theo ngày hoặc tháng tùy theo filters.group_by
                if (filters.group_by === 'month') {
                    // Phân tích theo tháng
                    monthBreakdown = await client.query(`
                        SELECT 
                            TO_CHAR(created_at, 'YYYY-MM') AS month,
                            COUNT(*) AS total,
                            COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted
                        FROM quote_analytics
                        ${whereClause}
                        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
                        ORDER BY month
                    `, queryParams);
                    
                    // Vẫn lấy thêm dữ liệu theo ngày cho 30 ngày gần nhất
                    dateBreakdown = await client.query(`
                        SELECT 
                            TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
                            COUNT(*) AS total,
                            COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted
                        FROM quote_analytics
                        ${whereClause}
                        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
                        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
                        ORDER BY date
                    `, queryParams);
                } else {
                    // Phân tích theo ngày (mặc định)
                    dateBreakdown = await client.query(`
                        SELECT 
                            TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
                            COUNT(*) AS total,
                            COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted
                        FROM quote_analytics
                        ${whereClause}
                        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
                        ORDER BY date
                    `, queryParams);
                    
                    // Vẫn lấy thêm dữ liệu theo tháng
                    monthBreakdown = await client.query(`
                        SELECT 
                            TO_CHAR(created_at, 'YYYY-MM') AS month,
                            COUNT(*) AS total,
                            COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted
                        FROM quote_analytics
                        ${whereClause}
                        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
                        ORDER BY month
                    `, queryParams);
                }
            }
            
            // Xử lý kết quả
            const { 
                total_quotes, 
                total_converted, 
                avg_quote_price, 
                avg_final_price, 
                avg_conversion_time,
                avg_discount_percentage
            } = statsResult.rows[0];
            
            // Tính tỷ lệ chuyển đổi
            const conversionRate = total_quotes > 0 ? (total_converted / total_quotes) * 100 : 0;
            
            // Tạo đối tượng product_breakdown
            const productBreakdownObj: Record<string, { 
                total: number; 
                converted: number; 
                rate: number;
                avg_discount?: number; 
            }> = {};
            
            productBreakdown.rows.forEach((row: { product: string; total: string; converted: string; avg_discount?: string }) => {
                const totalNum = parseInt(row.total);
                const convertedNum = parseInt(row.converted);
                productBreakdownObj[row.product] = {
                    total: totalNum,
                    converted: convertedNum,
                    rate: totalNum > 0 ? (convertedNum / totalNum) * 100 : 0,
                    avg_discount: row.avg_discount ? parseFloat(row.avg_discount) : undefined
                };
            });
            
            // Tạo đối tượng source_breakdown
            const sourceBreakdownObj: Record<string, { 
                total: number; 
                converted: number; 
                rate: number; 
            }> = {};
            
            sourceBreakdown.rows.forEach((row: { source: string; total: string; converted: string }) => {
                const totalNum = parseInt(row.total);
                const convertedNum = parseInt(row.converted);
                sourceBreakdownObj[row.source || 'direct'] = {
                    total: totalNum,
                    converted: convertedNum,
                    rate: totalNum > 0 ? (convertedNum / totalNum) * 100 : 0
                };
            });
            
            // Tạo đối tượng date_breakdown
            const dateBreakdownObj: Record<string, { 
                total: number; 
                converted: number; 
                rate: number; 
            }> = {};
            
            dateBreakdown.rows.forEach((row: { date: string; total: string; converted: string }) => {
                const totalNum = parseInt(row.total);
                const convertedNum = parseInt(row.converted);
                dateBreakdownObj[row.date] = {
                    total: totalNum,
                    converted: convertedNum,
                    rate: totalNum > 0 ? (convertedNum / totalNum) * 100 : 0
                };
            });
            
            // Tạo đối tượng month_breakdown
            const monthBreakdownObj: Record<string, { 
                total: number; 
                converted: number; 
                rate: number; 
            }> = {};
            
            monthBreakdown.rows.forEach((row: { month: string; total: string; converted: string }) => {
                const totalNum = parseInt(row.total);
                const convertedNum = parseInt(row.converted);
                monthBreakdownObj[row.month] = {
                    total: totalNum,
                    converted: convertedNum,
                    rate: totalNum > 0 ? (convertedNum / totalNum) * 100 : 0
                };
            });
            
            logAccessAttempt(
                "getQuoteStats",
                "get quote stats",
                true,
                authData.userID,
                authData.workspaceID,
                `Retrieved quote stats with ${Object.keys(filters).length} filters`,
                "analytics"
            );
            
            return {
                stats: {
                    total_quotes: parseInt(total_quotes || '0'),
                    total_converted: parseInt(total_converted || '0'),
                    conversion_rate: parseFloat((conversionRate || 0).toFixed(2)),
                    average_quote_price: avg_quote_price ? parseFloat(avg_quote_price) : undefined,
                    average_final_price: avg_final_price ? parseFloat(avg_final_price) : undefined,
                    average_conversion_time: avg_conversion_time ? parseFloat(avg_conversion_time) : undefined,
                    average_discount_percentage: avg_discount_percentage ? parseFloat(avg_discount_percentage) : undefined,
                    product_breakdown: productBreakdownObj,
                    source_breakdown: sourceBreakdownObj,
                    date_breakdown: dateBreakdownObj,
                    month_breakdown: monthBreakdownObj
                }
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error getting quote stats:', error);
        
        logAccessAttempt(
            "getQuoteStats",
            "get quote stats",
            false,
            authData.userID,
            authData.workspaceID,
            `Error: ${(error as Error).message}`,
            "analytics"
        );
        
        return {
            stats: {
                total_quotes: 0,
                total_converted: 0,
                conversion_rate: 0
            },
            error: `Error getting quote stats: ${(error as Error).message}`
        };
    }
}
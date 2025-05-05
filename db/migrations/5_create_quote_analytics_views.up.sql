-- Tạo các view cho bảng quote_analytics

-- Tạo materialized view để lưu trữ thống kê theo ngày
CREATE MATERIALIZED VIEW IF NOT EXISTS quote_stats_daily AS
SELECT 
   workspace_id,
   quote_date,
   product_name,
   lead_source,
   COUNT(*) AS total_quotes,
   COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted_quotes,
   SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END)::FLOAT / 
       NULLIF(COUNT(*), 0) * 100 AS conversion_rate,
   AVG(CASE WHEN status = 'converted' THEN conversion_time_seconds END) AS avg_conversion_time,
   AVG(quoted_price) AS avg_quoted_price,
   AVG(CASE WHEN status = 'converted' THEN final_price END) AS avg_final_price,
   AVG(discount_percentage) AS avg_discount_percentage
FROM quote_analytics
GROUP BY workspace_id, quote_date, product_name, lead_source;

-- Tạo chỉ mục cho materialized view
CREATE INDEX IF NOT EXISTS idx_quote_stats_daily_workspace_date ON quote_stats_daily(workspace_id, quote_date);
CREATE INDEX IF NOT EXISTS idx_quote_stats_daily_product ON quote_stats_daily(product_name);
CREATE INDEX IF NOT EXISTS idx_quote_stats_daily_lead_source ON quote_stats_daily(lead_source);

-- Tạo materialized view để lưu trữ thống kê theo tháng
CREATE MATERIALIZED VIEW IF NOT EXISTS quote_stats_monthly AS
SELECT 
   workspace_id,
   quote_month,
   product_name,
   lead_source,
   COUNT(*) AS total_quotes,
   COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted_quotes,
   SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END)::FLOAT / 
       NULLIF(COUNT(*), 0) * 100 AS conversion_rate,
   AVG(CASE WHEN status = 'converted' THEN conversion_time_seconds END) AS avg_conversion_time,
   AVG(quoted_price) AS avg_quoted_price,
   AVG(CASE WHEN status = 'converted' THEN final_price END) AS avg_final_price,
   AVG(discount_percentage) AS avg_discount_percentage
FROM quote_analytics
GROUP BY workspace_id, quote_month, product_name, lead_source;

-- Tạo chỉ mục cho materialized view
CREATE INDEX IF NOT EXISTS idx_quote_stats_monthly_workspace_month ON quote_stats_monthly(workspace_id, quote_month);
CREATE INDEX IF NOT EXISTS idx_quote_stats_monthly_product ON quote_stats_monthly(product_name);
CREATE INDEX IF NOT EXISTS idx_quote_stats_monthly_lead_source ON quote_stats_monthly(lead_source);

-- Tạo function để refresh các materialized views
CREATE OR REPLACE FUNCTION refresh_quote_analytics_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW quote_stats_daily;
  REFRESH MATERIALIZED VIEW quote_stats_monthly;
END;
$$ LANGUAGE plpgsql;
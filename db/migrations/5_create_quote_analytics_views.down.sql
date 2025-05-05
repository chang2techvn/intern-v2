-- Xóa các view và function đã tạo

-- Xóa function refresh
DROP FUNCTION IF EXISTS refresh_quote_analytics_stats();

-- Xóa materialized view thống kê theo tháng và các chỉ mục của nó
DROP INDEX IF EXISTS idx_quote_stats_monthly_workspace_month;
DROP INDEX IF EXISTS idx_quote_stats_monthly_product;
DROP INDEX IF EXISTS idx_quote_stats_monthly_lead_source;
DROP MATERIALIZED VIEW IF EXISTS quote_stats_monthly;

-- Xóa materialized view thống kê theo ngày và các chỉ mục của nó
DROP INDEX IF EXISTS idx_quote_stats_daily_workspace_date;
DROP INDEX IF EXISTS idx_quote_stats_daily_product;
DROP INDEX IF EXISTS idx_quote_stats_daily_lead_source;
DROP MATERIALIZED VIEW IF EXISTS quote_stats_daily;
-- Xóa trigger
DROP TRIGGER IF EXISTS update_quote_analytics_timestamp ON quote_analytics;

-- Xóa function
DROP FUNCTION IF EXISTS update_timestamp_column();

-- Xóa policy
DROP POLICY IF EXISTS quote_analytics_workspace_isolation_policy ON quote_analytics;

-- Xóa các foreign keys
ALTER TABLE IF EXISTS quote_analytics 
    DROP CONSTRAINT IF EXISTS fk_quote_analytics_offer;
    
ALTER TABLE IF EXISTS quote_analytics 
    DROP CONSTRAINT IF EXISTS fk_quote_analytics_lead;

-- Xóa các indexes
DROP INDEX IF EXISTS idx_quote_analytics_workspace_id;
DROP INDEX IF EXISTS idx_quote_analytics_offer_id;
DROP INDEX IF EXISTS idx_quote_analytics_lead_id;
DROP INDEX IF EXISTS idx_quote_analytics_status;
DROP INDEX IF EXISTS idx_quote_analytics_created_at;
DROP INDEX IF EXISTS idx_quote_analytics_product_id;
DROP INDEX IF EXISTS idx_quote_analytics_agent_id;
DROP INDEX IF EXISTS idx_quote_analytics_lead_source;

-- Xóa bảng quote_analytics khi rollback
DROP TABLE IF EXISTS quote_analytics;
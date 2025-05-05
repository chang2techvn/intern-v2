-- Rollback các cải tiến cho bảng quote_analytics

-- 6. Xóa các chỉ mục mới
DROP INDEX IF EXISTS idx_quote_analytics_quote_date;
DROP INDEX IF EXISTS idx_quote_analytics_quote_month;
DROP INDEX IF EXISTS idx_quote_analytics_duration_months;

-- 5. Xóa ràng buộc unique
ALTER TABLE IF EXISTS quote_analytics
DROP CONSTRAINT IF EXISTS unique_quote_offer;

-- 4. Xóa trường duration_months (dữ liệu vẫn được giữ trong metadata)
ALTER TABLE IF EXISTS quote_analytics DROP COLUMN IF EXISTS duration_months;

-- 3. Xóa trường discount_percentage và trigger liên quan
DROP TRIGGER IF EXISTS quote_analytics_discount ON quote_analytics;
DROP FUNCTION IF EXISTS update_quote_analytics_discount();
ALTER TABLE IF EXISTS quote_analytics DROP COLUMN IF EXISTS discount_percentage;

-- 2. Xóa các trường phân tích thời gian và trigger liên quan
DROP TRIGGER IF EXISTS quote_analytics_date_columns ON quote_analytics;
DROP FUNCTION IF EXISTS update_quote_analytics_date_columns();
ALTER TABLE IF EXISTS quote_analytics DROP COLUMN IF EXISTS quote_month;
ALTER TABLE IF EXISTS quote_analytics DROP COLUMN IF EXISTS quote_date;

-- 1. Xóa các ràng buộc khóa ngoại
ALTER TABLE IF EXISTS quote_analytics
DROP CONSTRAINT IF EXISTS fk_quote_analytics_offer;

ALTER TABLE IF EXISTS quote_analytics
DROP CONSTRAINT IF EXISTS fk_quote_analytics_lead;
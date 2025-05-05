-- Cải thiện bảng quote_analytics

-- 1. Thêm ràng buộc khóa ngoại để đảm bảo tính toàn vẹn dữ liệu
ALTER TABLE quote_analytics 
ADD CONSTRAINT fk_quote_analytics_offer FOREIGN KEY (offer_id) REFERENCES offer(id) ON DELETE CASCADE;

ALTER TABLE quote_analytics 
ADD CONSTRAINT fk_quote_analytics_lead FOREIGN KEY (lead_id) REFERENCES lead(id) ON DELETE CASCADE;

-- 2. Thêm các trường phân tích thời gian (thay đổi cách tiếp cận để tránh lỗi với generated columns)
ALTER TABLE quote_analytics 
ADD COLUMN quote_date DATE,
ADD COLUMN quote_month VARCHAR(7);

-- Tạo trigger để cập nhật các cột này tự động
CREATE OR REPLACE FUNCTION update_quote_analytics_date_columns()
RETURNS TRIGGER AS $$
BEGIN
    NEW.quote_date := date(NEW.created_at);
    NEW.quote_month := TO_CHAR(NEW.created_at, 'YYYY-MM');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_analytics_date_columns
BEFORE INSERT OR UPDATE ON quote_analytics
FOR EACH ROW
EXECUTE FUNCTION update_quote_analytics_date_columns();

-- Cập nhật dữ liệu hiện có
UPDATE quote_analytics
SET 
    quote_date = date(created_at),
    quote_month = TO_CHAR(created_at, 'YYYY-MM');

-- 3. Thêm chỉ số hiệu suất - tỷ lệ giảm giá khi báo giá được chốt
ALTER TABLE quote_analytics 
ADD COLUMN discount_percentage NUMERIC;

-- Tạo trigger để tính discount_percentage tự động
CREATE OR REPLACE FUNCTION update_quote_analytics_discount()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quoted_price > 0 AND NEW.final_price IS NOT NULL THEN
        NEW.discount_percentage := ((NEW.quoted_price - NEW.final_price) / NEW.quoted_price * 100);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_analytics_discount
BEFORE INSERT OR UPDATE ON quote_analytics
FOR EACH ROW
EXECUTE FUNCTION update_quote_analytics_discount();

-- Cập nhật dữ liệu hiện có
UPDATE quote_analytics
SET discount_percentage = ((quoted_price - final_price) / quoted_price * 100)
WHERE quoted_price > 0 AND final_price IS NOT NULL;

-- 4. Chuyển dữ liệu duration_months từ metadata thành cột riêng
ALTER TABLE quote_analytics ADD COLUMN duration_months INTEGER;

-- Cập nhật từ dữ liệu metadata hiện tại
UPDATE quote_analytics 
SET duration_months = (metadata->>'duration_months')::INTEGER 
WHERE metadata->>'duration_months' IS NOT NULL;

-- 5. Thêm ràng buộc unique để tránh trùng lặp dữ liệu
ALTER TABLE quote_analytics 
ADD CONSTRAINT unique_quote_offer UNIQUE (quote_id, offer_id);

-- 6. Thêm chỉ mục mới cho tối ưu truy vấn
CREATE INDEX idx_quote_analytics_quote_date ON quote_analytics(quote_date);
CREATE INDEX idx_quote_analytics_quote_month ON quote_analytics(quote_month);
CREATE INDEX idx_quote_analytics_duration_months ON quote_analytics(duration_months);
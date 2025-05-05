-- Tạo bảng quote_analytics để theo dõi quá trình chuyển đổi báo giá
CREATE TABLE IF NOT EXISTS quote_analytics (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER NOT NULL,
    offer_id INTEGER NOT NULL,
    lead_id INTEGER NOT NULL,
    workspace_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name VARCHAR(255),
    quoted_price DECIMAL(15, 2),
    final_price DECIMAL(15, 2),
    status VARCHAR(50) NOT NULL, -- pending, viewed, converted, expired, rejected
    conversion_time_seconds INTEGER,
    lead_source VARCHAR(100),
    agent_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Thêm RLS (Row Level Security) vào bảng quote_analytics
ALTER TABLE quote_analytics ENABLE ROW LEVEL SECURITY;

-- Policy để chỉ workspace có thể xem dữ liệu của mình
CREATE POLICY quote_analytics_workspace_isolation ON quote_analytics
    USING (workspace_id::TEXT = current_setting('app.current_workspace_id'));

-- Index để tối ưu truy vấn
CREATE INDEX idx_quote_analytics_workspace_id ON quote_analytics(workspace_id);
CREATE INDEX idx_quote_analytics_offer_id ON quote_analytics(offer_id);
CREATE INDEX idx_quote_analytics_lead_id ON quote_analytics(lead_id);
CREATE INDEX idx_quote_analytics_status ON quote_analytics(status);
CREATE INDEX idx_quote_analytics_created_at ON quote_analytics(created_at);
CREATE INDEX idx_quote_analytics_product_name ON quote_analytics(product_name);
CREATE INDEX idx_quote_analytics_lead_source ON quote_analytics(lead_source);

-- Trigger để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_quote_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_analytics_updated_at
BEFORE UPDATE ON quote_analytics
FOR EACH ROW
EXECUTE FUNCTION update_quote_analytics_updated_at();
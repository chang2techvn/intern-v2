-- Đảm bảo hàm get_current_workspace_id tồn tại
CREATE OR REPLACE FUNCTION get_current_workspace_id() RETURNS INTEGER AS $$
BEGIN
    RETURN nullif(current_setting('app.workspace_id', true), '')::INTEGER;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Tạo role nếu chưa có
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user;
    END IF;
END
$$;

-- Đảm bảo mission_brief có quyền app_user
GRANT app_user TO mission_brief;

-- Bật Row Level Security cho tất cả các bảng
ALTER TABLE workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE application ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer ENABLE ROW LEVEL SECURITY;

-- Xóa các policy cũ cho lead, application, offer nếu có
DROP POLICY IF EXISTS lead_isolation_policy ON lead;
DROP POLICY IF EXISTS application_isolation_policy ON application;
DROP POLICY IF EXISTS offer_isolation_policy ON offer;

-- Tạo policy mới sử dụng hàm get_current_workspace_id() cho các bảng mới
CREATE POLICY lead_isolation_policy ON lead
    FOR ALL
    TO app_user
    USING (workspace_id = get_current_workspace_id());

CREATE POLICY application_isolation_policy ON application
    FOR ALL
    TO app_user
    USING (workspace_id = get_current_workspace_id());

CREATE POLICY offer_isolation_policy ON offer
    FOR ALL
    TO app_user
    USING (workspace_id = get_current_workspace_id());

-- Tạo các policy cho admin để bypass RLS
CREATE POLICY lead_admin_policy ON lead
    FOR ALL
    TO mission_brief
    USING (true);

CREATE POLICY application_admin_policy ON application
    FOR ALL
    TO mission_brief
    USING (true);

CREATE POLICY offer_admin_policy ON offer
    FOR ALL
    TO mission_brief
    USING (true);

-- Revoke quyền từ public
REVOKE ALL ON lead FROM PUBLIC;
REVOKE ALL ON application FROM PUBLIC;
REVOKE ALL ON offer FROM PUBLIC;

-- Grant quyền cho app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON lead TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON application TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON offer TO app_user;

-- Đảm bảo mission_brief có quyền
GRANT ALL ON lead TO mission_brief;
GRANT ALL ON application TO mission_brief;
GRANT ALL ON offer TO mission_brief;

-- Kiểm tra trạng thái RLS cho các bảng
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('workspace', 'plan', 'lead', 'application', 'offer');

-- Liệt kê tất cả policies
SELECT schemaname, tablename, policyname, permissive
FROM pg_policies
WHERE tablename IN ('workspace', 'plan', 'lead', 'application', 'offer');

-- Tạo role nếu chưa có
CREATE ROLE app_user;
GRANT app_user TO mission_brief;

-- Xóa các policy cũ
DROP POLICY IF EXISTS plan_isolation_policy ON plan;
DROP POLICY IF EXISTS workspace_isolation_policy ON workspace;

-- Xóa hàm cũ
DROP FUNCTION IF EXISTS get_current_workspace_id();

-- Tạo lại hàm
CREATE OR REPLACE FUNCTION get_current_workspace_id() RETURNS INTEGER AS $$
BEGIN
    RETURN nullif(current_setting('app.workspace_id', true), '')::INTEGER;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Bật lại RLS cho các bảng
ALTER TABLE workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan ENABLE ROW LEVEL SECURITY;

-- Tạo các policy mới
CREATE POLICY workspace_isolation_policy ON workspace
    FOR ALL
    TO app_user
    USING (id = get_current_workspace_id());

CREATE POLICY plan_isolation_policy ON plan
    FOR ALL
    TO app_user
    USING (workspace_id = get_current_workspace_id());

-- Tạo các policy cho admin, cái này sẽ cho phép superuser bypass RLS
CREATE POLICY workspace_admin_policy ON workspace
    FOR ALL
    TO mission_brief
    USING (true);

CREATE POLICY plan_admin_policy ON plan
    FOR ALL
    TO mission_brief
    USING (true);

-- Revoke từ public (mặc định)
REVOKE ALL ON workspace FROM PUBLIC;
REVOKE ALL ON plan FROM PUBLIC;

-- Grant quyền cho app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON workspace TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON plan TO app_user;

-- Đảm bảo mission_brief có quyền
GRANT ALL ON workspace TO mission_brief;
GRANT ALL ON plan TO mission_brief; 
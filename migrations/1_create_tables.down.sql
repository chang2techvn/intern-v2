-- Drop RLS policies
DROP POLICY IF EXISTS plan_isolation_policy ON plan;
DROP POLICY IF EXISTS workspace_isolation_policy ON workspace;

-- Drop function
DROP FUNCTION IF EXISTS get_current_workspace_id();

-- Drop tables
DROP TABLE IF EXISTS plan;
DROP TABLE IF EXISTS workspace;
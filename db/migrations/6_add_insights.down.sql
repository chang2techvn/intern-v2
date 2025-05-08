-- Down migration to remove insights and audit_log tables

-- Step 1: Drop triggers
DROP TRIGGER IF EXISTS update_insights_modtime ON insights;

-- Step 2: Drop functions
DROP FUNCTION IF EXISTS update_modified_column();

-- Step 3: Drop RLS policies
DROP POLICY IF EXISTS insights_isolation_policy ON insights;
DROP POLICY IF EXISTS audit_log_isolation_policy ON audit_log;

-- Step 4: Disable RLS
ALTER TABLE insights DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- Step 5: Drop indexes
DROP INDEX IF EXISTS idx_insights_workspace_id;
DROP INDEX IF EXISTS idx_insights_category;
DROP INDEX IF EXISTS idx_insights_created_by;
DROP INDEX IF EXISTS idx_insights_relevance;
DROP INDEX IF EXISTS idx_insights_status;

DROP INDEX IF EXISTS idx_audit_log_entity;
DROP INDEX IF EXISTS idx_audit_log_user_id;
DROP INDEX IF EXISTS idx_audit_log_workspace_id;
DROP INDEX IF EXISTS idx_audit_log_action;

-- Step 6: Drop tables
DROP TABLE IF EXISTS insights;
DROP TABLE IF EXISTS audit_log;
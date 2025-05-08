-- Drop the row security policy
DROP POLICY IF EXISTS insights_workspace_isolation ON insights;

-- Drop indexes
DROP INDEX IF EXISTS insights_workspace_id_idx;
DROP INDEX IF EXISTS insights_category_idx;
DROP INDEX IF EXISTS audit_log_entity_type_idx;
DROP INDEX IF EXISTS audit_log_entity_id_idx;
DROP INDEX IF EXISTS audit_log_workspace_id_idx;

-- Drop tables
DROP TABLE IF EXISTS insights;
DROP TABLE IF EXISTS audit_log;
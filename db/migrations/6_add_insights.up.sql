-- Migration to add insights and audit_log tables
-- Step 1: Create insights table
CREATE TABLE IF NOT EXISTS insights (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    source VARCHAR(100),
    relevance INTEGER CHECK (relevance BETWEEN 1 AND 10),
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(100) NOT NULL,
    workspace_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create audit_log table for tracking actions
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    action VARCHAR(50) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    workspace_id INTEGER NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Add indexes for better performance
CREATE INDEX idx_insights_workspace_id ON insights(workspace_id);
CREATE INDEX idx_insights_category ON insights(category);
CREATE INDEX idx_insights_created_by ON insights(created_by);
CREATE INDEX idx_insights_relevance ON insights(relevance);
CREATE INDEX idx_insights_status ON insights(status);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_workspace_id ON audit_log(workspace_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- Step 4: Enable Row Level Security for workspace isolation
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY insights_isolation_policy ON insights
    USING (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY audit_log_isolation_policy ON audit_log
    USING (workspace_id::text = current_setting('app.workspace_id', true));

-- Step 6: Add trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_insights_modtime
BEFORE UPDATE ON insights
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
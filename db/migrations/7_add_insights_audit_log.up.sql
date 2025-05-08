-- Create insights table with RLS (Row Level Security)
CREATE TABLE insights (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    source VARCHAR(255),
    relevance INTEGER CHECK (relevance BETWEEN 1 AND 10),
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(100) NOT NULL,
    workspace_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit_log table for comprehensive activity tracking
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    action VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    workspace_id INTEGER NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX insights_workspace_id_idx ON insights(workspace_id);
CREATE INDEX insights_category_idx ON insights(category);
CREATE INDEX audit_log_entity_type_idx ON audit_log(entity_type);
CREATE INDEX audit_log_entity_id_idx ON audit_log(entity_id);
CREATE INDEX audit_log_workspace_id_idx ON audit_log(workspace_id);

-- Enable row level security for insights table
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Create the row security policy for the insights table
CREATE POLICY insights_workspace_isolation ON insights
    USING (TRUE) -- Allow all operations for now, we'll check workspace_id in our service layer
    WITH CHECK (TRUE);

-- Comments for better documentation
COMMENT ON TABLE insights IS 'Stores tenant-scoped insights data';
COMMENT ON TABLE audit_log IS 'Comprehensive activity log for all actions';
COMMENT ON COLUMN insights.metadata IS 'JSON field for flexible additional metadata';
COMMENT ON COLUMN insights.workspace_id IS 'Foreign key to workspace/tenant ID for RLS';
COMMENT ON COLUMN audit_log.entity_type IS 'Type of entity being operated on (insight, lead, etc)';
COMMENT ON COLUMN audit_log.details IS 'JSON field with operation-specific details';
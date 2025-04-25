-- Create tables
CREATE TABLE IF NOT EXISTS workspace (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    workspace_id INTEGER NOT NULL REFERENCES workspace(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create the function to get the current workspace ID
CREATE OR REPLACE FUNCTION get_current_workspace_id() RETURNS INTEGER AS $$
BEGIN
    RETURN nullif(current_setting('app.workspace_id', true), '')::INTEGER;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY workspace_isolation_policy 
ON workspace 
FOR ALL 
TO PUBLIC
USING (id = get_current_workspace_id());

CREATE POLICY plan_isolation_policy 
ON plan 
FOR ALL 
TO PUBLIC
USING (workspace_id = get_current_workspace_id());

-- Insert sample data for testing
INSERT INTO workspace (id, name, slug, created_at, updated_at) VALUES 
(1, 'Workspace 1', 'workspace-1', NOW() + INTERVAL '1 YEAR', NOW() + INTERVAL '1 YEAR'),
(2, 'Workspace 2', 'workspace-2', NOW() + INTERVAL '1 YEAR', NOW() + INTERVAL '1 YEAR');

INSERT INTO plan (name, description, price, workspace_id, created_at, updated_at) VALUES 
('Basic Plan WS1', 'Basic plan for Workspace 1', 9.99, 1, NOW() + INTERVAL '1 YEAR', NOW() + INTERVAL '1 YEAR'),
('Pro Plan WS1', 'Pro plan for Workspace 1', 19.99, 1, NOW() + INTERVAL '1 YEAR', NOW() + INTERVAL '1 YEAR'),
('Basic Plan WS2', 'Basic plan for Workspace 2', 9.99, 2, NOW() + INTERVAL '1 YEAR', NOW() + INTERVAL '1 YEAR'),
('Pro Plan WS2', 'Pro plan for Workspace 2', 19.99, 2, NOW() + INTERVAL '1 YEAR', NOW() + INTERVAL '1 YEAR'); 
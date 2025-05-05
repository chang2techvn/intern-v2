-- Add Lead table
CREATE TABLE IF NOT EXISTS lead (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    source VARCHAR(100),
    notes TEXT,
    workspace_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Application table
CREATE TABLE IF NOT EXISTS application (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES plan(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    submitted_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    decision_date TIMESTAMP WITH TIME ZONE,
    workspace_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Offer table
CREATE TABLE IF NOT EXISTS offer (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES application(id) ON DELETE CASCADE,
    terms TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,2),
    duration_months INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    expiration_date TIMESTAMP WITH TIME ZONE,
    workspace_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_lead_workspace_id ON lead(workspace_id);
CREATE INDEX idx_application_workspace_id ON application(workspace_id);
CREATE INDEX idx_offer_workspace_id ON offer(workspace_id);
CREATE INDEX idx_application_lead_id ON application(lead_id);
CREATE INDEX idx_offer_application_id ON offer(application_id);

-- Enable Row Level Security on new tables
ALTER TABLE lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE application ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lead table
CREATE POLICY lead_isolation_policy ON lead
    USING (workspace_id::text = current_setting('app.workspace_id', true));

-- Create RLS policies for application table
CREATE POLICY application_isolation_policy ON application
    USING (workspace_id::text = current_setting('app.workspace_id', true));

-- Create RLS policies for offer table
CREATE POLICY offer_isolation_policy ON offer
    USING (workspace_id::text = current_setting('app.workspace_id', true));

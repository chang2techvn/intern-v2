-- Sample data for insights and audit_log tables

-- Clear existing data
TRUNCATE insights, audit_log RESTART IDENTITY CASCADE;

-- Insert sample insights for workspace_id = 1
INSERT INTO insights (title, content, category, source, relevance, status, metadata, created_by, workspace_id) VALUES
('Market Research Q2 2025', 'Our analysis shows increasing demand in the APAC region.', 'Research', 'Internal', 8, 'active', '{"tags": ["market", "q2", "important"]}', '12345', 1),
('Competitor Analysis: NewCorp', 'NewCorp has launched a competing product at $399.', 'Competitive', 'Web', 9, 'active', '{"url": "https://newcorp.example.com/launch"}', '12345', 1),
('Customer Feedback Summary', 'Recent surveys indicate 87% satisfaction with new features.', 'Feedback', 'Survey', 7, 'active', '{"respondents": 234}', '12345', 1),
('Product Launch Strategy', 'Recommending a phased approach for Q3 launch.', 'Strategy', 'Internal', 10, 'active', '{"timeline": "Q3 2025"}', '12345', 1),
('Industry Trend Analysis', 'AI adoption in the sector has increased by 45% YoY.', 'Trends', 'Research', 6, 'active', '{"source": "Industry Report 2025"}', '12345', 1);

-- Insert sample insights for workspace_id = 2
INSERT INTO insights (title, content, category, source, relevance, status, metadata, created_by, workspace_id) VALUES
('Sales Performance 2025', 'Q1 sales exceeded targets by 15% in North America.', 'Sales', 'Internal', 8, 'active', '{"region": "NA", "period": "Q1"}', '67890', 2),
('Technology Stack Assessment', 'Current architecture requires upgrades to support scale.', 'Technical', 'IT Audit', 9, 'active', '{"priority": "high"}', '67890', 2),
('Marketing Campaign Results', 'Spring campaign achieved 23% conversion rate.', 'Marketing', 'Analytics', 7, 'active', '{"spend": 45000, "roi": 2.3}', '67890', 2),
('Supply Chain Disruption Risk', 'Identified potential delays from Asian suppliers in Q3.', 'Risk', 'Partners', 10, 'active', '{"impact": "medium", "probability": "high"}', '67890', 2),
('Employee Satisfaction Survey', 'Remote work satisfaction at 82%, up from 75% last year.', 'HR', 'Survey', 6, 'active', '{"participants": 342}', '67890', 2);

-- Insert sample audit logs for workspace_id = 1
INSERT INTO audit_log (entity_type, entity_id, action, user_id, workspace_id, details) VALUES
('insight', 1, 'create', '12345', 1, '{"title": "Market Research Q2 2025"}'),
('insight', 2, 'create', '12345', 1, '{"title": "Competitor Analysis: NewCorp"}'),
('insight', 3, 'create', '12345', 1, '{"title": "Customer Feedback Summary"}'),
('insight', 1, 'view', '12345', 1, '{}'),
('insight', 2, 'view', '12345', 1, '{}'),
('insight', 1, 'update', '12345', 1, '{"field": "relevance", "old": 7, "new": 8}'),
('insight', null, 'list', '12345', 1, '{"filter": "category=Research"}'),
('insight', 4, 'create', '12345', 1, '{"title": "Product Launch Strategy"}');

-- Insert sample audit logs for workspace_id = 2
INSERT INTO audit_log (entity_type, entity_id, action, user_id, workspace_id, details) VALUES
('insight', 6, 'create', '67890', 2, '{"title": "Sales Performance 2025"}'),
('insight', 7, 'create', '67890', 2, '{"title": "Technology Stack Assessment"}'),
('insight', 8, 'create', '67890', 2, '{"title": "Marketing Campaign Results"}'),
('insight', 6, 'view', '67890', 2, '{}'),
('insight', 7, 'view', '67890', 2, '{}'),
('insight', 6, 'update', '67890', 2, '{"field": "content", "summary": "updated content"}'),
('insight', null, 'list', '67890', 2, '{"limit": 10, "offset": 0}'),
('insight', 9, 'create', '67890', 2, '{"title": "Supply Chain Disruption Risk"}');

-- Test queries to verify data
-- To test workspace 1 data only:
SET app.workspace_id = '1';
SELECT * FROM insights; -- Should return only workspace_id = 1 insights
SELECT * FROM audit_log; -- Should return only workspace_id = 1 audit logs

-- To test workspace 2 data only:
SET app.workspace_id = '2';
SELECT * FROM insights; -- Should return only workspace_id = 2 insights
SELECT * FROM audit_log; -- Should return only workspace_id = 2 audit logs

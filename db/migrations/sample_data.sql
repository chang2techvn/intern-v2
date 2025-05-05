-- Đặt client_encoding để đảm bảo hỗ trợ UTF-8
SET client_encoding = 'UTF8';

-- Thêm dữ liệu vào bảng Plan cho workspace 1
INSERT INTO plan (name, description, price, workspace_id) VALUES
    ('Basic Plan', 'Gói cơ bản dành cho khách hàng mới', 99.99, 1),
    ('Premium Plan', 'Gói cao cấp với nhiều tính năng đặc biệt', 199.99, 1);

-- Thêm dữ liệu vào bảng Plan cho workspace 2
INSERT INTO plan (name, description, price, workspace_id) VALUES
    ('Business Plan', 'Gói dành cho doanh nghiệp vừa và nhỏ', 299.99, 2),
    ('Enterprise Plan', 'Gói toàn diện cho doanh nghiệp lớn', 499.99, 2);

-- Thêm dữ liệu vào bảng Lead cho workspace 1
INSERT INTO lead (name, email, phone, status, source, notes, workspace_id) VALUES
    ('Nguyễn Văn A', 'nguyenvana@example.com', '0901234567', 'new', 'website', 'Khách hàng tiềm năng từ trang web', 1),
    ('Trần Thị B', 'tranthib@example.com', '0912345678', 'contacted', 'referral', 'Được giới thiệu bởi khách hàng hiện tại', 1);

-- Thêm dữ liệu vào bảng Lead cho workspace 2
INSERT INTO lead (name, email, phone, status, source, notes, workspace_id) VALUES
    ('Công ty XYZ', 'contact@xyz.com', '02838123456', 'qualified', 'exhibition', 'Gặp tại triển lãm thương mại', 2),
    ('Doanh nghiệp ABC', 'info@abc.com', '02839876543', 'new', 'online-ad', 'Từ quảng cáo Google Ads', 2);

-- Thêm dữ liệu vào bảng Application cho workspace 1
INSERT INTO application (lead_id, plan_id, status, submitted_date, workspace_id) VALUES
    (1, 22, 'pending', NOW(), 1),
    (2, 23, 'approved', NOW() - INTERVAL '2 days', 1);

-- Thêm dữ liệu vào bảng Application cho workspace 2
INSERT INTO application (lead_id, plan_id, status, submitted_date, workspace_id) VALUES
    (3, 24, 'pending', NOW(), 2),
    (4, 25, 'rejected', NOW() - INTERVAL '3 days', 2);

-- Thêm dữ liệu vào bảng Offer cho workspace 1
INSERT INTO offer (application_id, terms, amount, interest_rate, duration_months, status, expiration_date, workspace_id) VALUES
    (5, 'Điều khoản cơ bản với lãi suất thấp', 5000.00, 3.5, 12, 'pending', NOW() + INTERVAL '30 days', 1),
    (6, 'Điều khoản đặc biệt dành cho khách VIP', 10000.00, 2.8, 24, 'accepted', NOW() + INTERVAL '60 days', 1);

-- Thêm dữ liệu vào bảng Offer cho workspace 2
INSERT INTO offer (application_id, terms, amount, interest_rate, duration_months, status, expiration_date, workspace_id) VALUES
    (3, 'Điều khoản dành cho doanh nghiệp', 25000.00, 4.2, 36, 'pending', NOW() + INTERVAL '15 days', 2),
    (4, 'Gói tài trợ đặc biệt cho doanh nghiệp lớn', 50000.00, 3.9, 48, 'expired', NOW() - INTERVAL '5 days', 2);

-- Kiểm tra xem RLS có được bật cho các bảng mới hay không
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('lead', 'application', 'offer');

-- Kiểm tra các policy đã được cài đặt
SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('lead', 'application', 'offer');

-- Test RLS bằng cách thiết lập workspace_id và truy vấn dữ liệu
-- Đầu tiên, test với workspace_id = 1
BEGIN;
SET LOCAL app.workspace_id = '1';
SELECT 'TEST RLS FOR WORKSPACE 1' as test;
SELECT 'PLANS:' as entity, COUNT(*) FROM plan;
SELECT 'LEADS:' as entity, COUNT(*) FROM lead;
SELECT 'APPLICATIONS:' as entity, COUNT(*) FROM application;
SELECT 'OFFERS:' as entity, COUNT(*) FROM offer;

-- Chi tiết dữ liệu cho workspace 1
SELECT * FROM plan;
SELECT * FROM lead;
SELECT * FROM application;
SELECT * FROM offer;
COMMIT;

-- Test với workspace_id = 2
BEGIN;
SET LOCAL app.workspace_id = '2';
SELECT 'TEST RLS FOR WORKSPACE 2' as test;
SELECT 'PLANS:' as entity, COUNT(*) FROM plan;
SELECT 'LEADS:' as entity, COUNT(*) FROM lead;
SELECT 'APPLICATIONS:' as entity, COUNT(*) FROM application;
SELECT 'OFFERS:' as entity, COUNT(*) FROM offer;

-- Chi tiết dữ liệu cho workspace 2
SELECT * FROM plan;
SELECT * FROM lead;
SELECT * FROM application;
SELECT * FROM offer;
COMMIT;

-- Test JOIN giữa các bảng (với workspace_id = 1)
BEGIN;
SET LOCAL app.workspace_id = '1';
SELECT 'TEST JOIN QUERIES FOR WORKSPACE 1' as test;
SELECT l.name as lead_name, p.name as plan_name, a.status as application_status, o.amount
FROM lead l
JOIN application a ON l.id = a.lead_id
JOIN plan p ON a.plan_id = p.id
JOIN offer o ON a.id = o.application_id
WHERE l.workspace_id = 1;
COMMIT;

-- Test JOIN giữa các bảng (với workspace_id = 2)
BEGIN;
SET LOCAL app.workspace_id = '2';
SELECT 'TEST JOIN QUERIES FOR WORKSPACE 2' as test;
SELECT l.name as lead_name, p.name as plan_name, a.status as application_status, o.amount
FROM lead l
JOIN application a ON l.id = a.lead_id
JOIN plan p ON a.plan_id = p.id
JOIN offer o ON a.id = o.application_id
WHERE l.workspace_id = 2;
COMMIT;

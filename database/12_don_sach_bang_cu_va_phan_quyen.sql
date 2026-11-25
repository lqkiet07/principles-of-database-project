-- =============================================================================
-- 12_don_sach_bang_cu_va_phan_quyen.sql
-- Dọn dẹp 10 bảng & 4 routine prototype tiếng Anh cũ không còn dùng trong CSDL
-- và khóa chặt phân quyền tối thiểu cho tài khoản ứng dụng ktx_app_user.
-- =============================================================================

-- 1. Xóa 10 bảng prototype tiếng Anh cũ (hệ thống hiện tại dùng 100% lược đồ chuẩn tiếng Việt)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS dorm_access_logs CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS student_utility_debts CASCADE;
DROP TABLE IF EXISTS utility_bills CASCADE;
DROP TABLE IF EXISTS student_wallets CASCADE;
DROP TABLE IF EXISTS room_assignments CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS dorm_buildings CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- 2. Xóa 4 procedure/trigger function tiếng Anh cũ
DROP PROCEDURE IF EXISTS sp_generate_and_split_utility_bill(INTEGER, VARCHAR, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, INTEGER, INTEGER, VARCHAR);
DROP PROCEDURE IF EXISTS sp_pay_student_utility_bill(VARCHAR, INTEGER, NUMERIC, INTEGER, VARCHAR, NUMERIC, NUMERIC, VARCHAR);
DROP FUNCTION IF EXISTS fn_audit_utility_meter_update() CASCADE;
DROP FUNCTION IF EXISTS fn_validate_utility_meter_fraud() CASCADE;

-- 3. Áp dụng lại quyền đặc quyền tối thiểu cho tài khoản ứng dụng ktx_app_user
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM ktx_app_user;
GRANT USAGE ON SCHEMA public TO ktx_app_user;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ktx_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ktx_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ktx_app_user;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO ktx_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE nhat_ky_du_lieu FROM ktx_app_user;
GRANT SELECT, INSERT ON TABLE nhat_ky_du_lieu TO ktx_app_user;

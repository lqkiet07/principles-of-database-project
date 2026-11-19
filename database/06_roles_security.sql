-- =============================================================================
-- HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ TRƯỜNG ĐẠI HỌC CẦN THƠ (CTU)
-- File 06: Phân quyền CSDL tách biệt giữa vai trò Ứng dụng và Quản trị (Mục 7.5)
-- =============================================================================

-- 1. Tạo vai trò quản trị CSDL (không dùng cho web app)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ktx_admin_role') THEN
        CREATE ROLE ktx_admin_role NOLOGIN;
    END IF;
END $$;

GRANT ALL PRIVILEGES ON SCHEMA public TO ktx_admin_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ktx_admin_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ktx_admin_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ktx_admin_role;

-- 2. Tạo tài khoản ứng dụng với nguyên tắc đặc quyền tối thiểu (least privilege)
-- Ứng dụng KHÔNG có quyền DROP/ALTER/CREATE TABLE hay quản trị hệ thống CSDL.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ktx_app_user') THEN
        CREATE ROLE ktx_app_user LOGIN PASSWORD 'KtxApp@2026' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    ELSE
        ALTER ROLE ktx_app_user WITH LOGIN PASSWORD 'KtxApp@2026' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM ktx_app_user;
GRANT USAGE ON SCHEMA public TO ktx_app_user;

-- Chỉ cấp quyền thao tác dữ liệu cần thiết trên bảng/view/sequence/function
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ktx_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ktx_app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ktx_app_user;

-- Đảm bảo các đối tượng tương lai trong schema public kế thừa đúng quyền
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ktx_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO ktx_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO ktx_app_user;

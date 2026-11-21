-- =============================================================================
-- KỊCH BẢN DEMO TRỰC TIẾP TRÊN HỆ QUẢN TRỊ CSDL POSTGRESQL (DÀNH CHO BÁO CÁO)
-- Đề tài: Hệ thống Quản lý Ký túc xá Sinh viên - Trường Đại học Cần Thơ
-- Học phần: Nguyên lý Hệ quản trị Cơ sở dữ liệu
-- Cách chạy:
--   psql "postgresql://ktx_app_user:KtxApp%402026@localhost:5432/smart_dormitory_db" -v ON_ERROR_STOP=1 -f database/09_kich_ban_demo_giang_vien.sql
-- =============================================================================

\echo '========================================================================='
\echo 'PHAN 1: CHUNG MINH THU TUC LUU (STORED PROCEDURE CO THAM SO IN / OUT)'
\echo '========================================================================='

-- 1.1. Tra cứu danh mục hệ thống (pg_proc) chứng minh các thủ tục đã lưu trong DBMS
SELECT
    p.proname AS ten_thu_tuc,
    CASE p.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS loai,
    pg_get_function_arguments(p.oid) AS tham_so_dau_vao_dau_ra
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND (p.proname LIKE 'pr_%' OR p.proname LIKE 'sp_%')
ORDER BY p.prokind DESC, p.proname;

-- 1.2. Gọi thử PROCEDURE pr_thanh_toan_ngan_hang (tham số IN / OUT) trong giao dịch ROLLBACK để bảo toàn dữ liệu mẫu
BEGIN;
DO $$
DECLARE
    v_hd_id    INTEGER;
    v_mssv     VARCHAR(8);
    v_ma_lk    INTEGER;
    v_du_truoc NUMERIC(12, 0);
    v_du_sau   NUMERIC(12, 0);
    v_quy_moi  NUMERIC(12, 0);
    v_ma_gd    VARCHAR(64);
BEGIN
    SELECT hd.ma_hoa_don, lt.mssv, tk.ma_lk
    INTO v_hd_id, v_mssv, v_ma_lk
    FROM hoa_don hd
    JOIN luu_tru lt ON lt.ma_phong = hd.ma_phong AND lt.ma_ky = hd.ma_ky AND lt.ngay_ra IS NULL
    JOIN tai_khoan_ngan_hang_sv tk ON tk.mssv = lt.mssv
    WHERE hd.trang_thai = 'CHUA_NOP'
    ORDER BY hd.ma_hoa_don ASC, tk.mac_dinh DESC, lt.mssv ASC
    LIMIT 1;

    CALL pr_thanh_toan_ngan_hang(v_hd_id, v_mssv, v_ma_lk, v_du_truoc, v_du_sau, v_quy_moi, v_ma_gd);
    RAISE NOTICE 'Ket qua OUT tu pr_thanh_toan_ngan_hang(HD=%, SV=%): du_truoc=%, du_sau=%, quy_KTX_moi=%, ma_gd=%',
        v_hd_id, v_mssv, v_du_truoc, v_du_sau, v_quy_moi, v_ma_gd;
END $$;
ROLLBACK;


\echo '========================================================================='
\echo 'PHAN 2: CHUNG MINH GIAO DICH ACID (TRU TK NGAN HANG SV / CONG QUY KTX)'
\echo '========================================================================='

-- 2.1. Hiển thị số dư TK ngân hàng SV, quỹ thu KTX và trạng thái hóa đơn TRƯỚC khi gặp lỗi
SELECT hd.ma_hoa_don, tk.mssv, sv.ho_ten, tk.ngan_hang, tk.so_tai_khoan,
       tk.so_du_sandbox AS so_du_truoc_khi_loi, hd.trang_thai AS trang_thai_hd_truoc
FROM hoa_don hd
JOIN luu_tru lt ON lt.ma_phong = hd.ma_phong AND lt.ma_ky = hd.ma_ky AND lt.ngay_ra IS NULL
JOIN sinh_vien sv ON sv.mssv = lt.mssv
JOIN tai_khoan_ngan_hang_sv tk ON tk.mssv = lt.mssv
WHERE hd.trang_thai = 'CHUA_NOP'
ORDER BY hd.ma_hoa_don ASC, tk.mac_dinh DESC, lt.mssv ASC
LIMIT 1;

SELECT khoa, gia_tri AS quy_ktx_truoc_khi_loi FROM cau_hinh WHERE khoa = 'quy_thu_ktx';

-- 2.2. Kịch bản lỗi giữa chừng: Trừ TK ngân hàng SV thành công nhưng bước cộng quỹ KTX lỗi -> ROLLBACK tự động
DO $$
DECLARE
    v_hd_id INTEGER;
    v_mssv  VARCHAR(8);
    v_ma_lk INTEGER;
BEGIN
    SELECT hd.ma_hoa_don, lt.mssv, tk.ma_lk
    INTO v_hd_id, v_mssv, v_ma_lk
    FROM hoa_don hd
    JOIN luu_tru lt ON lt.ma_phong = hd.ma_phong AND lt.ma_ky = hd.ma_ky AND lt.ngay_ra IS NULL
    JOIN tai_khoan_ngan_hang_sv tk ON tk.mssv = lt.mssv
    WHERE hd.trang_thai = 'CHUA_NOP'
    ORDER BY hd.ma_hoa_don ASC, tk.mac_dinh DESC, lt.mssv ASC
    LIMIT 1;

    BEGIN
        PERFORM sp_thanh_toan_ngan_hang_sandbox(v_hd_id, v_mssv, v_ma_lk, NULL, 'QR_NGAN_HANG', NULL, NULL, NULL, NULL, TRUE);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Da bat loi giao dich (HD=%, SV=%) va ROLLBACK tu dong: %', v_hd_id, v_mssv, SQLERRM;
    END;
END $$;

-- 2.3. Kiểm tra SAU khi ROLLBACK: số dư TK ngân hàng, quỹ KTX và trạng thái hóa đơn giữ nguyên 100%
SELECT hd.ma_hoa_don, tk.mssv, sv.ho_ten, tk.ngan_hang, tk.so_tai_khoan,
       tk.so_du_sandbox AS so_du_sau_rollback, hd.trang_thai AS trang_thai_hd_sau
FROM hoa_don hd
JOIN luu_tru lt ON lt.ma_phong = hd.ma_phong AND lt.ma_ky = hd.ma_ky AND lt.ngay_ra IS NULL
JOIN sinh_vien sv ON sv.mssv = lt.mssv
JOIN tai_khoan_ngan_hang_sv tk ON tk.mssv = lt.mssv
WHERE hd.trang_thai = 'CHUA_NOP'
ORDER BY hd.ma_hoa_don ASC, tk.mac_dinh DESC, lt.mssv ASC
LIMIT 1;

SELECT khoa, gia_tri AS quy_ktx_sau_rollback FROM cau_hinh WHERE khoa = 'quy_thu_ktx';


\echo '========================================================================='
\echo 'PHAN 3: CHUNG MINH TRIGGER GHI LOG GIA TRI CU / MOI & BAY CHAN'
\echo '========================================================================='

-- 3.1. Xem bảng nhat_ky_du_lieu ghi nhận tự động giá trị CŨ (OLD) và MỚI (NEW)
SELECT
    ma_log,
    bang_tac_dong,
    hanh_dong,
    khoa_chinh,
    COALESCE(gia_tri_cu->>'so_du_sandbox', gia_tri_cu->>'so_du', gia_tri_cu->>'trang_thai') AS gia_tri_cu_tom_tat,
    COALESCE(gia_tri_moi->>'so_du_sandbox', gia_tri_moi->>'so_du', gia_tri_moi->>'trang_thai') AS gia_tri_moi_tom_tat,
    thoi_gian
FROM nhat_ky_du_lieu
ORDER BY ma_log DESC
LIMIT 5;

-- 3.2. Chứng minh Trigger bẫy chặn sửa/xóa hóa đơn ĐÃ NỘP và cấm xóa hồ sơ sinh viên
DO $$
DECLARE
    v_paid_id INTEGER;
BEGIN
    SELECT ma_hoa_don INTO v_paid_id FROM hoa_don WHERE trang_thai = 'DA_NOP' LIMIT 1;
    BEGIN
        UPDATE hoa_don SET so_tien = 0 WHERE ma_hoa_don = v_paid_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Trigger trg_chan_sua_xoa_hoa_don_da_nop da chan UPDATE: %', SQLERRM;
    END;

    BEGIN
        DELETE FROM hoa_don WHERE ma_hoa_don = v_paid_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Trigger trg_chan_sua_xoa_hoa_don_da_nop da chan DELETE: %', SQLERRM;
    END;

    BEGIN
        DELETE FROM sinh_vien WHERE mssv = 'B2100001';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Trigger trg_chan_xoa_sinh_vien da chan DELETE: %', SQLERRM;
    END;
END $$;


\echo '========================================================================='
\echo 'PHAN 4: CHUNG MINH CHI MUC LON VOI EXPLAIN ANALYZE (SINH VIEN & RA VAO)'
\echo '========================================================================='

-- 4A. Bảng sinh_vien (50.000+ hồ sơ) với GIN Trigram Index (idx_sinh_vien_ho_ten_trgm)
SELECT
    COUNT(*) AS tong_sinh_vien,
    pg_size_pretty(pg_total_relation_size('sinh_vien')) AS dung_luong_bang_sv,
    pg_size_pretty(pg_indexes_size('sinh_vien')) AS dung_luong_chi_muc_sv
FROM sinh_vien;

BEGIN;
SET LOCAL enable_indexscan = off;
SET LOCAL enable_bitmapscan = off;
EXPLAIN ANALYZE
SELECT mssv, ho_ten, nganh, sdt
FROM sinh_vien
WHERE ho_ten ILIKE '%Nhật Khang%';
COMMIT;

BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN ANALYZE
SELECT mssv, ho_ten, nganh, sdt
FROM sinh_vien
WHERE ho_ten ILIKE '%Nhật Khang%';
COMMIT;

-- 4B. Bảng luot_ra_vao (2.000.000+ lượt quét vân tay) với Composite B-Tree Index
SELECT
    COUNT(*) AS tong_so_ban_ghi,
    pg_size_pretty(pg_total_relation_size('luot_ra_vao')) AS dung_luong_bang,
    pg_size_pretty(pg_indexes_size('luot_ra_vao')) AS dung_luong_chi_muc
FROM luot_ra_vao;

-- 4B.1. Truy vấn lọc khoảng thời gian khi TẮT chỉ mục (Seq Scan) vs BẬT chỉ mục (Bitmap Index Scan)
BEGIN;
SET LOCAL enable_indexscan = off;
SET LOCAL enable_bitmapscan = off;
EXPLAIN ANALYZE
SELECT ma_luot, mssv, thoi_gian
FROM luot_ra_vao
WHERE loai = 'RA'
  AND thoi_gian >= '2025-06-01 00:00:00+07'
  AND thoi_gian <  '2025-06-08 00:00:00+07';
COMMIT;

BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN ANALYZE
SELECT ma_luot, mssv, thoi_gian
FROM luot_ra_vao
WHERE loai = 'RA'
  AND thoi_gian >= '2025-06-01 00:00:00+07'
  AND thoi_gian <  '2025-06-08 00:00:00+07';
COMMIT;

-- 4B.2. Truy vấn tra cứu lịch sử 1 sinh viên theo MSSV + loại lượt với idx_luot_ra_vao_mssv_loai_tg
BEGIN;
SET LOCAL enable_indexscan = off;
SET LOCAL enable_bitmapscan = off;
EXPLAIN ANALYZE
SELECT ma_luot, mssv, loai, thoi_gian
FROM luot_ra_vao
WHERE mssv = 'B2100001' AND loai = 'VAO'
ORDER BY thoi_gian DESC
LIMIT 20;
COMMIT;

BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN ANALYZE
SELECT ma_luot, mssv, loai, thoi_gian
FROM luot_ra_vao
WHERE mssv = 'B2100001' AND loai = 'VAO'
ORDER BY thoi_gian DESC
LIMIT 20;
COMMIT;


\echo '========================================================================='
\echo 'PHAN 5: CHUNG MINH PHAN QUYEN CSDL TOI THIEU (LEAST PRIVILEGE RBAC)'
\echo '========================================================================='

SELECT current_user AS tai_khoan_ket_noi;
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin
FROM pg_roles
WHERE rolname IN ('postgres', 'ktx_admin_role', 'ktx_app_user')
ORDER BY rolname;

DO $$
BEGIN
    IF current_user = 'postgres' THEN
        RAISE NOTICE 'Dang chay bang superuser postgres — hay ket noi bang ktx_app_user de kiem chung chan DDL.';
    ELSE
        BEGIN
            CREATE TABLE test_unauthorized(id INT);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Da chan CREATE TABLE theo dac quyen toi thieu (%): %', current_user, SQLERRM;
        END;

        BEGIN
            DROP TABLE hoa_don;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Da chan DROP TABLE theo dac quyen toi thieu (%): %', current_user, SQLERRM;
        END;
    END IF;
END $$;

-- =============================================================================
-- HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ TRƯỜNG ĐẠI HỌC CẦN THƠ (CTU)
-- File 08: Kịch bản kiểm thử CSDL (Ràng buộc, Trigger, ACID, Khóa dòng - Mục 7)
-- =============================================================================

\echo '=== 1. KIEM TRA VIEW TONG QUAN ==='
SELECT * FROM v_tong_quan_ktx;

\echo '=== 2. KIEM TRA DE XUAT GOP PHONG CUOI KY ==='
SELECT jsonb_array_length(fn_de_xuat_gop_phong('HK1_2026_2027')) AS so_de_xuat_gop_phong;

\echo '=== 3. KIEM TRA SINH VIEN CHUA VE HOM NAY ==='
SELECT COUNT(*) AS so_sv_chua_ve_hom_nay FROM v_sinh_vien_chua_ve_hom_nay;

\echo '=== 4. KIEM TRA TRIGGER CHAN VUOT SUC CHUA & KHAC GIOI TINH (ROLLBACK) ==='
DO $$
DECLARE
    v_phong_full INTEGER;
    v_sv_unassigned VARCHAR(8);
BEGIN
    SELECT ma_phong INTO v_phong_full FROM v_phong_chi_tiet WHERE trang_thai_phong = 'DAY' AND gioi_tinh = 'NAM' LIMIT 1;
    SELECT sv.mssv INTO v_sv_unassigned
    FROM sinh_vien sv
    LEFT JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = 'HK1_2026_2027'
    WHERE lt.mssv IS NULL AND sv.gioi_tinh = 'NAM' LIMIT 1;

    BEGIN
        INSERT INTO luu_tru (mssv, ma_phong, ma_ky) VALUES (v_sv_unassigned, v_phong_full, 'HK1_2026_2027');
        RAISE EXCEPTION 'FAIL: Trigger khong chan vuot suc chua!';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        RAISE NOTICE 'PASS: Trigger chan vuot suc chua thanh cong: %', SQLERRM;
    END;
END $$;

\echo '=== 5. KIEM TRA TRIGGER CHAN SUA/XOA HOA DON DA THANH TOAN ==='
DO $$
DECLARE
    v_hd_paid INTEGER;
BEGIN
    SELECT ma_hoa_don INTO v_hd_paid FROM hoa_don WHERE trang_thai = 'DA_NOP' LIMIT 1;
    BEGIN
        DELETE FROM hoa_don WHERE ma_hoa_don = v_hd_paid;
        RAISE EXCEPTION 'FAIL: Trigger khong chan xoa hoa don da nop!';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        RAISE NOTICE 'PASS: Trigger chan xoa hoa don da nop thanh cong: %', SQLERRM;
    END;

    BEGIN
        UPDATE hoa_don SET so_tien = 0 WHERE ma_hoa_don = v_hd_paid;
        RAISE EXCEPTION 'FAIL: Trigger khong chan sua hoa don da nop!';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        RAISE NOTICE 'PASS: Trigger chan sua hoa don da nop thanh cong: %', SQLERRM;
    END;
END $$;

\echo '=== 6. KIEM TRA CHONG THANH TOAN TRUNG (DOUBLE PAY) ==='
DO $$
DECLARE
    v_hd_paid INTEGER;
    v_rep VARCHAR(8);
BEGIN
    SELECT hd.ma_hoa_don, hdg.mssv_dai_dien INTO v_hd_paid, v_rep
    FROM hoa_don hd
    JOIN hop_dong hdg ON hdg.ma_phong = hd.ma_phong AND hdg.ma_ky = hd.ma_ky AND hdg.trang_thai = 'HIEU_LUC'
    WHERE hd.trang_thai = 'DA_NOP' LIMIT 1;

    BEGIN
        PERFORM sp_thanh_toan_hoa_don(v_hd_paid, v_rep, 'TEST-DOUBLE-PAY');
        RAISE EXCEPTION 'FAIL: Khong chan thanh toan trung!';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        RAISE NOTICE 'PASS: Chan thanh toan trung thanh cong: %', SQLERRM;
    END;
END $$;

\echo '=== 7. KIEM TRA GIAO DICH ACID ROLLBACK KHI XEP PHONG CO MSSV SAI ==='
DO $$
DECLARE
    v_before INTEGER;
    v_after INTEGER;
    v_sv_valid VARCHAR(8);
BEGIN
    SELECT COUNT(*) INTO v_before FROM luu_tru;
    SELECT sv.mssv INTO v_sv_valid
    FROM sinh_vien sv
    LEFT JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = 'HK1_2026_2027'
    WHERE lt.mssv IS NULL LIMIT 1;

    BEGIN
        PERFORM sp_xep_phong_tu_dong(ARRAY[v_sv_valid, 'B9999999']::VARCHAR[], 4, NULL, NULL, TRUE, FALSE, 'HK1_2026_2027');
        RAISE EXCEPTION 'FAIL: Khong chan MSSV khong ton tai!';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        RAISE NOTICE 'PASS: Xep phong tu dong ROLLBACK sach khi co MSSV sai: %', SQLERRM;
    END;

    SELECT COUNT(*) INTO v_after FROM luu_tru;
    IF v_before <> v_after THEN
        RAISE EXCEPTION 'FAIL: Du lieu LUU_TRU bi thay doi sau khi rollback!';
    END IF;
END $$;

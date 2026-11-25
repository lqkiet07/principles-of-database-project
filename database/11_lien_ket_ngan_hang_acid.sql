-- =========================================================================
-- 11_lien_ket_ngan_hang_acid.sql
-- Loại bỏ nạp tiền nội bộ; thay bằng Liên kết tài khoản ngân hàng (Sandbox)
-- với giao dịch ACID 2 chiều thực sự (trừ TK ngân hàng SV + cộng quỹ KTX + gạch nợ)
-- =========================================================================

CREATE TABLE IF NOT EXISTS tai_khoan_ngan_hang_sv (
    ma_lk           SERIAL PRIMARY KEY,
    mssv            VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE CASCADE,
    ngan_hang       VARCHAR(80) NOT NULL,
    ma_bin          VARCHAR(10) NOT NULL DEFAULT '970436',
    so_tai_khoan    VARCHAR(30) NOT NULL,
    ten_chu_tk      VARCHAR(120) NOT NULL,
    so_du_sandbox   NUMERIC(12, 0) NOT NULL DEFAULT 15000000 CHECK (so_du_sandbox >= 0),
    mac_dinh        BOOLEAN NOT NULL DEFAULT TRUE,
    ngay_lien_ket   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (mssv, so_tai_khoan)
);

CREATE TABLE IF NOT EXISTS giao_dich_ngan_hang (
    ma_gd_nh        SERIAL PRIMARY KEY,
    ma_lk           INTEGER NULL REFERENCES tai_khoan_ngan_hang_sv(ma_lk) ON DELETE SET NULL,
    mssv            VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE CASCADE,
    ma_hoa_don      INTEGER NULL REFERENCES hoa_don(ma_hoa_don) ON DELETE SET NULL,
    ma_giao_dich    VARCHAR(64) NOT NULL,
    ngan_hang       VARCHAR(80) NOT NULL,
    so_tai_khoan    VARCHAR(30) NOT NULL,
    so_tien         NUMERIC(12, 0) NOT NULL CHECK (so_tien > 0),
    so_du_truoc     NUMERIC(12, 0) NOT NULL,
    so_du_sau       NUMERIC(12, 0) NOT NULL,
    phuong_thuc     VARCHAR(30) NOT NULL DEFAULT 'QR_NGAN_HANG',
    noi_dung        TEXT NULL,
    thoi_gian       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cập nhật Trigger Audit ghi nhận OLD/NEW khi biến động số dư tài khoản ngân hàng liên kết
CREATE OR REPLACE FUNCTION public.fn_trg_audit_du_lieu()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_pk TEXT;
    v_cu JSONB := NULL;
    v_moi JSONB := NULL;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_moi := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_cu := to_jsonb(OLD);
        v_moi := to_jsonb(NEW);
    ELSE
        v_cu := to_jsonb(OLD);
    END IF;

    v_pk := CASE TG_TABLE_NAME
        WHEN 'hoa_don' THEN COALESCE((COALESCE(v_moi, v_cu))->>'ma_hoa_don', '')
        WHEN 'don_gia' THEN COALESCE((COALESCE(v_moi, v_cu))->>'ma_dg', '')
        WHEN 'sinh_vien' THEN COALESCE((COALESCE(v_moi, v_cu))->>'mssv', '')
        WHEN 'tai_khoan_ngan_hang_sv' THEN COALESCE((COALESCE(v_moi, v_cu))->>'ma_lk', '')
        ELSE ''
    END;

    INSERT INTO nhat_ky_du_lieu (bang_tac_dong, hanh_dong, khoa_chinh, gia_tri_cu, gia_tri_moi)
    VALUES (TG_TABLE_NAME, TG_OP, v_pk, v_cu, v_moi);

    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_tk_ngan_hang_sv ON tai_khoan_ngan_hang_sv;
CREATE TRIGGER trg_audit_tk_ngan_hang_sv
AFTER UPDATE ON tai_khoan_ngan_hang_sv
FOR EACH ROW
WHEN (OLD.so_du_sandbox IS DISTINCT FROM NEW.so_du_sandbox)
EXECUTE FUNCTION fn_trg_audit_du_lieu();

-- Khởi tạo sẵn 1 tài khoản ngân hàng liên kết mặc định cho mỗi sinh viên đang nội trú
INSERT INTO tai_khoan_ngan_hang_sv (mssv, ngan_hang, ma_bin, so_tai_khoan, ten_chu_tk, so_du_sandbox, mac_dinh)
SELECT DISTINCT lt.mssv,
       CASE WHEN mod(abs(hashtext(lt.mssv)), 4) = 0 THEN 'Vietcombank'
            WHEN mod(abs(hashtext(lt.mssv)), 4) = 1 THEN 'BIDV'
            WHEN mod(abs(hashtext(lt.mssv)), 4) = 2 THEN 'Agribank'
            ELSE 'MBBank' END,
       CASE WHEN mod(abs(hashtext(lt.mssv)), 4) = 0 THEN '970436'
            WHEN mod(abs(hashtext(lt.mssv)), 4) = 1 THEN '970418'
            WHEN mod(abs(hashtext(lt.mssv)), 4) = 2 THEN '970405'
            ELSE '970422' END,
       '10' || lpad((10000000 + mod(abs(hashtext(lt.mssv)), 89999999))::TEXT, 8, '0'),
       upper(sv.ho_ten),
       15000000,
       TRUE
FROM luu_tru lt
JOIN sinh_vien sv ON sv.mssv = lt.mssv
WHERE lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
  AND NOT EXISTS (SELECT 1 FROM tai_khoan_ngan_hang_sv tk WHERE tk.mssv = lt.mssv)
ON CONFLICT (mssv, so_tai_khoan) DO NOTHING;

-- Thủ tục giao dịch ACID thanh toán qua ngân hàng liên kết / thông tin thẻ tự nhập
CREATE OR REPLACE FUNCTION sp_thanh_toan_ngan_hang_sandbox(
    p_ma_hoa_don   INTEGER,
    p_mssv         VARCHAR(8),
    p_ma_lk        INTEGER DEFAULT NULL,
    p_ma_giao_dich VARCHAR(64) DEFAULT NULL,
    p_phuong_thuc  VARCHAR(30) DEFAULT 'QR_NGAN_HANG',
    p_ngan_hang    VARCHAR(80) DEFAULT NULL,
    p_so_tai_khoan VARCHAR(30) DEFAULT NULL,
    p_ten_chu_tk   VARCHAR(120) DEFAULT NULL,
    p_noi_dung_ck  VARCHAR(200) DEFAULT NULL,
    p_gia_lap_loi  BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_hd          RECORD;
    v_tk          RECORD;
    v_mssv        VARCHAR(8);
    v_ten_phong   VARCHAR(20);
    v_ma_khu      VARCHAR(10);
    v_o_phong     BOOLEAN;
    v_stk_clean   VARCHAR(30);
    v_ho_ten_sv   VARCHAR(120);
    v_so_du_sau   NUMERIC(12, 0);
    v_quy_cu      NUMERIC(12, 0);
    v_quy_moi     NUMERIC(12, 0);
    v_ma_gd       VARCHAR(64);
    v_ma_tt       INTEGER;
    v_thoi_gian   TIMESTAMPTZ;
    v_loai_label  TEXT;
    v_pt          VARCHAR(30);
    v_nd_ck       VARCHAR(200);
BEGIN
    SELECT * INTO v_hd FROM hoa_don WHERE ma_hoa_don = p_ma_hoa_don FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hóa đơn mã #%.', p_ma_hoa_don USING ERRCODE = 'P0001';
    END IF;

    IF v_hd.trang_thai = 'DA_NOP' THEN
        RAISE EXCEPTION 'Hóa đơn #% đã được thanh toán trước đó.', p_ma_hoa_don USING ERRCODE = 'P0001';
    END IF;

    v_mssv := upper(trim(p_mssv));
    SELECT EXISTS (
        SELECT 1 FROM luu_tru
        WHERE mssv = v_mssv AND ma_phong = v_hd.ma_phong AND ma_ky = v_hd.ma_ky AND ngay_ra IS NULL
    ) INTO v_o_phong;

    IF NOT v_o_phong THEN
        RAISE EXCEPTION 'Sinh viên % không thuộc danh sách lưu trú hiện tại của phòng này.', v_mssv
            USING ERRCODE = 'P0001';
    END IF;

    SELECT ten_phong, ma_khu INTO v_ten_phong, v_ma_khu FROM phong WHERE ma_phong = v_hd.ma_phong;
    SELECT ho_ten INTO v_ho_ten_sv FROM sinh_vien WHERE mssv = v_mssv;

    -- Định vị và khóa tài khoản ngân hàng nguồn của sinh viên
    IF p_ma_lk IS NOT NULL THEN
        SELECT * INTO v_tk
        FROM tai_khoan_ngan_hang_sv
        WHERE ma_lk = p_ma_lk AND mssv = v_mssv
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Không tìm thấy tài khoản ngân hàng liên kết hợp lệ.' USING ERRCODE = 'P0001';
        END IF;
    ELSIF NULLIF(trim(COALESCE(p_so_tai_khoan, '')), '') IS NOT NULL THEN
        v_stk_clean := regexp_replace(trim(p_so_tai_khoan), '\s+', '', 'g');
        SELECT * INTO v_tk
        FROM tai_khoan_ngan_hang_sv
        WHERE mssv = v_mssv AND so_tai_khoan = v_stk_clean
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO tai_khoan_ngan_hang_sv (
                mssv, ngan_hang, ma_bin, so_tai_khoan, ten_chu_tk, so_du_sandbox, mac_dinh
            )
            VALUES (
                v_mssv,
                COALESCE(NULLIF(trim(p_ngan_hang), ''), 'Ngân hàng nội địa'),
                '970436',
                v_stk_clean,
                COALESCE(NULLIF(upper(trim(p_ten_chu_tk)), ''), upper(COALESCE(v_ho_ten_sv, v_mssv))),
                15000000,
                FALSE
            )
            RETURNING * INTO v_tk;
        END IF;
    ELSE
        SELECT * INTO v_tk
        FROM tai_khoan_ngan_hang_sv
        WHERE mssv = v_mssv
        ORDER BY mac_dinh DESC, ma_lk ASC
        LIMIT 1
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Bạn chưa liên kết tài khoản ngân hàng. Vui lòng liên kết ngân hàng hoặc nhập thông tin tài khoản để thanh toán.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF v_tk.so_du_sandbox < v_hd.so_tien THEN
        RAISE EXCEPTION 'Số dư tài khoản % (% · % đ) không đủ để thanh toán hóa đơn (% đ).',
            v_tk.ngan_hang, v_tk.so_tai_khoan,
            to_char(v_tk.so_du_sandbox, 'FM999,999,999'),
            to_char(v_hd.so_tien, 'FM999,999,999')
            USING ERRCODE = 'P0001';
    END IF;

    v_pt := COALESCE(NULLIF(upper(trim(p_phuong_thuc)), ''), 'QR_NGAN_HANG');
    v_nd_ck := COALESCE(NULLIF(trim(p_noi_dung_ck), ''), format('KTXCTU HD%s %s %s', p_ma_hoa_don, v_ten_phong, v_mssv));
    v_ma_gd := COALESCE(
        NULLIF(trim(p_ma_giao_dich), ''),
        'SBX-NH-' || p_ma_hoa_don || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    );

    -- BƯỚC 1: Trừ tiền tài khoản ngân hàng liên kết (Sandbox) của sinh viên
    v_so_du_sau := v_tk.so_du_sandbox - v_hd.so_tien;
    UPDATE tai_khoan_ngan_hang_sv
    SET so_du_sandbox = v_so_du_sau
    WHERE ma_lk = v_tk.ma_lk;

    INSERT INTO giao_dich_ngan_hang (
        ma_lk, mssv, ma_hoa_don, ma_giao_dich, ngan_hang, so_tai_khoan,
        so_tien, so_du_truoc, so_du_sau, phuong_thuc, noi_dung
    )
    VALUES (
        v_tk.ma_lk, v_mssv, p_ma_hoa_don, v_ma_gd, v_tk.ngan_hang, v_tk.so_tai_khoan,
        v_hd.so_tien, v_tk.so_du_sandbox, v_so_du_sau, v_pt, v_nd_ck
    );

    -- Kiểm thử tính toàn vẹn ACID: lỗi ở bước ghi quỹ KTX -> ROLLBACK bước 1
    IF p_gia_lap_loi THEN
        RAISE EXCEPTION 'Lỗi kết nối khi ghi nhận quỹ KTX: PostgreSQL đã ROLLBACK tự động bước trừ tiền tài khoản ngân hàng sinh viên.'
            USING ERRCODE = 'P0001';
    END IF;

    -- BƯỚC 2: Cộng quỹ thu KTX, lập biên lai thanh toán & gạch nợ hóa đơn
    SELECT COALESCE(NULLIF(gia_tri, ''), '0')::NUMERIC INTO v_quy_cu
    FROM cau_hinh WHERE khoa = 'quy_thu_ktx' FOR UPDATE;
    v_quy_moi := COALESCE(v_quy_cu, 0) + v_hd.so_tien;
    INSERT INTO cau_hinh (khoa, gia_tri, mo_ta)
    VALUES ('quy_thu_ktx', v_quy_moi::TEXT, 'Tổng quỹ thu KTX từ thanh toán trực tuyến')
    ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri;

    INSERT INTO thanh_toan (ma_hoa_don, mssv_nguoi_nop, so_tien, ma_giao_dich, phuong_thuc, ngan_hang, noi_dung_ck)
    VALUES (
        p_ma_hoa_don, v_mssv, v_hd.so_tien, v_ma_gd,
        v_pt, format('%s (TK ****%s)', v_tk.ngan_hang, right(v_tk.so_tai_khoan, 4)), v_nd_ck
    )
    RETURNING ma_tt, thoi_gian INTO v_ma_tt, v_thoi_gian;

    UPDATE hoa_don SET trang_thai = 'DA_NOP' WHERE ma_hoa_don = p_ma_hoa_don;

    v_loai_label := CASE WHEN v_hd.loai = 'KTX'
        THEN format('Tiền phòng KTX kỳ %s', v_hd.ma_ky)
        ELSE format('Tiền điện nước tháng %s', v_hd.thang)
    END;

    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    SELECT lt.mssv, v_hd.ma_phong, v_ma_khu, 'HOA_DON',
        format('Đã thanh toán %s - Phòng %s', v_loai_label, v_ten_phong),
        format('Sinh viên %s đã thanh toán %s qua tài khoản %s (****%s · %s đ). Mã GD: %s.',
            v_mssv, v_loai_label, v_tk.ngan_hang, right(v_tk.so_tai_khoan, 4),
            to_char(v_hd.so_tien, 'FM999,999,999'), v_ma_gd)
    FROM luu_tru lt
    WHERE lt.ma_phong = v_hd.ma_phong AND lt.ma_ky = v_hd.ma_ky AND lt.ngay_ra IS NULL;

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'ma_tt', v_ma_tt,
        'ma_hoa_don', p_ma_hoa_don,
        'ma_giao_dich', v_ma_gd,
        'phuong_thuc', v_pt,
        'ngan_hang', format('%s (TK ****%s)', v_tk.ngan_hang, right(v_tk.so_tai_khoan, 4)),
        'so_tai_khoan', v_tk.so_tai_khoan,
        'noi_dung_ck', v_nd_ck,
        'thoi_gian', v_thoi_gian,
        'so_tien', v_hd.so_tien,
        'so_du_truoc', v_tk.so_du_sandbox,
        'so_du_sau', v_so_du_sau,
        'quy_ktx_moi', v_quy_moi,
        'trang_thai', 'DA_NOP'
    );
END;
$$;

-- Thủ tục lưu (Stored Procedure có tham số IN / OUT) thanh toán ngân hàng ACID
DROP PROCEDURE IF EXISTS pr_thanh_toan_ngan_hang(INTEGER, VARCHAR, INTEGER, NUMERIC, NUMERIC, NUMERIC, VARCHAR);
CREATE OR REPLACE PROCEDURE pr_thanh_toan_ngan_hang(
    IN  p_ma_hoa_don   INTEGER,
    IN  p_mssv         VARCHAR(8),
    IN  p_ma_lk        INTEGER,
    OUT o_so_du_truoc  NUMERIC(12, 0),
    OUT o_so_du_sau    NUMERIC(12, 0),
    OUT o_quy_ktx_moi  NUMERIC(12, 0),
    OUT o_ma_giao_dich VARCHAR(64)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_res JSONB;
BEGIN
    v_res := sp_thanh_toan_ngan_hang_sandbox(
        p_ma_hoa_don, p_mssv, p_ma_lk, NULL, 'QR_NGAN_HANG', NULL, NULL, NULL, NULL, FALSE
    );
    o_so_du_truoc  := (v_res->>'so_du_truoc')::NUMERIC;
    o_so_du_sau    := (v_res->>'so_du_sau')::NUMERIC;
    o_quy_ktx_moi  := (v_res->>'quy_ktx_moi')::NUMERIC;
    o_ma_giao_dich := v_res->>'ma_giao_dich';
END;
$$;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ktx_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ktx_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ktx_app_user;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO ktx_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE nhat_ky_du_lieu FROM ktx_app_user;
GRANT SELECT, INSERT ON TABLE nhat_ky_du_lieu TO ktx_app_user;

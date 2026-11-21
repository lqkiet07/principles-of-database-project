-- =========================================================================
-- 10_nang_cap_phan_quyen_canh_cao_thanh_toan.sql
-- 1. Cố định 2 khu quản lý: Khu A và Khu B
-- 2. Phân quyền Ban Quản lý KTX, Quản lý Khu A, Quản lý Khu B
-- 3. Quy trình xử lý đóng trễ > 2 kỳ: Gửi cảnh cáo -> Gửi TB thu hồi phòng (hẹn trình bày) -> Thu hồi chính thức
-- 4. Nâng cấp thanh toán thực tế (VietQR EMVCo, VNPay/NAPAS ATM + OTP, Biên lai điện tử)
-- =========================================================================

-- 1. Chỉ quản lý đúng 2 khu A và B
ALTER TABLE khu DROP CONSTRAINT IF EXISTS chk_khu_chi_a_va_b;
ALTER TABLE khu ADD CONSTRAINT chk_khu_chi_a_va_b CHECK (ma_khu IN ('A', 'B'));

-- 2. Phân quyền theo khu trên bảng tai_khoan
ALTER TABLE tai_khoan
    ADD COLUMN IF NOT EXISTS ma_khu_phu_trach VARCHAR(10) NULL
    REFERENCES khu(ma_khu) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE tai_khoan DROP CONSTRAINT IF EXISTS tai_khoan_vai_tro_check;
ALTER TABLE tai_khoan ADD CONSTRAINT tai_khoan_vai_tro_check
    CHECK (vai_tro IN ('QUAN_LY', 'QUAN_LY_KHU_A', 'QUAN_LY_KHU_B', 'SINH_VIEN'));

ALTER TABLE tai_khoan DROP CONSTRAINT IF EXISTS chk_tai_khoan_khu_phu_trach;
ALTER TABLE tai_khoan ADD CONSTRAINT chk_tai_khoan_khu_phu_trach
    CHECK (
        (vai_tro = 'QUAN_LY_KHU_A' AND ma_khu_phu_trach = 'A')
        OR (vai_tro = 'QUAN_LY_KHU_B' AND ma_khu_phu_trach = 'B')
        OR (vai_tro IN ('QUAN_LY', 'SINH_VIEN') AND ma_khu_phu_trach IS NULL)
    );

INSERT INTO tai_khoan (ten_dang_nhap, mat_khau_bam, vai_tro, ma_khu_phu_trach, mssv, ho_ten_hien_thi, trang_thai, phai_doi_mat_khau)
VALUES
    ('ql_khu_a', '$2b$10$llP7jOYEvpeqM10UtLIBKuXzWwJcWJwKodNqdaXkhN7JCM3XWgjfq', 'QUAN_LY_KHU_A', 'A', NULL, 'Lê Văn Hùng (Quản lý Khu A)', 'HOAT_DONG', FALSE),
    ('ql_khu_b', '$2b$10$4w09SuZxaMVJQlGhrGy0wutKiPw6cefW3g7qDCC2g4jn0bP.016fu', 'QUAN_LY_KHU_B', 'B', NULL, 'Nguyễn Thị Mai (Quản lý Khu B)', 'HOAT_DONG', FALSE)
ON CONFLICT (ten_dang_nhap) DO UPDATE SET
    mat_khau_bam     = EXCLUDED.mat_khau_bam,
    vai_tro          = EXCLUDED.vai_tro,
    ma_khu_phu_trach = EXCLUDED.ma_khu_phu_trach,
    ho_ten_hien_thi  = EXCLUDED.ho_ten_hien_thi,
    trang_thai       = 'HOAT_DONG';

-- 3. Quy trình Cảnh cáo -> Thông báo thu hồi phòng (hẹn trình bày) -> Thu hồi chính thức
ALTER TABLE thong_bao DROP CONSTRAINT IF EXISTS thong_bao_loai_check;
ALTER TABLE thong_bao ADD CONSTRAINT thong_bao_loai_check
    CHECK (loai IN ('HOA_DON', 'DOI_PHONG', 'BAO_TRI', 'HOP_DONG', 'HE_THONG', 'CANH_CAO', 'THU_HOI_PHONG'));

CREATE TABLE IF NOT EXISTS xu_ly_no_phi_ktx (
    ma_xl                   SERIAL PRIMARY KEY,
    mssv                    VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE CASCADE,
    ma_ky                   VARCHAR(20) NOT NULL REFERENCES ky_hoc(ma_ky) ON UPDATE CASCADE ON DELETE CASCADE,
    so_ky_dong_tre          INTEGER NOT NULL DEFAULT 0,
    trang_thai              VARCHAR(30) NOT NULL DEFAULT 'DA_CANH_CAO'
                            CHECK (trang_thai IN ('DA_CANH_CAO', 'DA_GUI_TB_THU_HOI', 'DA_THU_HOI')),
    ngay_canh_cao           TIMESTAMPTZ NULL,
    noi_dung_canh_cao       TEXT NULL,
    nguoi_canh_cao          VARCHAR(50) NULL,
    ngay_gui_tb_thu_hoi     TIMESTAMPTZ NULL,
    thoi_gian_trinh_bay     TIMESTAMPTZ NULL,
    dia_diem_trinh_bay      VARCHAR(200) NULL,
    ly_do_thu_hoi           TEXT NULL,
    nguoi_gui_tb_thu_hoi    VARCHAR(50) NULL,
    ngay_thu_hoi_thuc_te    TIMESTAMPTZ NULL,
    UNIQUE (mssv, ma_ky)
);

CREATE OR REPLACE FUNCTION sp_gui_canh_cao_no_phi(
    p_mssv       VARCHAR(8),
    p_noi_dung   TEXT DEFAULT NULL,
    p_nguoi_gui  VARCHAR(50) DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_mssv       VARCHAR(8);
    v_ky         VARCHAR(20);
    v_sv         RECORD;
    v_xl         RECORD;
    v_tieu_de    TEXT;
    v_noi_dung   TEXT;
BEGIN
    v_mssv := upper(trim(p_mssv));
    v_ky := fn_ky_hoc_hien_hanh();

    SELECT sv.mssv, sv.ho_ten, sv.so_ky_dong_tre,
           lt.ma_phong, p.ten_phong, p.ma_khu
    INTO v_sv
    FROM sinh_vien sv
    JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = v_ky AND lt.ngay_ra IS NULL
    JOIN phong p ON p.ma_phong = lt.ma_phong
    WHERE sv.mssv = v_mssv
    FOR UPDATE OF lt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sinh viên % hiện không lưu trú trong kỳ hiện hành.', v_mssv USING ERRCODE = 'P0001';
    END IF;

    IF COALESCE(v_sv.so_ky_dong_tre, 0) <= 2 THEN
        RAISE EXCEPTION 'Chỉ gửi cảnh cáo thu hồi phòng đối với sinh viên đóng trễ trên 2 kỳ (hiện tại: % kỳ).', COALESCE(v_sv.so_ky_dong_tre, 0)
            USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_xl
    FROM xu_ly_no_phi_ktx
    WHERE mssv = v_mssv AND ma_ky = v_ky
    FOR UPDATE;

    IF FOUND AND v_xl.trang_thai IN ('DA_GUI_TB_THU_HOI', 'DA_THU_HOI') THEN
        RAISE EXCEPTION 'Sinh viên % đã ở bước % trong kỳ này, không thể gửi lại cảnh cáo.', v_mssv, v_xl.trang_thai
            USING ERRCODE = 'P0001';
    END IF;

    v_noi_dung := COALESCE(
        NULLIF(trim(p_noi_dung), ''),
        format(
            'Ban Quản lý KTX cảnh cáo lần chính thức đối với sinh viên %s (%s) tại phòng %s do đã đóng trễ phí KTX %s kỳ (vượt quá 2 kỳ quy định). Đề nghị sinh viên khẩn trương hoàn tất thanh toán các khoản phí còn nợ; nếu tiếp tục chậm trễ, Ban Quản lý sẽ gửi thông báo thu hồi phòng.',
            v_sv.ho_ten, v_mssv, v_sv.ten_phong, v_sv.so_ky_dong_tre
        )
    );

    INSERT INTO xu_ly_no_phi_ktx (
        mssv, ma_ky, so_ky_dong_tre, trang_thai,
        ngay_canh_cao, noi_dung_canh_cao, nguoi_canh_cao
    )
    VALUES (
        v_mssv, v_ky, v_sv.so_ky_dong_tre, 'DA_CANH_CAO',
        NOW(), v_noi_dung, p_nguoi_gui
    )
    ON CONFLICT (mssv, ma_ky) DO UPDATE SET
        so_ky_dong_tre    = EXCLUDED.so_ky_dong_tre,
        trang_thai        = 'DA_CANH_CAO',
        ngay_canh_cao     = NOW(),
        noi_dung_canh_cao = EXCLUDED.noi_dung_canh_cao,
        nguoi_canh_cao    = EXCLUDED.nguoi_canh_cao;

    v_tieu_de := format('Cảnh cáo chậm đóng phí KTX (%s kỳ) - Phòng %s', v_sv.so_ky_dong_tre, v_sv.ten_phong);

    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    VALUES (v_mssv, v_sv.ma_phong, v_sv.ma_khu, 'CANH_CAO', v_tieu_de, v_noi_dung);

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'mssv', v_mssv,
        'ho_ten', v_sv.ho_ten,
        'ten_phong', v_sv.ten_phong,
        'ma_khu', v_sv.ma_khu,
        'trang_thai_xu_ly_no', 'DA_CANH_CAO',
        'thong_bao', format('Đã gửi cảnh cáo chậm đóng phí KTX (%s kỳ) đến sinh viên %s (%s).', v_sv.so_ky_dong_tre, v_sv.ho_ten, v_mssv)
    );
END;
$$;

CREATE OR REPLACE FUNCTION sp_gui_thong_bao_thu_hoi_phong(
    p_mssv                 VARCHAR(8),
    p_thoi_gian_trinh_bay  TIMESTAMPTZ,
    p_dia_diem             VARCHAR(200) DEFAULT 'Phòng Quản lý Ký túc xá - Trường ĐH Cần Thơ',
    p_ly_do                TEXT DEFAULT NULL,
    p_nguoi_gui            VARCHAR(50) DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_mssv          VARCHAR(8);
    v_ky            VARCHAR(20);
    v_sv            RECORD;
    v_xl            RECORD;
    v_tg_fmt        TEXT;
    v_dia_diem      TEXT;
    v_ly_do         TEXT;
    v_tieu_de       TEXT;
    v_noi_dung      TEXT;
BEGIN
    v_mssv := upper(trim(p_mssv));
    v_ky := fn_ky_hoc_hien_hanh();

    SELECT sv.mssv, sv.ho_ten, sv.so_ky_dong_tre,
           lt.ma_phong, p.ten_phong, p.ma_khu
    INTO v_sv
    FROM sinh_vien sv
    JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = v_ky AND lt.ngay_ra IS NULL
    JOIN phong p ON p.ma_phong = lt.ma_phong
    WHERE sv.mssv = v_mssv
    FOR UPDATE OF lt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sinh viên % hiện không lưu trú trong kỳ hiện hành.', v_mssv USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_xl
    FROM xu_ly_no_phi_ktx
    WHERE mssv = v_mssv AND ma_ky = v_ky
    FOR UPDATE;

    IF NOT FOUND OR v_xl.trang_thai = 'DA_THU_HOI' THEN
        RAISE EXCEPTION 'Sinh viên chưa được gửi cảnh cáo trước đó. Vui lòng gửi cảnh cáo trước khi gửi thông báo thu hồi phòng.'
            USING ERRCODE = 'P0001';
    END IF;

    v_tg_fmt := to_char(p_thoi_gian_trinh_bay AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI "ngày" DD/MM/YYYY');
    v_dia_diem := COALESCE(NULLIF(trim(p_dia_diem), ''), 'Phòng Quản lý Ký túc xá - Trường ĐH Cần Thơ');
    v_ly_do := COALESCE(
        NULLIF(trim(p_ly_do), ''),
        format('Sinh viên vẫn chưa hoàn tất nghĩa vụ đóng phí KTX sau khi đã nhận cảnh cáo (đóng trễ %s kỳ).', v_sv.so_ky_dong_tre)
    );

    UPDATE xu_ly_no_phi_ktx
    SET so_ky_dong_tre       = v_sv.so_ky_dong_tre,
        trang_thai           = 'DA_GUI_TB_THU_HOI',
        ngay_gui_tb_thu_hoi  = NOW(),
        thoi_gian_trinh_bay  = p_thoi_gian_trinh_bay,
        dia_diem_trinh_bay   = v_dia_diem,
        ly_do_thu_hoi        = v_ly_do,
        nguoi_gui_tb_thu_hoi = p_nguoi_gui
    WHERE ma_xl = v_xl.ma_xl;

    v_tieu_de := format('Thông báo thu hồi phòng %s — Yêu cầu đến trình bày', v_sv.ten_phong);
    v_noi_dung := format(
        'Ban Quản lý Ký túc xá thông báo xem xét thu hồi chỗ ở tại phòng %s (Khu %s) đối với sinh viên %s (%s). Lý do: %s. Yêu cầu sinh viên có mặt tại %s vào lúc %s để trình bày và giải quyết trước khi ra quyết định thu hồi chính thức.',
        v_sv.ten_phong, v_sv.ma_khu, v_sv.ho_ten, v_mssv, v_ly_do, v_dia_diem, v_tg_fmt
    );

    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    VALUES (v_mssv, v_sv.ma_phong, v_sv.ma_khu, 'THU_HOI_PHONG', v_tieu_de, v_noi_dung);

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'mssv', v_mssv,
        'ho_ten', v_sv.ho_ten,
        'ten_phong', v_sv.ten_phong,
        'ma_khu', v_sv.ma_khu,
        'trang_thai_xu_ly_no', 'DA_GUI_TB_THU_HOI',
        'thoi_gian_trinh_bay', p_thoi_gian_trinh_bay,
        'dia_diem_trinh_bay', v_dia_diem,
        'thong_bao', format('Đã gửi thông báo thu hồi phòng kèm lịch hẹn trình bày lúc %s đến sinh viên %s.', v_tg_fmt, v_mssv)
    );
END;
$$;

CREATE OR REPLACE FUNCTION sp_thu_hoi_phong_sinh_vien(
    p_mssv  VARCHAR(8),
    p_ly_do TEXT DEFAULT 'Đóng trễ phí KTX trên 2 kỳ'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_mssv             VARCHAR(8);
    v_ky               VARCHAR(20);
    v_lt               RECORD;
    v_ten_phong        VARCHAR(20);
    v_ma_khu           VARCHAR(10);
    v_la_truong_phong  BOOLEAN := FALSE;
    v_truong_phong_moi VARCHAR(8) := NULL;
    v_ten_tp_moi       VARCHAR(120) := NULL;
    v_tb_msg           TEXT;
BEGIN
    v_mssv := upper(trim(p_mssv));
    v_ky := fn_ky_hoc_hien_hanh();

    SELECT lt.mssv, lt.ma_phong, lt.ma_ky
    INTO v_lt
    FROM luu_tru lt
    WHERE lt.mssv = v_mssv AND lt.ma_ky = v_ky AND lt.ngay_ra IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sinh viên % hiện không có phòng đang lưu trú để thu hồi.', v_mssv USING ERRCODE = 'P0001';
    END IF;

    SELECT ten_phong, ma_khu INTO v_ten_phong, v_ma_khu
    FROM phong WHERE ma_phong = v_lt.ma_phong FOR UPDATE;

    IF EXISTS (
        SELECT 1 FROM hop_dong
        WHERE ma_phong = v_lt.ma_phong
          AND ma_ky = v_ky
          AND mssv_dai_dien = v_mssv
          AND trang_thai = 'HIEU_LUC'
    ) THEN
        v_la_truong_phong := TRUE;

        SELECT lt.mssv, sv.ho_ten
        INTO v_truong_phong_moi, v_ten_tp_moi
        FROM luu_tru lt
        JOIN sinh_vien sv ON sv.mssv = lt.mssv
        WHERE lt.ma_phong = v_lt.ma_phong
          AND lt.ma_ky = v_ky
          AND lt.ngay_ra IS NULL
          AND lt.mssv <> v_mssv
        ORDER BY sv.so_ky_dong_tre ASC, lt.ngay_vao ASC, lt.mssv ASC
        LIMIT 1;

        IF v_truong_phong_moi IS NOT NULL THEN
            UPDATE hop_dong
            SET mssv_dai_dien = v_truong_phong_moi
            WHERE ma_phong = v_lt.ma_phong
              AND ma_ky = v_ky
              AND trang_thai = 'HIEU_LUC';

            INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
            VALUES (
                v_truong_phong_moi,
                v_lt.ma_phong,
                v_ma_khu,
                'HOP_DONG',
                format('Bàn giao vai trò Trưởng phòng %s', v_ten_phong),
                format('Do sinh viên %s bị thu hồi chỗ ở (%s), bạn được chuyển giao làm Trưởng phòng (đại diện hợp đồng) của phòng %s.',
                    v_mssv, p_ly_do, v_ten_phong)
            );
        ELSE
            UPDATE hop_dong
            SET trang_thai = 'CHAM_DUT'
            WHERE ma_phong = v_lt.ma_phong
              AND ma_ky = v_ky
              AND trang_thai = 'HIEU_LUC';
        END IF;
    END IF;

    UPDATE luu_tru
    SET ngay_ra = CURRENT_DATE
    WHERE mssv = v_mssv AND ma_ky = v_ky AND ngay_ra IS NULL;

    UPDATE sinh_vien
    SET muc_canh_cao = 2,
        ma_van_tay = NULL
    WHERE mssv = v_mssv;

    INSERT INTO xu_ly_no_phi_ktx (mssv, ma_ky, trang_thai, ly_do_thu_hoi, ngay_thu_hoi_thuc_te)
    VALUES (v_mssv, v_ky, 'DA_THU_HOI', p_ly_do, NOW())
    ON CONFLICT (mssv, ma_ky) DO UPDATE SET
        trang_thai           = 'DA_THU_HOI',
        ly_do_thu_hoi        = COALESCE(EXCLUDED.ly_do_thu_hoi, xu_ly_no_phi_ktx.ly_do_thu_hoi),
        ngay_thu_hoi_thuc_te = NOW();

    v_tb_msg := format('Ban Quản lý KTX ra quyết định thu hồi chính thức chỗ ở tại phòng %s và khóa quyền vân tay qua cổng đối với sinh viên %s. Lý do: %s.',
        v_ten_phong, v_mssv, p_ly_do);
    IF v_la_truong_phong AND v_truong_phong_moi IS NOT NULL THEN
        v_tb_msg := v_tb_msg || format(' Vai trò Trưởng phòng %s đã được chuyển sang cho sinh viên %s (%s).',
            v_ten_phong, v_ten_tp_moi, v_truong_phong_moi);
    END IF;

    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    VALUES (
        v_mssv,
        v_lt.ma_phong,
        v_ma_khu,
        'THU_HOI_PHONG',
        format('Quyết định thu hồi chỗ ở phòng %s', v_ten_phong),
        v_tb_msg
    );

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'mssv', v_mssv,
        'ten_phong', v_ten_phong,
        'la_truong_phong_cu', v_la_truong_phong,
        'truong_phong_moi', v_truong_phong_moi,
        'ten_truong_phong_moi', v_ten_tp_moi,
        'thong_bao', v_tb_msg
    );
END;
$$;

-- 4. Cấu hình tài khoản ngân hàng thụ hưởng VietQR & nâng cấp thanh toán thực tế
INSERT INTO cau_hinh (khoa, gia_tri, mo_ta)
VALUES
    ('ngan_hang_bin', '970436', 'Mã BIN ngân hàng VietQR (970436 = Vietcombank)'),
    ('ngan_hang_ten', 'Vietcombank - CN Cần Thơ', 'Tên ngân hàng thụ hưởng KTX CTU'),
    ('ngan_hang_stk', '1026889966', 'Số tài khoản thụ hưởng KTX ĐH Cần Thơ'),
    ('ngan_hang_chu_tk', 'TRUONG DAI HOC CAN THO - KTX', 'Tên chủ tài khoản thụ hưởng')
ON CONFLICT (khoa) DO UPDATE SET
    gia_tri = EXCLUDED.gia_tri,
    mo_ta   = EXCLUDED.mo_ta;

ALTER TABLE phien_thanh_toan_qr
    ADD COLUMN IF NOT EXISTS phuong_thuc     VARCHAR(30) NOT NULL DEFAULT 'VIETQR',
    ADD COLUMN IF NOT EXISTS ma_otp          VARCHAR(6) NULL,
    ADD COLUMN IF NOT EXISTS otp_het_han_luc TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS so_the_che      VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS ngan_hang_nguon VARCHAR(80) NULL;

ALTER TABLE thanh_toan
    ADD COLUMN IF NOT EXISTS phuong_thuc VARCHAR(30) NOT NULL DEFAULT 'CHUYEN_KHOAN',
    ADD COLUMN IF NOT EXISTS ngan_hang   VARCHAR(80) NULL,
    ADD COLUMN IF NOT EXISTS noi_dung_ck VARCHAR(200) NULL;

DROP FUNCTION IF EXISTS sp_thanh_toan_hoa_don(INTEGER, VARCHAR, VARCHAR);
CREATE OR REPLACE FUNCTION sp_thanh_toan_hoa_don(
    p_ma_hoa_don  INTEGER,
    p_mssv        VARCHAR(8),
    p_ma_giao_dich VARCHAR(64) DEFAULT NULL,
    p_phuong_thuc VARCHAR(30) DEFAULT 'VIETQR',
    p_ngan_hang   VARCHAR(80) DEFAULT NULL,
    p_noi_dung_ck VARCHAR(200) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_hd          RECORD;
    v_nguoi_nop   VARCHAR(8);
    v_ten_phong   VARCHAR(20);
    v_ma_khu      VARCHAR(10);
    v_ma_gd       VARCHAR(64);
    v_ma_tt       INTEGER;
    v_thoi_gian   TIMESTAMPTZ;
    v_quy_cu      NUMERIC(12, 0);
    v_quy_moi     NUMERIC(12, 0);
    v_loai_label  TEXT;
    v_o_phong     BOOLEAN;
    v_pt          VARCHAR(30);
    v_ngan_hang   VARCHAR(80);
    v_nd_ck       VARCHAR(200);
BEGIN
    SELECT * INTO v_hd FROM hoa_don WHERE ma_hoa_don = p_ma_hoa_don FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hóa đơn mã #%.', p_ma_hoa_don USING ERRCODE = 'P0001';
    END IF;

    IF v_hd.trang_thai = 'DA_NOP' THEN
        RAISE EXCEPTION 'Hóa đơn #% đã được thanh toán trước đó.', p_ma_hoa_don USING ERRCODE = 'P0001';
    END IF;

    v_nguoi_nop := upper(trim(p_mssv));
    SELECT EXISTS (
        SELECT 1 FROM luu_tru
        WHERE mssv = v_nguoi_nop AND ma_phong = v_hd.ma_phong AND ma_ky = v_hd.ma_ky AND ngay_ra IS NULL
    ) INTO v_o_phong;

    IF NOT v_o_phong THEN
        RAISE EXCEPTION 'Sinh viên % không lưu trú tại phòng của hóa đơn này.', v_nguoi_nop USING ERRCODE = 'P0001';
    END IF;

    SELECT ten_phong, ma_khu INTO v_ten_phong, v_ma_khu FROM phong WHERE ma_phong = v_hd.ma_phong;

    v_pt := COALESCE(NULLIF(upper(trim(p_phuong_thuc)), ''), 'VIETQR');
    v_ngan_hang := COALESCE(NULLIF(trim(p_ngan_hang), ''), 'Vietcombank VietQR 24/7');
    v_nd_ck := COALESCE(NULLIF(trim(p_noi_dung_ck), ''), format('KTXCTU HD%s %s %s', p_ma_hoa_don, v_ten_phong, v_nguoi_nop));
    v_ma_gd := COALESCE(
        NULLIF(trim(p_ma_giao_dich), ''),
        'VQR-CTU-' || p_ma_hoa_don || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    );

    INSERT INTO thanh_toan (ma_hoa_don, mssv_nguoi_nop, so_tien, ma_giao_dich, phuong_thuc, ngan_hang, noi_dung_ck)
    VALUES (p_ma_hoa_don, v_nguoi_nop, v_hd.so_tien, v_ma_gd, v_pt, v_ngan_hang, v_nd_ck)
    RETURNING ma_tt, thoi_gian INTO v_ma_tt, v_thoi_gian;

    UPDATE hoa_don SET trang_thai = 'DA_NOP' WHERE ma_hoa_don = p_ma_hoa_don;

    SELECT COALESCE(NULLIF(gia_tri, ''), '0')::NUMERIC INTO v_quy_cu
    FROM cau_hinh WHERE khoa = 'quy_thu_ktx' FOR UPDATE;
    v_quy_moi := COALESCE(v_quy_cu, 0) + v_hd.so_tien;
    INSERT INTO cau_hinh (khoa, gia_tri, mo_ta)
    VALUES ('quy_thu_ktx', v_quy_moi::TEXT, 'Tổng quỹ thu KTX từ thanh toán trực tuyến')
    ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri;

    v_loai_label := CASE WHEN v_hd.loai = 'KTX'
        THEN format('Tiền phòng KTX kỳ %s', v_hd.ma_ky)
        ELSE format('Tiền điện nước tháng %s', v_hd.thang)
    END;

    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    SELECT lt.mssv, v_hd.ma_phong, v_ma_khu, 'HOA_DON',
        format('Đã thanh toán %s - Phòng %s', v_loai_label, v_ten_phong),
        format('Sinh viên %s đã thanh toán %s qua %s (%s · %s đ). Mã GD: %s.',
            v_nguoi_nop, v_loai_label, v_ngan_hang, v_pt, to_char(v_hd.so_tien, 'FM999,999,999'), v_ma_gd)
    FROM luu_tru lt
    WHERE lt.ma_phong = v_hd.ma_phong AND lt.ma_ky = v_hd.ma_ky AND lt.ngay_ra IS NULL;

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'ma_tt', v_ma_tt,
        'ma_hoa_don', p_ma_hoa_don,
        'ma_giao_dich', v_ma_gd,
        'phuong_thuc', v_pt,
        'ngan_hang', v_ngan_hang,
        'noi_dung_ck', v_nd_ck,
        'thoi_gian', v_thoi_gian,
        'so_tien', v_hd.so_tien,
        'trang_thai', 'DA_NOP'
    );
END;
$$;

-- Cập nhật thanh toán ví để ghi nhận đầy đủ thông tin biên lai điện tử
CREATE OR REPLACE FUNCTION sp_thanh_toan_bang_vi(
    p_ma_hoa_don  INTEGER,
    p_mssv        VARCHAR(8),
    p_gia_lap_loi BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_hd          RECORD;
    v_sv          RECORD;
    v_dai_dien    VARCHAR(8);
    v_ten_phong   VARCHAR(20);
    v_ma_khu      VARCHAR(10);
    v_so_du_sau   NUMERIC(12, 0);
    v_quy_cu      NUMERIC(12, 0);
    v_quy_moi     NUMERIC(12, 0);
    v_ma_gd       VARCHAR(64);
    v_ma_tt       INTEGER;
    v_loai_label  TEXT;
BEGIN
    SELECT * INTO v_hd FROM hoa_don WHERE ma_hoa_don = p_ma_hoa_don FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hóa đơn mã #%.', p_ma_hoa_don USING ERRCODE = 'P0001';
    END IF;

    IF v_hd.trang_thai = 'DA_NOP' THEN
        RAISE EXCEPTION 'Hóa đơn #% đã được thanh toán trước đó.', p_ma_hoa_don USING ERRCODE = 'P0001';
    END IF;

    SELECT mssv_dai_dien INTO v_dai_dien
    FROM hop_dong
    WHERE ma_phong = v_hd.ma_phong AND ma_ky = v_hd.ma_ky AND trang_thai = 'HIEU_LUC'
    LIMIT 1;

    IF v_dai_dien IS NULL OR upper(trim(p_mssv)) <> v_dai_dien THEN
        RAISE EXCEPTION 'Chỉ sinh viên đại diện phòng mới được thanh toán hóa đơn.' USING ERRCODE = 'P0001';
    END IF;

    SELECT mssv, so_du INTO v_sv FROM sinh_vien WHERE mssv = v_dai_dien FOR UPDATE;
    IF v_sv.so_du < v_hd.so_tien THEN
        RAISE EXCEPTION 'Số dư ví (% đ) không đủ để thanh toán hóa đơn (% đ).',
            to_char(v_sv.so_du, 'FM999,999,999'), to_char(v_hd.so_tien, 'FM999,999,999')
            USING ERRCODE = 'P0001';
    END IF;

    v_so_du_sau := v_sv.so_du - v_hd.so_tien;
    UPDATE sinh_vien SET so_du = v_so_du_sau WHERE mssv = v_dai_dien;

    INSERT INTO giao_dich_vi (mssv, loai, so_tien, so_du_truoc, so_du_sau, ma_hoa_don, mo_ta)
    VALUES (
        v_dai_dien, 'THANH_TOAN', v_hd.so_tien, v_sv.so_du, v_so_du_sau, p_ma_hoa_don,
        format('Thanh toán hóa đơn #%s (%s)', p_ma_hoa_don, v_hd.loai)
    );

    IF p_gia_lap_loi THEN
        RAISE EXCEPTION 'Lỗi kết nối khi cập nhật quỹ KTX: PostgreSQL đã ROLLBACK bước trừ tiền ví sinh viên.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(NULLIF(gia_tri, ''), '0')::NUMERIC INTO v_quy_cu
    FROM cau_hinh WHERE khoa = 'quy_thu_ktx' FOR UPDATE;
    v_quy_moi := COALESCE(v_quy_cu, 0) + v_hd.so_tien;
    INSERT INTO cau_hinh (khoa, gia_tri, mo_ta)
    VALUES ('quy_thu_ktx', v_quy_moi::TEXT, 'Tổng quỹ thu KTX từ thanh toán trực tuyến')
    ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri;

    SELECT ten_phong, ma_khu INTO v_ten_phong, v_ma_khu FROM phong WHERE ma_phong = v_hd.ma_phong;
    v_ma_gd := 'VI-CTU-' || p_ma_hoa_don || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');

    INSERT INTO thanh_toan (ma_hoa_don, mssv_nguoi_nop, so_tien, ma_giao_dich, phuong_thuc, ngan_hang, noi_dung_ck)
    VALUES (
        p_ma_hoa_don, v_dai_dien, v_hd.so_tien, v_ma_gd,
        'VI_NOI_TRU', 'Ví nội trú KTX ĐH Cần Thơ',
        format('VI KTXCTU HD%s %s %s', p_ma_hoa_don, v_ten_phong, v_dai_dien)
    )
    RETURNING ma_tt INTO v_ma_tt;

    UPDATE hoa_don SET trang_thai = 'DA_NOP' WHERE ma_hoa_don = p_ma_hoa_don;

    v_loai_label := CASE WHEN v_hd.loai = 'KTX'
        THEN format('Tiền KTX kỳ %s', v_hd.ma_ky)
        ELSE format('Tiền điện nước tháng %s', v_hd.thang)
    END;

    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    SELECT lt.mssv, v_hd.ma_phong, v_ma_khu, 'HOA_DON',
        format('Đã thanh toán %s - Phòng %s', v_loai_label, v_ten_phong),
        format('Sinh viên %s đã thanh toán %s qua số dư ví (%s đ). Mã GD: %s.',
            v_dai_dien, v_loai_label, to_char(v_hd.so_tien, 'FM999,999,999'), v_ma_gd)
    FROM luu_tru lt
    WHERE lt.ma_phong = v_hd.ma_phong AND lt.ma_ky = v_hd.ma_ky AND lt.ngay_ra IS NULL;

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'ma_tt', v_ma_tt,
        'ma_hoa_don', p_ma_hoa_don,
        'ma_giao_dich', v_ma_gd,
        'so_du_truoc', v_sv.so_du,
        'so_du_sau', v_so_du_sau,
        'quy_ktx_moi', v_quy_moi
    );
END;
$$;

-- Cấp đầy đủ quyền cho tài khoản ứng dụng
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ktx_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ktx_app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ktx_app_user;
GRANT USAGE ON SCHEMA public TO ktx_app_user;

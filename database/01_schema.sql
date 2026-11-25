-- =============================================================================
-- HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ TRƯỜNG ĐẠI HỌC CẦN THƠ (CTU)
-- File 01: Lược đồ cơ sở dữ liệu chuẩn hóa 3NF & Ràng buộc toàn vẹn (Mục 6 & 7.1)
-- =============================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;

-- 1. KHU: Khu ký túc xá (A, B, mở rộng được)
CREATE TABLE khu (
    ma_khu  VARCHAR(10) PRIMARY KEY,
    ten_khu VARCHAR(100) NOT NULL UNIQUE
);

-- 2. PHONG: Phòng ở (quản lý theo phòng, KHÔNG lưu số người ở để tránh dư thừa 3NF)
CREATE TABLE phong (
    ma_phong   SERIAL PRIMARY KEY,
    ten_phong  VARCHAR(20) NOT NULL UNIQUE,
    ma_khu     VARCHAR(10) NOT NULL REFERENCES khu(ma_khu) ON UPDATE CASCADE ON DELETE RESTRICT,
    suc_chua   INTEGER NOT NULL CHECK (suc_chua IN (4, 6, 8)),
    co_nau_an  BOOLEAN NOT NULL DEFAULT FALSE,
    gioi_tinh  VARCHAR(10) NOT NULL CHECK (gioi_tinh IN ('NAM', 'NU')),
    gia_phong  NUMERIC(12, 0) NOT NULL CHECK (gia_phong >= 0),
    tinh_trang VARCHAR(20) NOT NULL DEFAULT 'TRONG'
               CHECK (tinh_trang IN ('TRONG', 'CON_CHO', 'DAY', 'BAO_TRI')),
    mo_ta      TEXT NULL,
    embedding  DOUBLE PRECISION[] NULL
);

-- 3. SINH_VIEN: Hồ sơ sinh viên CTU
CREATE TABLE sinh_vien (
    mssv       VARCHAR(8) PRIMARY KEY CHECK (mssv ~ '^[A-Z][0-9]{7}$'),
    ho_ten     VARCHAR(120) NOT NULL CHECK (length(trim(ho_ten)) >= 2),
    gioi_tinh  VARCHAR(10) NOT NULL CHECK (gioi_tinh IN ('NAM', 'NU')),
    nganh      VARCHAR(120) NOT NULL CHECK (length(trim(nganh)) >= 2),
    sdt        VARCHAR(15) NOT NULL CHECK (sdt ~ '^0[0-9]{9,10}$'),
    email      VARCHAR(120) NOT NULL UNIQUE
               CHECK (email ~* '^[A-Z][0-9]{7}@student\.ctu\.edu\.vn$')
);

-- 4. TAI_KHOAN: Tài khoản đăng nhập gắn trực tiếp với hồ sơ sinh viên/cán bộ
CREATE TABLE tai_khoan (
    ma_tk              SERIAL PRIMARY KEY,
    ten_dang_nhap      VARCHAR(50) NOT NULL UNIQUE,
    mat_khau_bam       TEXT NOT NULL,
    vai_tro            VARCHAR(20) NOT NULL CHECK (vai_tro IN ('QUAN_LY', 'SINH_VIEN')),
    mssv               VARCHAR(8) UNIQUE REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE SET NULL,
    ho_ten_hien_thi    VARCHAR(120) NOT NULL,
    trang_thai         VARCHAR(20) NOT NULL DEFAULT 'HOAT_DONG'
                       CHECK (trang_thai IN ('HOAT_DONG', 'KHOA')),
    phai_doi_mat_khau  BOOLEAN NOT NULL DEFAULT FALSE,
    ngay_tao           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. KY_HOC: Kỳ học nội trú
CREATE TABLE ky_hoc (
    ma_ky          VARCHAR(20) PRIMARY KEY,
    ten_ky         VARCHAR(100) NOT NULL,
    ngay_bat_dau   DATE NOT NULL,
    ngay_ket_thuc  DATE NOT NULL,
    dang_hien_hanh BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (ngay_ket_thuc > ngay_bat_dau)
);

-- Chỉ cho phép tối đa 1 kỳ học đang hiện hành
CREATE UNIQUE INDEX uq_ky_hoc_hien_hanh ON ky_hoc (dang_hien_hanh) WHERE dang_hien_hanh = TRUE;

-- 6. LUU_TRU: Quan hệ lưu trú sinh viên - phòng theo kỳ
-- Khóa chính (mssv, ma_ky) đảm bảo 1 sinh viên chỉ ở 1 phòng trong 1 kỳ
CREATE TABLE luu_tru (
    mssv      VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT,
    ma_phong  INTEGER NOT NULL REFERENCES phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT,
    ma_ky     VARCHAR(20) NOT NULL REFERENCES ky_hoc(ma_ky) ON UPDATE CASCADE ON DELETE RESTRICT,
    ngay_vao  DATE NOT NULL DEFAULT CURRENT_DATE,
    ngay_ra   DATE NULL,
    PRIMARY KEY (mssv, ma_ky),
    CHECK (ngay_ra IS NULL OR ngay_ra >= ngay_vao)
);

-- 7. HOP_DONG: Hợp đồng nội trú theo phòng và kỳ (1 sinh viên đại diện đứng tên)
CREATE TABLE hop_dong (
    ma_hd          SERIAL PRIMARY KEY,
    ma_phong       INTEGER NOT NULL REFERENCES phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT,
    ma_ky          VARCHAR(20) NOT NULL REFERENCES ky_hoc(ma_ky) ON UPDATE CASCADE ON DELETE RESTRICT,
    mssv_dai_dien  VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT,
    ngay_ky        DATE NOT NULL DEFAULT CURRENT_DATE,
    trang_thai     VARCHAR(20) NOT NULL DEFAULT 'HIEU_LUC'
                   CHECK (trang_thai IN ('HIEU_LUC', 'HET_HAN', 'CHAM_DUT'))
);

-- Mỗi phòng chỉ có tối đa 1 hợp đồng đang hiệu lực trong một kỳ
CREATE UNIQUE INDEX uq_hop_dong_hieu_luc ON hop_dong (ma_phong, ma_ky) WHERE trang_thai = 'HIEU_LUC';

-- 8. DON_GIA: Đơn giá điện/nước lưu theo thời điểm áp dụng (không làm đổi hóa đơn cũ)
CREATE TABLE don_gia (
    ma_dg       SERIAL PRIMARY KEY,
    loai        VARCHAR(10) NOT NULL CHECK (loai IN ('DIEN', 'NUOC')),
    don_gia     NUMERIC(12, 0) NOT NULL CHECK (don_gia >= 0),
    ap_dung_tu  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. CHI_SO: Chỉ số đồng hồ điện nước theo phòng và tháng
CREATE TABLE chi_so (
    ma_phong          INTEGER NOT NULL REFERENCES phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT,
    thang             VARCHAR(7) NOT NULL CHECK (thang ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    chi_so_dien_dau   INTEGER NOT NULL CHECK (chi_so_dien_dau >= 0),
    chi_so_dien_cuoi  INTEGER NOT NULL CHECK (chi_so_dien_cuoi >= chi_so_dien_dau),
    chi_so_nuoc_dau   INTEGER NOT NULL CHECK (chi_so_nuoc_dau >= 0),
    chi_so_nuoc_cuoi  INTEGER NOT NULL CHECK (chi_so_nuoc_cuoi >= chi_so_nuoc_dau),
    ngay_ghi          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ma_phong, thang)
);

-- 10. HOA_DON: Hóa đơn tiền KTX (theo kỳ) và tiền điện nước (theo tháng) cho từng phòng
CREATE TABLE hoa_don (
    ma_hoa_don       SERIAL PRIMARY KEY,
    ma_phong         INTEGER NOT NULL REFERENCES phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT,
    ma_ky            VARCHAR(20) NOT NULL REFERENCES ky_hoc(ma_ky) ON UPDATE CASCADE ON DELETE RESTRICT,
    thang            VARCHAR(7) NOT NULL DEFAULT 'KY',
    loai             VARCHAR(15) NOT NULL CHECK (loai IN ('KTX', 'DIEN_NUOC')),
    tien_dien        NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (tien_dien >= 0),
    tien_nuoc        NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (tien_nuoc >= 0),
    so_tien          NUMERIC(12, 0) NOT NULL CHECK (so_tien >= 0),
    han_nop          DATE NOT NULL,
    trang_thai       VARCHAR(20) NOT NULL DEFAULT 'CHUA_NOP'
                     CHECK (trang_thai IN ('CHUA_NOP', 'DA_NOP')),
    da_gui_thong_bao BOOLEAN NOT NULL DEFAULT FALSE,
    ngay_tao         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hoa_don_phong_ky_thang_loai UNIQUE (ma_phong, ma_ky, thang, loai),
    CONSTRAINT chk_hoa_don_thang_format CHECK (
        (loai = 'KTX' AND thang = 'KY')
        OR (loai = 'DIEN_NUOC' AND thang ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    )
);

-- 11. THANH_TOAN: Giao dịch thanh toán QR giả lập (UNIQUE ma_hoa_don chống thanh toán 2 lần)
CREATE TABLE thanh_toan (
    ma_tt           SERIAL PRIMARY KEY,
    ma_hoa_don      INTEGER NOT NULL UNIQUE REFERENCES hoa_don(ma_hoa_don) ON UPDATE CASCADE ON DELETE RESTRICT,
    mssv_nguoi_nop  VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT,
    so_tien         NUMERIC(12, 0) NOT NULL CHECK (so_tien >= 0),
    thoi_gian       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ma_giao_dich    VARCHAR(64) NOT NULL UNIQUE
);

-- 12. THONG_BAO: Thông báo đến sinh viên / phòng / khu
CREATE TABLE thong_bao (
    ma_tb      SERIAL PRIMARY KEY,
    mssv       VARCHAR(8) NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE CASCADE,
    ma_phong   INTEGER NULL REFERENCES phong(ma_phong) ON UPDATE CASCADE ON DELETE SET NULL,
    ma_khu     VARCHAR(10) NULL REFERENCES khu(ma_khu) ON UPDATE CASCADE ON DELETE SET NULL,
    loai       VARCHAR(30) NOT NULL DEFAULT 'HE_THONG'
               CHECK (loai IN ('HOA_DON', 'DOI_PHONG', 'BAO_TRI', 'HOP_DONG', 'HE_THONG')),
    tieu_de    VARCHAR(200) NOT NULL,
    noi_dung   TEXT NOT NULL,
    thoi_gian  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    da_doc     BOOLEAN NOT NULL DEFAULT FALSE
);

-- 13. YEU_CAU_BAO_TRI: Yêu cầu sửa chữa / bảo trì (theo phòng hoặc theo khu)
CREATE TABLE yeu_cau_bao_tri (
    ma_yc          SERIAL PRIMARY KEY,
    ma_phong       INTEGER NULL REFERENCES phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT,
    ma_khu         VARCHAR(10) NULL REFERENCES khu(ma_khu) ON UPDATE CASCADE ON DELETE RESTRICT,
    mssv           VARCHAR(8) NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE SET NULL,
    nhom_su_co     VARCHAR(30) NOT NULL
                   CHECK (nhom_su_co IN ('DIEN', 'NUOC', 'NOI_THAT', 'CONG_TRINH', 'KHAC')),
    mo_ta          TEXT NOT NULL CHECK (length(trim(mo_ta)) >= 3),
    anh_url        TEXT NULL,
    trang_thai     VARCHAR(20) NOT NULL DEFAULT 'MOI'
                   CHECK (trang_thai IN ('MOI', 'DA_TIEP_NHAN', 'DANG_XU_LY', 'HOAN_TAT')),
    ghi_chu_xu_ly  TEXT NULL,
    sdt_nguoi_sua  VARCHAR(15) NULL,
    ngay_sua       DATE NULL,
    thoi_gian      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cap_nhat_luc   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ma_phong IS NOT NULL OR ma_khu IS NOT NULL)
);

-- 14. YEU_CAU_DOI_PHONG: Yêu cầu đổi phòng của sinh viên
CREATE TABLE yeu_cau_doi_phong (
    ma_yc            SERIAL PRIMARY KEY,
    mssv             VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT,
    ma_ky            VARCHAR(20) NOT NULL REFERENCES ky_hoc(ma_ky) ON UPDATE CASCADE ON DELETE RESTRICT,
    phong_hien_tai   INTEGER NOT NULL REFERENCES phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT,
    phong_moi        INTEGER NULL REFERENCES phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT,
    nguyen_vong_khu  VARCHAR(10) NULL REFERENCES khu(ma_khu) ON UPDATE CASCADE ON DELETE SET NULL,
    nguyen_vong_loai INTEGER NULL CHECK (nguyen_vong_loai IS NULL OR nguyen_vong_loai IN (4, 6, 8)),
    ly_do            TEXT NOT NULL CHECK (length(trim(ly_do)) >= 5),
    trang_thai       VARCHAR(20) NOT NULL DEFAULT 'CHO_XU_LY'
                     CHECK (trang_thai IN ('CHO_XU_LY', 'DA_DUYET', 'TU_CHOI')),
    ghi_chu_duyet    TEXT NULL,
    ly_do_tu_choi    TEXT NULL,
    thoi_gian        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ngay_xu_ly       TIMESTAMPTZ NULL,
    CHECK (phong_moi IS NULL OR phong_moi <> phong_hien_tai),
    CHECK (trang_thai <> 'TU_CHOI' OR (ly_do_tu_choi IS NOT NULL AND length(trim(ly_do_tu_choi)) >= 2))
);

-- 15. LUOT_RA_VAO: Nhật ký điểm danh vân tay tại cổng KTX
CREATE TABLE luot_ra_vao (
    ma_luot    BIGSERIAL PRIMARY KEY,
    mssv       VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT,
    loai       VARCHAR(10) NOT NULL CHECK (loai IN ('RA', 'VAO')),
    thoi_gian  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. CAU_HINH: Cấu hình hệ thống động
CREATE TABLE cau_hinh (
    khoa     VARCHAR(100) PRIMARY KEY,
    gia_tri  TEXT NOT NULL,
    mo_ta    TEXT NULL
);

-- 17. LUOT_TRUY_CAP_WEB: Thống kê lượt người dùng truy cập hệ thống web (tách biệt ra vào cổng KTX)
CREATE TABLE luot_truy_cap_web (
    ma_truy_cap BIGSERIAL PRIMARY KEY,
    ma_tk       INTEGER NULL REFERENCES tai_khoan(ma_tk) ON DELETE SET NULL,
    vai_tro     VARCHAR(20) NULL,
    duong_dan   VARCHAR(200) NOT NULL DEFAULT '/',
    thoi_gian   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. PHIEN_THANH_TOAN_QR: Phiên thanh toán QR Sandbox có chữ ký HMAC & thời hạn 5 phút
CREATE TABLE phien_thanh_toan_qr (
    ma_phien        VARCHAR(64) PRIMARY KEY,
    ma_hoa_don      INTEGER NOT NULL REFERENCES hoa_don(ma_hoa_don) ON DELETE CASCADE,
    mssv_nguoi_tao  VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON DELETE RESTRICT,
    so_tien         NUMERIC(12, 0) NOT NULL CHECK (so_tien >= 0),
    noi_dung_ck     VARCHAR(160) NOT NULL,
    chu_ky_hmac     VARCHAR(128) NOT NULL,
    trang_thai      VARCHAR(20) NOT NULL DEFAULT 'CHO_THANH_TOAN'
                    CHECK (trang_thai IN ('CHO_THANH_TOAN', 'THANH_CONG', 'DA_HUY', 'HET_HAN')),
    ma_giao_dich    VARCHAR(64) NULL,
    ngay_tao        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    het_han_luc     TIMESTAMPTZ NOT NULL,
    hoan_tat_luc    TIMESTAMPTZ NULL
);

-- 19. TAI_KHOAN_NGAN_HANG_SV: Tài khoản ngân hàng liên kết thanh toán của sinh viên
CREATE TABLE tai_khoan_ngan_hang_sv (
    ma_lk           SERIAL PRIMARY KEY,
    mssv            VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE CASCADE,
    ngan_hang       VARCHAR(80) NOT NULL,
    ma_bin          VARCHAR(10) NOT NULL DEFAULT '970436',
    so_tai_khoan    VARCHAR(30) NOT NULL,
    ten_chu_tk      VARCHAR(120) NOT NULL,
    so_du_sandbox   NUMERIC(12, 0) NOT NULL DEFAULT 15000000 CHECK (so_du_sandbox >= 0),
    mac_dinh        BOOLEAN NOT NULL DEFAULT TRUE,
    ngay_lien_ket   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sv_stk UNIQUE (mssv, so_tai_khoan)
);

-- 20. GIAO_DICH_NGAN_HANG: Lịch sử giao dịch trừ tài khoản ngân hàng và cộng quỹ KTX
CREATE TABLE giao_dich_ngan_hang (
    ma_gd_nh        BIGSERIAL PRIMARY KEY,
    ma_lk           INTEGER REFERENCES tai_khoan_ngan_hang_sv(ma_lk) ON DELETE SET NULL,
    mssv            VARCHAR(8) NOT NULL REFERENCES sinh_vien(mssv) ON UPDATE CASCADE ON DELETE CASCADE,
    ma_hoa_don      INTEGER NOT NULL REFERENCES hoa_don(ma_hoa_don) ON UPDATE CASCADE ON DELETE RESTRICT,
    ma_giao_dich    VARCHAR(64) NOT NULL UNIQUE,
    ngan_hang       VARCHAR(80) NOT NULL,
    so_tai_khoan    VARCHAR(30) NOT NULL,
    so_tien         NUMERIC(12, 0) NOT NULL CHECK (so_tien > 0),
    so_du_truoc     NUMERIC(12, 0) NOT NULL,
    so_du_sau       NUMERIC(12, 0) NOT NULL,
    phuong_thuc     VARCHAR(30) NOT NULL DEFAULT 'QR_NGAN_HANG',
    noi_dung        VARCHAR(200) NOT NULL,
    thoi_gian       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. NHAT_KY_DU_LIEU: Audit Log ghi giá trị cũ / mới từ Trigger khi INSERT, UPDATE, DELETE
CREATE TABLE nhat_ky_du_lieu (
    ma_log        BIGSERIAL PRIMARY KEY,
    bang_tac_dong VARCHAR(50) NOT NULL,
    hanh_dong     VARCHAR(10) NOT NULL CHECK (hanh_dong IN ('INSERT', 'UPDATE', 'DELETE')),
    khoa_chinh    VARCHAR(80) NOT NULL,
    gia_tri_cu    JSONB NULL,
    gia_tri_moi   JSONB NULL,
    thoi_gian     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

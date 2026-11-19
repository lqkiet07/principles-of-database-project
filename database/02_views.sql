-- =============================================================================
-- HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ TRƯỜNG ĐẠI HỌC CẦN THƠ (CTU)
-- File 02: Các View phục vụ tổng quan, danh sách phòng, báo cáo, SV chưa về (Mục 7.3)
-- =============================================================================

-- Hàm tiện ích lấy mã kỳ học hiện hành
CREATE OR REPLACE FUNCTION fn_ky_hoc_hien_hanh()
RETURNS VARCHAR(20)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        (SELECT ma_ky FROM ky_hoc WHERE dang_hien_hanh = TRUE LIMIT 1),
        (SELECT gia_tri FROM cau_hinh WHERE khoa = 'ky_hoc_hien_tai' LIMIT 1)
    );
$$;

-- 1. View danh sách phòng kèm số người thực ở tính từ bảng LUU_TRU (3NF - không lưu thừa)
CREATE OR REPLACE VIEW v_phong_chi_tiet AS
WITH ky_ht AS (
    SELECT fn_ky_hoc_hien_hanh() AS ma_ky
),
dem_o AS (
    SELECT lt.ma_phong, COUNT(*)::INT AS so_nguoi_o
    FROM luu_tru lt
    CROSS JOIN ky_ht
    WHERE lt.ma_ky = ky_ht.ma_ky
      AND lt.ngay_ra IS NULL
    GROUP BY lt.ma_phong
),
hd_ht AS (
    SELECT hd.ma_phong, hd.ma_hd, hd.mssv_dai_dien, sv.ho_ten AS ten_dai_dien, hd.ngay_ky, hd.trang_thai
    FROM hop_dong hd
    CROSS JOIN ky_ht
    JOIN sinh_vien sv ON sv.mssv = hd.mssv_dai_dien
    WHERE hd.ma_ky = ky_ht.ma_ky
      AND hd.trang_thai = 'HIEU_LUC'
),
bt_mo AS (
    SELECT ma_phong, COUNT(*)::INT AS so_yc_bao_tri
    FROM yeu_cau_bao_tri
    WHERE ma_phong IS NOT NULL
      AND trang_thai IN ('MOI', 'DA_TIEP_NHAN', 'DANG_XU_LY')
    GROUP BY ma_phong
)
SELECT
    p.ma_phong,
    p.ten_phong,
    p.ma_khu,
    k.ten_khu,
    p.suc_chua,
    p.co_nau_an,
    p.gioi_tinh,
    p.gia_phong,
    COALESCE(d.so_nguoi_o, 0) AS so_nguoi_o,
    GREATEST(p.suc_chua - COALESCE(d.so_nguoi_o, 0), 0) AS so_giuong_trong,
    CASE
        WHEN p.tinh_trang = 'BAO_TRI' THEN 'BAO_TRI'
        WHEN COALESCE(d.so_nguoi_o, 0) = 0 THEN 'TRONG'
        WHEN COALESCE(d.so_nguoi_o, 0) >= p.suc_chua THEN 'DAY'
        ELSE 'CON_CHO'
    END AS trang_thai_phong,
    hd.ma_hd,
    hd.mssv_dai_dien,
    hd.ten_dai_dien,
    (hd.ma_hd IS NOT NULL) AS da_ky_hop_dong,
    COALESCE(bt.so_yc_bao_tri, 0) AS so_yc_bao_tri
FROM phong p
JOIN khu k ON k.ma_khu = p.ma_khu
LEFT JOIN dem_o d ON d.ma_phong = p.ma_phong
LEFT JOIN hd_ht hd ON hd.ma_phong = p.ma_phong
LEFT JOIN bt_mo bt ON bt.ma_phong = p.ma_phong;

-- 2. View tổng quan hệ thống KTX (Mục 4.1)
CREATE OR REPLACE VIEW v_tong_quan_ktx AS
WITH thang_ht AS (
    SELECT COALESCE(
        (SELECT MAX(thang) FROM chi_so),
        to_char(CURRENT_DATE, 'YYYY-MM')
    ) AS thang
),
tk_phong AS (
    SELECT
        COUNT(*)::INT AS tong_so_phong,
        COALESCE(SUM(so_nguoi_o), 0)::INT AS tong_sv_dang_o,
        COALESCE(SUM(CASE WHEN trang_thai_phong <> 'BAO_TRI' THEN suc_chua ELSE 0 END), 0)::INT AS tong_suc_chua_kha_dung,
        COALESCE(SUM(CASE WHEN trang_thai_phong <> 'BAO_TRI' THEN so_giuong_trong ELSE 0 END), 0)::INT AS so_giuong_trong
    FROM v_phong_chi_tiet
),
tk_chi_so AS (
    SELECT
        COUNT(*)::INT AS so_phong_da_nhap_chi_so,
        COALESCE(SUM(cs.chi_so_dien_cuoi - cs.chi_so_dien_dau), 0)::BIGINT AS tong_dien_tieu_thu,
        COALESCE(SUM(cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau), 0)::BIGINT AS tong_nuoc_tieu_thu
    FROM chi_so cs
    CROSS JOIN thang_ht
    WHERE cs.thang = thang_ht.thang
),
tk_hd AS (
    SELECT
        COUNT(*)::INT AS so_phong_chua_nop_dien_nuoc
    FROM hoa_don hd
    CROSS JOIN thang_ht
    WHERE hd.loai = 'DIEN_NUOC'
      AND hd.thang = thang_ht.thang
      AND hd.trang_thai = 'CHUA_NOP'
),
tk_ra_vao AS (
    SELECT
        COUNT(*) FILTER (
            WHERE loai = 'VAO'
              AND (thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE
        )::INT AS luot_vao_hom_nay,
        COUNT(*) FILTER (
            WHERE loai = 'VAO'
              AND date_trunc('week', thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh')
                  = date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
        )::INT AS luot_vao_tuan_nay
    FROM luot_ra_vao
)
SELECT
    thang_ht.thang AS thang_hien_tai,
    tk_phong.tong_sv_dang_o,
    tk_phong.tong_suc_chua_kha_dung,
    tk_phong.so_giuong_trong,
    tk_phong.tong_so_phong,
    tk_chi_so.so_phong_da_nhap_chi_so,
    tk_chi_so.tong_dien_tieu_thu,
    tk_chi_so.tong_nuoc_tieu_thu,
    tk_hd.so_phong_chua_nop_dien_nuoc,
    tk_ra_vao.luot_vao_hom_nay,
    tk_ra_vao.luot_vao_tuan_nay
FROM thang_ht, tk_phong, tk_chi_so, tk_hd, tk_ra_vao;

-- 3. View bộ đếm lượt truy cập trang web theo ngày / tuần / tháng (tách biệt lượt ra vào cổng KTX)
CREATE OR REPLACE VIEW v_luot_truy_cap_web AS
SELECT
    COUNT(*) FILTER (
        WHERE (thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE
              = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE
    )::INT AS hom_nay,
    COUNT(*) FILTER (
        WHERE date_trunc('week', thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh')
              = date_trunc('week', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )::INT AS tuan_nay,
    COUNT(*) FILTER (
        WHERE date_trunc('month', thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh')
              = date_trunc('month', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )::INT AS thang_nay
FROM luot_truy_cap_web;

-- 4. Hàm + View sinh viên chưa về theo ngày & mốc giờ (Mục 4.8 & 7.3)
CREATE OR REPLACE FUNCTION fn_sinh_vien_chua_ve(
    p_ngay DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE,
    p_moc_gio TIME DEFAULT TIME '23:59:59'
)
RETURNS TABLE (
    mssv VARCHAR(8),
    ho_ten VARCHAR(120),
    ten_phong VARCHAR(20),
    ma_khu VARCHAR(10),
    sdt VARCHAR(15),
    gio_ra_cuoi TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    WITH ky_ht AS (
        SELECT fn_ky_hoc_hien_hanh() AS ma_ky
    ),
    gioi_han AS (
        SELECT ((p_ngay::TIMESTAMP + p_moc_gio) AT TIME ZONE 'Asia/Ho_Chi_Minh') AS moc_thoi_gian
    ),
    luot_trong_ngay AS (
        SELECT
            l.mssv,
            MAX(l.thoi_gian) FILTER (WHERE l.loai = 'RA') AS gio_ra_cuoi,
            MAX(l.thoi_gian) FILTER (WHERE l.loai = 'VAO') AS gio_vao_cuoi
        FROM luot_ra_vao l
        CROSS JOIN gioi_han gh
        WHERE (l.thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE = p_ngay
          AND l.thoi_gian <= gh.moc_thoi_gian
        GROUP BY l.mssv
    )
    SELECT
        sv.mssv,
        sv.ho_ten,
        p.ten_phong,
        p.ma_khu,
        sv.sdt,
        ln.gio_ra_cuoi
    FROM luot_trong_ngay ln
    JOIN sinh_vien sv ON sv.mssv = ln.mssv
    LEFT JOIN luu_tru lt
        ON lt.mssv = sv.mssv
       AND lt.ma_ky = (SELECT ma_ky FROM ky_ht)
       AND lt.ngay_ra IS NULL
    LEFT JOIN phong p ON p.ma_phong = lt.ma_phong
    WHERE ln.gio_ra_cuoi IS NOT NULL
      AND (ln.gio_vao_cuoi IS NULL OR ln.gio_vao_cuoi < ln.gio_ra_cuoi)
    ORDER BY ln.gio_ra_cuoi ASC;
$$;

CREATE OR REPLACE VIEW v_sinh_vien_chua_ve_hom_nay AS
SELECT * FROM fn_sinh_vien_chua_ve(
    (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE,
    COALESCE(
        NULLIF((SELECT gia_tri FROM cau_hinh WHERE khoa = 'moc_gio_chua_ve' LIMIT 1), '24:00')::TIME,
        TIME '23:59:59'
    )
);

-- 5. View báo cáo điện nước theo kỳ/tháng (Mục 4.3 & 7.3)
CREATE OR REPLACE VIEW v_bao_cao_dien_nuoc AS
SELECT
    hd.ma_hoa_don,
    hd.ma_phong,
    p.ten_phong,
    p.ma_khu,
    k.ten_khu,
    hd.ma_ky,
    hd.thang,
    cs.chi_so_dien_dau,
    cs.chi_so_dien_cuoi,
    (cs.chi_so_dien_cuoi - cs.chi_so_dien_dau) AS luong_dien,
    cs.chi_so_nuoc_dau,
    cs.chi_so_nuoc_cuoi,
    (cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau) AS luong_nuoc,
    hd.tien_dien,
    hd.tien_nuoc,
    hd.so_tien,
    hd.han_nop,
    hd.trang_thai,
    hd.da_gui_thong_bao,
    hd.ngay_tao,
    tt.thoi_gian AS ngay_thanh_toan,
    tt.mssv_nguoi_nop,
    tt.ma_giao_dich
FROM hoa_don hd
JOIN phong p ON p.ma_phong = hd.ma_phong
JOIN khu k ON k.ma_khu = p.ma_khu
LEFT JOIN chi_so cs ON cs.ma_phong = hd.ma_phong AND cs.thang = hd.thang
LEFT JOIN thanh_toan tt ON tt.ma_hoa_don = hd.ma_hoa_don
WHERE hd.loai = 'DIEN_NUOC';

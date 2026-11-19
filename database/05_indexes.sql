-- =============================================================================
-- HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ TRƯỜNG ĐẠI HỌC CẦN THƠ (CTU)
-- File 05: Chỉ mục tối ưu truy vấn & phân trang máy chủ (Mục 7.4)
-- =============================================================================

-- Tra cứu phòng theo khu, loại phòng, giới tính, trạng thái
CREATE INDEX idx_phong_bo_loc ON phong (ma_khu, suc_chua, gioi_tinh, co_nau_an, tinh_trang);

-- Đếm sinh viên đang lưu trú theo phòng & kỳ (partial index bỏ qua bản ghi đã ra)
CREATE INDEX idx_luu_tru_phong_ky_active ON luu_tru (ma_phong, ma_ky) WHERE ngay_ra IS NULL;

-- Tìm kiếm sinh viên theo họ tên và ngành
CREATE INDEX idx_sinh_vien_ho_ten ON sinh_vien (ho_ten);
CREATE INDEX idx_sinh_vien_nganh ON sinh_vien (nganh);

-- Tra cứu chỉ số và hóa đơn theo phòng, tháng, trạng thái
CREATE INDEX idx_chi_so_thang ON chi_so (thang, ma_phong);
CREATE INDEX idx_hoa_don_loc ON hoa_don (loai, thang, trang_thai, ma_phong);
CREATE INDEX idx_hoa_don_ky_phong ON hoa_don (ma_ky, ma_phong, loai);

-- Tra cứu đơn giá mới nhất theo loại
CREATE INDEX idx_don_gia_loai_ap_dung ON don_gia (loai, ap_dung_tu DESC);

-- Tra cứu nhật ký ra vào cổng theo thời gian, loại và MSSV (phục vụ đếm ngày/tuần & SV chưa về)
CREATE INDEX idx_luot_ra_vao_thoi_gian_loai ON luot_ra_vao (thoi_gian DESC, loai);
CREATE INDEX idx_luot_ra_vao_mssv_thoi_gian ON luot_ra_vao (mssv, thoi_gian DESC);

-- Tra cứu thông báo theo sinh viên và trạng thái chưa đọc
CREATE INDEX idx_thong_bao_mssv_thoi_gian ON thong_bao (mssv, da_doc, thoi_gian DESC);

-- Tra cứu bảo trì theo trạng thái, phòng, khu
CREATE INDEX idx_bao_tri_loc ON yeu_cau_bao_tri (trang_thai, ma_khu, ma_phong, thoi_gian DESC);

-- Đảm bảo 1 sinh viên chỉ có tối đa 1 yêu cầu đổi phòng đang chờ xử lý cùng lúc (Mục 5.2)
CREATE UNIQUE INDEX uq_doi_phong_dang_cho ON yeu_cau_doi_phong (mssv) WHERE trang_thai = 'CHO_XU_LY';
CREATE INDEX idx_doi_phong_trang_thai ON yeu_cau_doi_phong (trang_thai, thoi_gian DESC);

-- Tra cứu hợp đồng theo kỳ và trạng thái
CREATE INDEX idx_hop_dong_ky_trang_thai ON hop_dong (ma_ky, trang_thai);

-- Tra cứu lượt truy cập website theo thời gian (đếm ngày / tuần / tháng)
CREATE INDEX idx_luot_truy_cap_web_thoi_gian ON luot_truy_cap_web (thoi_gian DESC);

-- Tra cứu phiên thanh toán QR theo hóa đơn & trạng thái
CREATE INDEX idx_phien_qr_hoa_don_trang_thai ON phien_thanh_toan_qr (ma_hoa_don, trang_thai);

-- Chỉ mục tổng hợp (Composite Index) trên bảng lớn luot_ra_vao (1.000.000+ dòng) cho demo EXPLAIN ANALYZE
CREATE INDEX idx_luot_ra_vao_loai_thoi_gian ON luot_ra_vao (loai, thoi_gian DESC);

-- Chỉ mục GIN Trigram tìm kiếm mờ họ tên sinh viên (pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_sinh_vien_ho_ten_trgm ON sinh_vien USING gin (ho_ten gin_trgm_ops);

-- Chỉ mục nhật ký kiểm toán Trigger
CREATE INDEX idx_nhat_ky_bang_thoi_gian ON nhat_ky_du_lieu (bang_tac_dong, thoi_gian DESC);

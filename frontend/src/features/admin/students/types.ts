export interface StudentRow {
  mssv: string;
  ho_ten: string;
  gioi_tinh: "NAM" | "NU";
  nganh: string;
  sdt: string;
  email: string;
  ma_phong: number | null;
  ten_phong: string | null;
  ma_khu: string | null;
  ngay_vao: string | null;
  la_truong_phong?: boolean;
  so_ky_dong_tre?: number;
  trang_thai_hop_dong?: "DA_KY" | "CHUA_KY" | "CHUA_XEP_PHONG";
  trang_thai_xu_ly_no?: "DA_CANH_CAO" | "DA_GUI_TB_THU_HOI" | "DA_THU_HOI" | null;
  ngay_canh_cao?: string | null;
  ngay_gui_tb_thu_hoi?: string | null;
  thoi_gian_trinh_bay?: string | null;
  dia_diem_trinh_bay?: string | null;
  ly_do_thu_hoi?: string | null;
}

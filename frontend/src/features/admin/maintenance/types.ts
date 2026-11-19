export interface MaintenanceItem {
  ma_yc: number;
  ma_phong: number | null;
  ten_phong: string | null;
  ma_khu: string;
  mssv: string | null;
  ten_sinh_vien: string | null;
  nhom_su_co: string;
  mo_ta: string;
  anh_url: string | null;
  trang_thai: "MOI" | "DA_TIEP_NHAN" | "DANG_XU_LY" | "HOAN_TAT";
  ghi_chu_xu_ly: string | null;
  sdt_nguoi_sua: string | null;
  ngay_sua: string | null;
  thoi_gian: string;
  cap_nhat_luc: string;
}

export interface RoomMaintStatus {
  ma_phong: number;
  ten_phong: string;
  ma_khu: string;
  trang_thai_phong: string;
  so_yc_bao_tri: number;
  tinh_trang_bao_tri: "BINH_THUONG" | "CO_YEU_CAU" | "DANG_BAO_TRI";
}

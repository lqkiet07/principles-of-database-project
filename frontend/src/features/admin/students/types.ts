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
  trang_thai_hop_dong?: "DA_KY" | "CHUA_KY" | "CHUA_XEP_PHONG";
}

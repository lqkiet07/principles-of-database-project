export interface BillRow {
  ma_phong: number;
  ten_phong: string;
  ma_khu: string;
  so_nguoi_o: number;
  mssv_dai_dien: string | null;
  ten_dai_dien: string | null;
  chi_so_dien_dau: number | null;
  chi_so_dien_cuoi: number | null;
  luong_dien: number | null;
  chi_so_nuoc_dau: number | null;
  chi_so_nuoc_cuoi: number | null;
  luong_nuoc: number | null;
  ma_hoa_don: number | null;
  tien_dien: number | null;
  tien_nuoc: number | null;
  so_tien: number | null;
  han_nop: string | null;
  trang_thai: string;
  da_gui_thong_bao: boolean;
}

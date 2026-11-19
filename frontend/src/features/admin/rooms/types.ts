export interface RoomItem {
  ma_phong: number;
  ten_phong: string;
  ma_khu: string;
  ten_khu: string;
  suc_chua: number;
  co_nau_an: boolean;
  gioi_tinh: "NAM" | "NU";
  gia_phong: number;
  so_nguoi_o: number;
  so_giuong_trong: number;
  trang_thai_phong: string;
}

export interface Resident {
  mssv: string;
  ho_ten: string;
  gioi_tinh: string;
  nganh: string;
  sdt: string;
  email: string;
  ngay_vao: string;
  la_dai_dien: boolean;
}

export interface ZoneItem {
  ma_khu: string;
  ten_khu: string;
  so_phong: number;
}

export interface MergeProposal {
  mssv: string;
  ho_ten: string;
  ma_phong_cu: number;
  ten_phong_cu: string;
  ma_phong_moi: number;
  ten_phong_moi: string;
  ma_khu: string;
  gioi_tinh: string;
  suc_chua: number;
  co_nau_an: boolean;
  so_nguoi_phong_moi_hien_tai: number;
  so_nguoi_phong_moi_sau_gop: number;
}

export interface TransferItem {
  ma_yc: number;
  mssv: string;
  ho_ten: string;
  gioi_tinh: string;
  nganh: string;
  sdt: string;
  phong_hien_tai: number;
  ten_phong_hien_tai: string;
  khu_hien_tai: string;
  phong_moi: number | null;
  ten_phong_moi: string | null;
  nguyen_vong_khu: string | null;
  nguyen_vong_loai: number | null;
  ly_do: string;
  trang_thai: "CHO_XU_LY" | "DA_DUYET" | "TU_CHOI";
  ghi_chu_duyet: string | null;
  ly_do_tu_choi: string | null;
  thoi_gian: string;
  ngay_xu_ly: string | null;
}

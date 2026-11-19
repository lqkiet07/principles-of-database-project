from fastapi import APIRouter, Depends

from app.auth import require_admin
from app.db import fetch_one

router = APIRouter(prefix="/api/admin/overview", tags=["Quản lý - Tổng quan"])


@router.get("")
async def get_admin_overview(_admin=Depends(require_admin)):
    summary = await fetch_one("SELECT * FROM v_tong_quan_ktx")
    web_visits = await fetch_one("SELECT * FROM v_luot_truy_cap_web")
    ky_hoc = await fetch_one(
        "SELECT ma_ky, ten_ky, ngay_bat_dau, ngay_ket_thuc FROM ky_hoc WHERE dang_hien_hanh = TRUE LIMIT 1"
    )
    quick = await fetch_one(
        """
        SELECT
            (SELECT COUNT(*)::INT FROM yeu_cau_doi_phong WHERE trang_thai = 'CHO_XU_LY') AS yc_doi_phong_cho,
            (SELECT COUNT(*)::INT FROM yeu_cau_bao_tri WHERE trang_thai IN ('MOI', 'DA_TIEP_NHAN', 'DANG_XU_LY')) AS yc_bao_tri_mo,
            (SELECT COUNT(*)::INT FROM v_phong_chi_tiet WHERE so_nguoi_o > 0 AND da_ky_hop_dong = FALSE) AS phong_chua_ky_hd,
            (SELECT COUNT(*)::INT FROM v_sinh_vien_chua_ve_hom_nay) AS sv_chua_ve_hom_nay
        """
    )
    return {
        "tong_quan": summary,
        "luot_truy_cap_web": web_visits or {"hom_nay": 0, "tuan_nay": 0, "thang_nay": 0},
        "ky_hoc": ky_hoc,
        "canh_bao_nhanh": quick,
    }

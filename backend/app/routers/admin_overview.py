from fastapi import APIRouter, Depends

from app.auth import get_scope_khu, require_admin
from app.db import fetch_one

router = APIRouter(prefix="/api/admin/overview", tags=["Quản lý - Tổng quan"])


@router.get("")
async def get_admin_overview(admin=Depends(require_admin)):
    scope_khu = get_scope_khu(admin)
    khu_params: list = [scope_khu] if scope_khu else ["A", "B"]
    khu_filter = "ma_khu = %s" if scope_khu else "ma_khu IN (%s, %s)"
    p_khu_filter = "p.ma_khu = %s" if scope_khu else "p.ma_khu IN (%s, %s)"

    thang_row = await fetch_one(
        "SELECT COALESCE((SELECT MAX(thang) FROM chi_so), TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS thang"
    )
    thang_ht = thang_row["thang"] if thang_row else "2026-11"

    summary = await fetch_one(
        f"""
        WITH tk_phong AS (
            SELECT COUNT(*)::INT AS tong_so_phong,
                   COALESCE(SUM(so_nguoi_o), 0)::INT AS tong_sv_dang_o,
                   COALESCE(SUM(CASE WHEN trang_thai_phong <> 'BAO_TRI' THEN suc_chua ELSE 0 END), 0)::INT AS tong_suc_chua_kha_dung,
                   COALESCE(SUM(CASE WHEN trang_thai_phong <> 'BAO_TRI' THEN so_giuong_trong ELSE 0 END), 0)::INT AS so_giuong_trong
            FROM v_phong_chi_tiet
            WHERE {khu_filter}
        ),
        tk_chi_so AS (
            SELECT COUNT(*)::INT AS so_phong_da_nhap_chi_so,
                   COALESCE(SUM(cs.chi_so_dien_cuoi - cs.chi_so_dien_dau), 0) AS tong_dien_tieu_thu,
                   COALESCE(SUM(cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau), 0) AS tong_nuoc_tieu_thu
            FROM chi_so cs
            JOIN phong p ON p.ma_phong = cs.ma_phong
            WHERE cs.thang = %s AND {p_khu_filter}
        ),
        tk_hd AS (
            SELECT COUNT(*)::INT AS so_phong_chua_nop_dien_nuoc
            FROM hoa_don hd
            JOIN phong p ON p.ma_phong = hd.ma_phong
            WHERE hd.loai = 'DIEN_NUOC' AND hd.thang = %s AND hd.trang_thai = 'CHUA_NOP' AND {p_khu_filter}
        )
        SELECT %s AS thang_hien_tai,
               tk_phong.tong_sv_dang_o,
               tk_phong.tong_suc_chua_kha_dung,
               tk_phong.so_giuong_trong,
               tk_phong.tong_so_phong,
               tk_chi_so.so_phong_da_nhap_chi_so,
               tk_chi_so.tong_dien_tieu_thu,
               tk_chi_so.tong_nuoc_tieu_thu,
               tk_hd.so_phong_chua_nop_dien_nuoc
        FROM tk_phong, tk_chi_so, tk_hd
        """,
        [*khu_params, thang_ht, *khu_params, thang_ht, *khu_params, thang_ht],
    )

    web_visits = await fetch_one("SELECT * FROM v_luot_truy_cap_web")
    ky_hoc = await fetch_one(
        "SELECT ma_ky, ten_ky, ngay_bat_dau, ngay_ket_thuc FROM ky_hoc WHERE dang_hien_hanh = TRUE LIMIT 1"
    )
    yc_khu_filter = "COALESCE(yc.ma_khu, p.ma_khu) = %s" if scope_khu else "COALESCE(yc.ma_khu, p.ma_khu) IN (%s, %s)"
    quick = await fetch_one(
        f"""
        SELECT
            (
                SELECT COUNT(*)::INT
                FROM yeu_cau_doi_phong yc
                JOIN phong p ON p.ma_phong = yc.phong_hien_tai
                WHERE yc.trang_thai = 'CHO_XU_LY' AND {p_khu_filter}
            ) AS yc_doi_phong_cho,
            (
                SELECT COUNT(*)::INT
                FROM yeu_cau_bao_tri yc
                LEFT JOIN phong p ON p.ma_phong = yc.ma_phong
                WHERE yc.trang_thai IN ('MOI', 'DA_TIEP_NHAN', 'DANG_XU_LY') AND {yc_khu_filter}
            ) AS yc_bao_tri_mo,
            (
                SELECT COUNT(*)::INT
                FROM v_phong_chi_tiet
                WHERE so_nguoi_o > 0 AND da_ky_hop_dong = FALSE AND {khu_filter}
            ) AS phong_chua_ky_hd
        """,
        [*khu_params, *khu_params, *khu_params],
    )
    return {
        "pham_vi_khu": scope_khu,
        "tong_quan": summary,
        "luot_truy_cap_web": web_visits or {"hom_nay": 0, "tuan_nay": 0, "thang_nay": 0},
        "ky_hoc": ky_hoc,
        "canh_bao_nhanh": quick,
    }

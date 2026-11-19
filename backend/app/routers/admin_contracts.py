from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth import require_admin
from app.db import fetch_all, fetch_one, transaction

router = APIRouter(prefix="/api/admin/contracts", tags=["Quản lý - Hợp đồng nội trú"])


class MarkSignedRequest(BaseModel):
    ma_phong: int
    mssv_dai_dien: str
    ma_ky: str | None = None


@router.get("")
async def list_student_contracts(
    ma_ky: str | None = None,
    ma_khu: str | None = None,
    trang_thai: Literal["TAT_CA", "DA_KY", "CHUA_KY"] = "TAT_CA",
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    _admin=Depends(require_admin),
):
    """
    Hợp đồng được ký ngoài thực tế.
    Hiển thị số lượng đã ký / chưa ký và danh sách sinh viên nội trú kèm trạng thái hợp đồng.
    """
    ky_row = await fetch_one("SELECT fn_ky_hoc_hien_hanh() AS ma_ky")
    target_ky = ma_ky or (ky_row["ma_ky"] if ky_row else "HK1_2026_2027")

    stats = await fetch_one(
        """
        SELECT
            COUNT(*) FILTER (WHERE hd.ma_hd IS NOT NULL)::INT AS so_da_ky,
            COUNT(*) FILTER (WHERE hd.ma_hd IS NULL)::INT AS so_chua_ky
        FROM luu_tru lt
        LEFT JOIN hop_dong hd
            ON hd.ma_phong = lt.ma_phong
           AND hd.ma_ky = lt.ma_ky
           AND hd.trang_thai = 'HIEU_LUC'
        WHERE lt.ma_ky = %s
          AND lt.ngay_ra IS NULL
        """,
        (target_ky,),
    )

    conditions = ["lt.ma_ky = %s", "lt.ngay_ra IS NULL"]
    params: list = [target_ky]

    if ma_khu and ma_khu.strip():
        conditions.append("p.ma_khu = %s")
        params.append(ma_khu.strip().upper())
    if trang_thai == "DA_KY":
        conditions.append("hd.ma_hd IS NOT NULL")
    elif trang_thai == "CHUA_KY":
        conditions.append("hd.ma_hd IS NULL")
    if search and search.strip():
        conditions.append("(sv.mssv ILIKE %s OR sv.ho_ten ILIKE %s OR p.ten_phong ILIKE %s)")
        q = f"%{search.strip()}%"
        params.extend([q, q, q])

    where_sql = " AND ".join(conditions)
    offset = (page - 1) * page_size

    base_from = """
        FROM luu_tru lt
        JOIN sinh_vien sv ON sv.mssv = lt.mssv
        JOIN phong p ON p.ma_phong = lt.ma_phong
        JOIN ky_hoc kh ON kh.ma_ky = lt.ma_ky
        LEFT JOIN hop_dong hd
            ON hd.ma_phong = lt.ma_phong
           AND hd.ma_ky = lt.ma_ky
           AND hd.trang_thai = 'HIEU_LUC'
        LEFT JOIN sinh_vien rep ON rep.mssv = hd.mssv_dai_dien
    """

    count_row = await fetch_one(
        f"SELECT COUNT(*)::INT AS total {base_from} WHERE {where_sql}",
        params,
    )
    items = await fetch_all(
        f"""
        SELECT
            sv.mssv,
            sv.ho_ten,
            sv.nganh,
            sv.sdt,
            p.ma_phong,
            p.ten_phong,
            p.ma_khu,
            lt.ma_ky,
            kh.ten_ky,
            hd.ma_hd,
            hd.mssv_dai_dien,
            rep.ho_ten AS ten_dai_dien,
            hd.ngay_ky,
            CASE WHEN hd.ma_hd IS NOT NULL THEN 'DA_KY' ELSE 'CHUA_KY' END AS trang_thai_hop_dong
        {base_from}
        WHERE {where_sql}
        ORDER BY
            CASE WHEN hd.ma_hd IS NULL THEN 0 ELSE 1 END ASC,
            p.ten_phong ASC,
            sv.ho_ten ASC
        LIMIT %s OFFSET %s
        """,
        [*params, page_size, offset],
    )
    semesters = await fetch_all(
        "SELECT ma_ky, ten_ky, ngay_bat_dau, ngay_ket_thuc, dang_hien_hanh FROM ky_hoc ORDER BY ngay_bat_dau DESC"
    )

    return {
        "ma_ky": target_ky,
        "thong_ke": stats or {"so_da_ky": 0, "so_chua_ky": 0},
        "ky_hoc_list": semesters,
        "items": items,
        "total": count_row["total"] if count_row else 0,
        "page": page,
        "page_size": page_size,
    }


@router.post("/confirm-signed")
async def confirm_contract_signed(
    payload: MarkSignedRequest, _admin=Depends(require_admin)
):
    """Cập nhật trạng thái đã ký hợp đồng ngoài thực tế cho phòng."""
    mssv_u = payload.mssv_dai_dien.strip().upper()
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute("SELECT fn_ky_hoc_hien_hanh() AS ma_ky")
        ky = payload.ma_ky or (await cur.fetchone())["ma_ky"]
        await cur.execute(
            """
            INSERT INTO hop_dong (ma_phong, ma_ky, mssv_dai_dien, ngay_ky, trang_thai)
            VALUES (%s, %s, %s, CURRENT_DATE, 'HIEU_LUC')
            RETURNING *
            """,
            (payload.ma_phong, ky, mssv_u),
        )
        hd = await cur.fetchone()
        await cur.execute("SELECT sp_tao_hoa_don_ktx_ky(%s)", (ky,))
    return {"thanh_cong": True, "hop_dong": hd}

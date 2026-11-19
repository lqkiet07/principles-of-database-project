from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.db import fetch_all, fetch_one, transaction

router = APIRouter(prefix="/api/admin/room-transfers", tags=["Quản lý - Yêu cầu đổi phòng"])


class ApproveTransferRequest(BaseModel):
    ma_phong_moi: int
    ghi_chu_duyet: str | None = Field(default=None, max_length=1000)


class RejectTransferRequest(BaseModel):
    ly_do_tu_choi: str = Field(..., min_length=3, max_length=500)


@router.get("")
async def list_room_transfers(
    trang_thai: Literal["TAT_CA", "CHO_XU_LY", "DA_DUYET", "TU_CHOI"] = "TAT_CA",
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    _admin=Depends(require_admin),
):
    conditions = ["1=1"]
    params: list = []

    if trang_thai != "TAT_CA":
        conditions.append("yc.trang_thai = %s")
        params.append(trang_thai)
    if search and search.strip():
        conditions.append("(sv.mssv ILIKE %s OR sv.ho_ten ILIKE %s OR p1.ten_phong ILIKE %s)")
        q = f"%{search.strip()}%"
        params.extend([q, q, q])

    where_sql = " AND ".join(conditions)
    offset = (page - 1) * page_size

    count_row = await fetch_one(
        f"""
        SELECT COUNT(*)::INT AS total
        FROM yeu_cau_doi_phong yc
        JOIN sinh_vien sv ON sv.mssv = yc.mssv
        JOIN phong p1 ON p1.ma_phong = yc.phong_hien_tai
        WHERE {where_sql}
        """,
        params,
    )
    items = await fetch_all(
        f"""
        SELECT yc.ma_yc, yc.mssv, sv.ho_ten, sv.gioi_tinh, sv.nganh, sv.sdt,
               yc.ma_ky, yc.phong_hien_tai, p1.ten_phong AS ten_phong_hien_tai, p1.ma_khu AS khu_hien_tai,
               yc.phong_moi, p2.ten_phong AS ten_phong_moi,
               yc.nguyen_vong_khu, yc.nguyen_vong_loai,
               yc.ly_do, yc.trang_thai, yc.ghi_chu_duyet, yc.ly_do_tu_choi,
               yc.thoi_gian, yc.ngay_xu_ly
        FROM yeu_cau_doi_phong yc
        JOIN sinh_vien sv ON sv.mssv = yc.mssv
        JOIN phong p1 ON p1.ma_phong = yc.phong_hien_tai
        LEFT JOIN phong p2 ON p2.ma_phong = yc.phong_moi
        WHERE {where_sql}
        ORDER BY
            CASE yc.trang_thai WHEN 'CHO_XU_LY' THEN 0 ELSE 1 END ASC,
            yc.thoi_gian DESC
        LIMIT %s OFFSET %s
        """,
        [*params, page_size, offset],
    )
    pending_row = await fetch_one(
        "SELECT COUNT(*)::INT AS cho_xu_ly FROM yeu_cau_doi_phong WHERE trang_thai = 'CHO_XU_LY'"
    )
    return {
        "items": items,
        "total": count_row["total"] if count_row else 0,
        "cho_xu_ly": pending_row["cho_xu_ly"] if pending_row else 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{ma_yc}/suggested-rooms")
async def get_suggested_rooms(ma_yc: int, _admin=Depends(require_admin)):
    yc = await fetch_one(
        """
        SELECT yc.*, sv.gioi_tinh
        FROM yeu_cau_doi_phong yc
        JOIN sinh_vien sv ON sv.mssv = yc.mssv
        WHERE yc.ma_yc = %s
        """,
        (ma_yc,),
    )
    if not yc:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu đổi phòng.")

    rooms = await fetch_all(
        """
        SELECT ma_phong, ten_phong, ma_khu, suc_chua, co_nau_an, gioi_tinh,
               so_nguoi_o, so_giuong_trong, gia_phong, trang_thai_phong
        FROM v_phong_chi_tiet
        WHERE gioi_tinh = %s
          AND ma_phong <> %s
          AND trang_thai_phong IN ('TRONG', 'CON_CHO')
          AND so_giuong_trong > 0
        ORDER BY
            CASE WHEN %s::VARCHAR IS NOT NULL AND ma_khu = %s THEN 0 ELSE 1 END ASC,
            CASE WHEN %s::INT IS NOT NULL AND suc_chua = %s THEN 0 ELSE 1 END ASC,
            CASE WHEN trang_thai_phong = 'CON_CHO' THEN 0 ELSE 1 END ASC,
            ten_phong ASC
        """,
        (
            yc["gioi_tinh"],
            yc["phong_hien_tai"],
            yc["nguyen_vong_khu"],
            yc["nguyen_vong_khu"],
            yc["nguyen_vong_loai"],
            yc["nguyen_vong_loai"],
        ),
    )
    return {"yeu_cau": yc, "phong_goi_y": rooms}


@router.post("/{ma_yc}/approve")
async def approve_transfer(
    ma_yc: int, payload: ApproveTransferRequest, _admin=Depends(require_admin)
):
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT sp_duyet_doi_phong(%s, %s, %s) AS res",
            (ma_yc, payload.ma_phong_moi, payload.ghi_chu_duyet),
        )
        r = await cur.fetchone()
    return r["res"]


@router.post("/{ma_yc}/reject")
async def reject_transfer(
    ma_yc: int, payload: RejectTransferRequest, _admin=Depends(require_admin)
):
    reason = payload.ly_do_tu_choi.strip()
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            UPDATE yeu_cau_doi_phong
            SET trang_thai = 'TU_CHOI', ly_do_tu_choi = %s, ngay_xu_ly = NOW()
            WHERE ma_yc = %s AND trang_thai = 'CHO_XU_LY'
            RETURNING *
            """,
            (reason, ma_yc),
        )
        yc = await cur.fetchone()
        if not yc:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy yêu cầu đổi phòng đang chờ xử lý.",
            )

        await cur.execute(
            """
            INSERT INTO thong_bao (mssv, ma_phong, loai, tieu_de, noi_dung)
            VALUES (%s, %s, 'DOI_PHONG', %s, %s)
            """,
            (
                yc["mssv"],
                yc["phong_hien_tai"],
                "Yêu cầu đổi phòng không được chấp thuận",
                f"Yêu cầu đổi phòng #{ma_yc} của bạn bị từ chối. Lý do: {reason}",
            ),
        )
    return {"thanh_cong": True, "yeu_cau": yc}

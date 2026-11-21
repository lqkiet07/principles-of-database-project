from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import assert_khu_access, get_scope_khu, require_admin, resolve_khu_filter
from app.db import fetch_all, fetch_one, transaction

router = APIRouter(prefix="/api/admin/maintenance", tags=["Quản lý - Bảo trì và sửa chữa"])

STATUS_ORDER = ["MOI", "DA_TIEP_NHAN", "DANG_XU_LY", "HOAN_TAT"]


class CreateMaintenanceRequest(BaseModel):
    pham_vi: Literal["PHONG", "NHIEU_PHONG", "KHU"] = "PHONG"
    ma_phong: int | None = None
    ma_phong_list: list[int] | None = None
    ma_khu: str | None = None
    nhom_su_co: Literal["DIEN", "NUOC", "NOI_THAT", "CONG_TRINH", "KHAC"]
    mo_ta: str = Field(..., min_length=3, max_length=1000)
    dat_phong_bao_tri: bool = False


class UpdateMaintenanceStatusRequest(BaseModel):
    trang_thai: Literal["MOI", "DA_TIEP_NHAN", "DANG_XU_LY", "HOAN_TAT"]
    ghi_chu_xu_ly: str | None = Field(default=None, max_length=1000)
    sdt_nguoi_sua: str | None = Field(default=None, max_length=15)
    ngay_sua: date | None = None


class BroadcastMaintenanceRequest(BaseModel):
    tieu_de: str = Field(..., min_length=3, max_length=200)
    noi_dung: str = Field(..., min_length=5, max_length=2000)
    ma_khu: str | None = None
    ma_phong_list: list[int] | None = None


@router.get("")
async def list_maintenance(
    ma_khu: str | None = None,
    ma_phong: int | None = None,
    trang_thai: str | None = None,
    nhom_su_co: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    admin=Depends(require_admin),
):
    effective_khu = resolve_khu_filter(admin, ma_khu)
    conditions = ["COALESCE(yc.ma_khu, p.ma_khu) IN ('A', 'B')"]
    params: list = []

    if effective_khu:
        conditions.append("COALESCE(yc.ma_khu, p.ma_khu) = %s")
        params.append(effective_khu)
    if ma_phong is not None:
        conditions.append("yc.ma_phong = %s")
        params.append(ma_phong)
    if trang_thai in STATUS_ORDER:
        conditions.append("yc.trang_thai = %s")
        params.append(trang_thai)
    if nhom_su_co in ("DIEN", "NUOC", "NOI_THAT", "CONG_TRINH", "KHAC"):
        conditions.append("yc.nhom_su_co = %s")
        params.append(nhom_su_co)
    if search and search.strip():
        conditions.append("(yc.mo_ta ILIKE %s OR p.ten_phong ILIKE %s OR sv.ho_ten ILIKE %s)")
        q = f"%{search.strip()}%"
        params.extend([q, q, q])

    where_sql = " AND ".join(conditions)
    offset = (page - 1) * page_size

    count_row = await fetch_one(
        f"""
        SELECT COUNT(*)::INT AS total
        FROM yeu_cau_bao_tri yc
        LEFT JOIN phong p ON p.ma_phong = yc.ma_phong
        LEFT JOIN sinh_vien sv ON sv.mssv = yc.mssv
        WHERE {where_sql}
        """,
        params,
    )
    items = await fetch_all(
        f"""
        SELECT yc.ma_yc, yc.ma_phong, p.ten_phong,
               COALESCE(yc.ma_khu, p.ma_khu) AS ma_khu,
               yc.mssv, sv.ho_ten AS ten_sinh_vien,
               yc.nhom_su_co, yc.mo_ta, yc.anh_url, yc.trang_thai,
               yc.ghi_chu_xu_ly, yc.sdt_nguoi_sua, yc.ngay_sua,
               yc.thoi_gian, yc.cap_nhat_luc
        FROM yeu_cau_bao_tri yc
        LEFT JOIN phong p ON p.ma_phong = yc.ma_phong
        LEFT JOIN sinh_vien sv ON sv.mssv = yc.mssv
        WHERE {where_sql}
        ORDER BY
            CASE yc.trang_thai
                WHEN 'MOI' THEN 0
                WHEN 'DA_TIEP_NHAN' THEN 1
                WHEN 'DANG_XU_LY' THEN 2
                ELSE 3
            END ASC,
            yc.thoi_gian DESC
        LIMIT %s OFFSET %s
        """,
        [*params, page_size, offset],
    )

    scope_khu = get_scope_khu(admin)
    room_where = "ma_khu = %s" if scope_khu else "ma_khu IN ('A', 'B')"
    room_params: list = [scope_khu] if scope_khu else []
    room_status = await fetch_all(
        f"""
        SELECT ma_phong, ten_phong, ma_khu, trang_thai_phong, so_yc_bao_tri,
               CASE
                   WHEN trang_thai_phong = 'BAO_TRI' THEN 'DANG_BAO_TRI'
                   WHEN so_yc_bao_tri > 0 THEN 'CO_YEU_CAU'
                   ELSE 'BINH_THUONG'
               END AS tinh_trang_bao_tri
        FROM v_phong_chi_tiet
        WHERE {room_where}
        ORDER BY ten_phong ASC
        """,
        room_params,
    )

    return {
        "pham_vi_khu": scope_khu,
        "items": items,
        "total": count_row["total"] if count_row else 0,
        "page": page,
        "page_size": page_size,
        "tinh_trang_phong": room_status,
    }


@router.post("", status_code=201)
async def create_maintenance(
    payload: CreateMaintenanceRequest, admin=Depends(require_admin)
):
    created_ids: list[int] = []
    async with transaction() as conn, conn.cursor() as cur:
        if payload.pham_vi == "KHU":
            mk = resolve_khu_filter(admin, payload.ma_khu)
            if not mk:
                raise HTTPException(status_code=400, detail="Vui lòng chọn khu cần bảo trì (Khu A hoặc Khu B).")
            await cur.execute(
                """
                INSERT INTO yeu_cau_bao_tri (ma_phong, ma_khu, mssv, nhom_su_co, mo_ta, trang_thai)
                VALUES (NULL, %s, NULL, %s, %s, 'MOI')
                RETURNING ma_yc
                """,
                (mk, payload.nhom_su_co, payload.mo_ta.strip()),
            )
            created_ids.append((await cur.fetchone())["ma_yc"])
        else:
            room_ids = (
                payload.ma_phong_list
                if payload.pham_vi == "NHIEU_PHONG" and payload.ma_phong_list
                else ([payload.ma_phong] if payload.ma_phong else [])
            )
            if not room_ids:
                raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất một phòng.")

            for mp in set(room_ids):
                await cur.execute("SELECT ma_khu FROM phong WHERE ma_phong = %s", (mp,))
                p = await cur.fetchone()
                if not p:
                    raise HTTPException(status_code=404, detail=f"Không tìm thấy phòng mã {mp}.")
                assert_khu_access(admin, p["ma_khu"])
                await cur.execute(
                    """
                    INSERT INTO yeu_cau_bao_tri (ma_phong, ma_khu, mssv, nhom_su_co, mo_ta, trang_thai)
                    VALUES (%s, %s, NULL, %s, %s, 'MOI')
                    RETURNING ma_yc
                    """,
                    (mp, p["ma_khu"], payload.nhom_su_co, payload.mo_ta.strip()),
                )
                created_ids.append((await cur.fetchone())["ma_yc"])
                if payload.dat_phong_bao_tri:
                    await cur.execute(
                        "UPDATE phong SET tinh_trang = 'BAO_TRI' WHERE ma_phong = %s",
                        (mp,),
                    )

    return {
        "thanh_cong": True,
        "ma_yc_list": created_ids,
        "thong_bao": f"Đã tạo {len(created_ids)} yêu cầu bảo trì.",
    }


@router.patch("/{ma_yc}/status")
async def update_maintenance_status(
    ma_yc: int, payload: UpdateMaintenanceStatusRequest, admin=Depends(require_admin)
):
    """Cập nhật trạng thái bảo trì (hỗ trợ lưu ghi chú, SĐT người sửa và ngày sửa khi tiếp nhận)."""
    yc_check = await fetch_one(
        """
        SELECT COALESCE(yc.ma_khu, p.ma_khu) AS ma_khu
        FROM yeu_cau_bao_tri yc
        LEFT JOIN phong p ON p.ma_phong = yc.ma_phong
        WHERE yc.ma_yc = %s
        """,
        (ma_yc,),
    )
    if not yc_check:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu bảo trì.")
    assert_khu_access(admin, yc_check["ma_khu"])

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            UPDATE yeu_cau_bao_tri
            SET trang_thai    = %s,
                ghi_chu_xu_ly = COALESCE(%s, ghi_chu_xu_ly),
                sdt_nguoi_sua = COALESCE(%s, sdt_nguoi_sua),
                ngay_sua      = COALESCE(%s, ngay_sua),
                cap_nhat_luc  = NOW()
            WHERE ma_yc = %s
            RETURNING *
            """,
            (
                payload.trang_thai,
                payload.ghi_chu_xu_ly.strip() if payload.ghi_chu_xu_ly else None,
                payload.sdt_nguoi_sua.strip() if payload.sdt_nguoi_sua else None,
                payload.ngay_sua,
                ma_yc,
            ),
        )
        row = await cur.fetchone()
    return row


@router.post("/broadcast")
async def broadcast_maintenance_notice(
    payload: BroadcastMaintenanceRequest, admin=Depends(require_admin)
):
    sent = 0
    scope_khu = get_scope_khu(admin)
    effective_khu = resolve_khu_filter(admin, payload.ma_khu)

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute("SELECT fn_ky_hoc_hien_hanh() AS ma_ky")
        ky = (await cur.fetchone())["ma_ky"]

        if payload.ma_phong_list:
            if scope_khu:
                await cur.execute(
                    "SELECT ma_khu FROM phong WHERE ma_phong = ANY(%s)",
                    (payload.ma_phong_list,),
                )
                for r in await cur.fetchall():
                    assert_khu_access(admin, r["ma_khu"])
            await cur.execute(
                """
                INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
                SELECT lt.mssv, lt.ma_phong, p.ma_khu, 'BAO_TRI', %s, %s
                FROM luu_tru lt
                JOIN phong p ON p.ma_phong = lt.ma_phong
                WHERE lt.ma_ky = %s AND lt.ngay_ra IS NULL
                  AND lt.ma_phong = ANY(%s)
                """,
                (payload.tieu_de.strip(), payload.noi_dung.strip(), ky, payload.ma_phong_list),
            )
            sent = cur.rowcount
        elif effective_khu:
            await cur.execute(
                """
                INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
                SELECT lt.mssv, lt.ma_phong, p.ma_khu, 'BAO_TRI', %s, %s
                FROM luu_tru lt
                JOIN phong p ON p.ma_phong = lt.ma_phong
                WHERE lt.ma_ky = %s AND lt.ngay_ra IS NULL
                  AND p.ma_khu = %s
                """,
                (payload.tieu_de.strip(), payload.noi_dung.strip(), ky, effective_khu),
            )
            sent = cur.rowcount
        else:
            await cur.execute(
                """
                INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
                SELECT lt.mssv, lt.ma_phong, p.ma_khu, 'BAO_TRI', %s, %s
                FROM luu_tru lt
                JOIN phong p ON p.ma_phong = lt.ma_phong
                WHERE lt.ma_ky = %s AND lt.ngay_ra IS NULL
                  AND p.ma_khu IN ('A', 'B')
                """,
                (payload.tieu_de.strip(), payload.noi_dung.strip(), ky),
            )
            sent = cur.rowcount

    return {
        "thanh_cong": True,
        "so_sinh_vien_nhan": sent,
        "thong_bao": f"Đã gửi thông báo đến {sent} sinh viên.",
    }

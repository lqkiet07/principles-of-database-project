from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.auth import require_admin
from app.db import fetch_all, fetch_one

router = APIRouter(prefix="/api/admin/access-logs", tags=["Quản lý - Nhật ký ra vào cổng"])

VN_TZ = timezone(timedelta(hours=7))


def _parse_cutoff(val: str | None) -> time:
    if not val or val.strip() in ("24:00", "24:00:00"):
        return time(23, 59, 59)
    parts = val.strip().split(":")
    h = min(int(parts[0]), 23)
    m = int(parts[1]) if len(parts) > 1 else 0
    return time(h, m, 59)


@router.get("")
async def list_access_logs(
    ngay: date | None = None,
    search: str | None = None,
    loai: Literal["TAT_CA", "RA", "VAO"] = "TAT_CA",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    _admin=Depends(require_admin),
):
    target_date = ngay or datetime.now(VN_TZ).date()
    conditions = ["(l.thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE = %s"]
    params: list = [target_date]

    if loai in ("RA", "VAO"):
        conditions.append("l.loai = %s")
        params.append(loai)
    if search and search.strip():
        conditions.append("(sv.mssv ILIKE %s OR sv.ho_ten ILIKE %s OR p.ten_phong ILIKE %s)")
        q = f"%{search.strip()}%"
        params.extend([q, q, q])

    where_sql = " AND ".join(conditions)
    offset = (page - 1) * page_size

    base_from = """
        FROM luot_ra_vao l
        JOIN sinh_vien sv ON sv.mssv = l.mssv
        LEFT JOIN luu_tru lt
            ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        LEFT JOIN phong p ON p.ma_phong = lt.ma_phong
    """

    count_row = await fetch_one(
        f"SELECT COUNT(*)::INT AS total {base_from} WHERE {where_sql}",
        params,
    )
    items = await fetch_all(
        f"""
        SELECT l.ma_luot, l.mssv, sv.ho_ten, sv.sdt, p.ten_phong, p.ma_khu,
               l.loai, l.thoi_gian
        {base_from}
        WHERE {where_sql}
        ORDER BY l.thoi_gian DESC
        LIMIT %s OFFSET %s
        """,
        [*params, page_size, offset],
    )
    return {
        "ngay": target_date.isoformat(),
        "items": items,
        "total": count_row["total"] if count_row else 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/unreturned")
async def get_unreturned_students(
    ngay: date | None = None,
    _admin=Depends(require_admin),
):
    target_date = ngay or datetime.now(VN_TZ).date()
    cfg = await fetch_one("SELECT gia_tri FROM cau_hinh WHERE khoa = 'moc_gio_chua_ve'")
    moc_str = cfg["gia_tri"] if cfg else "24:00"
    moc_time = _parse_cutoff(moc_str)

    rows = await fetch_all(
        "SELECT * FROM fn_sinh_vien_chua_ve(%s, %s)",
        (target_date, moc_time),
    )
    return {
        "ngay": target_date.isoformat(),
        "moc_gio": moc_str,
        "items": rows,
        "total": len(rows),
    }

from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.ai.clustering import fetch_stranger_gate_scans
from app.auth import assert_khu_access, get_scope_khu, require_admin, resolve_khu_filter
from app.db import fetch_all, fetch_one, transaction
from app.utils.bill_reports import build_daily_attendance_xlsx, build_stranger_scans_xlsx

router = APIRouter(prefix="/api/admin/access-logs", tags=["Quản lý - Điểm danh vân tay & Kiểm soát cổng"])

VN_TZ = timezone(timedelta(hours=7))


class GateScanRequest(BaseModel):
    ma_quet: str = Field(..., min_length=2, max_length=64)
    loai: Literal["VAO", "RA"] = "VAO"
    cong: str = Field(default="Cổng vân tay Khu A", min_length=2, max_length=50)
    ngay: date | None = None


@router.get("/daily-attendance")
async def get_daily_fingerprint_attendance(
    ngay: date | None = None,
    ma_khu: str | None = None,
    trang_thai: Literal["TAT_CA", "DA_DIEM_DANH", "CHUA_DIEM_DANH"] = "TAT_CA",
    loai_ra_vao: Literal["TAT_CA", "VAO", "RA"] = "TAT_CA",
    search: str | None = None,
    admin=Depends(require_admin),
):
    """Bảng điểm danh vân tay & trạng thái ra vào theo ngày cho sinh viên đang lưu trú KTX."""
    target_date = ngay or datetime.now(VN_TZ).date()
    scope_khu = get_scope_khu(admin)
    effective_khu = resolve_khu_filter(admin, ma_khu)

    conditions = ["lt.ma_ky = fn_ky_hoc_hien_hanh()", "lt.ngay_ra IS NULL", "p.ma_khu IN ('A', 'B')"]
    params: list = [target_date]

    if effective_khu:
        conditions.append("p.ma_khu = %s")
        params.append(effective_khu)

    if search and search.strip():
        conditions.append(
            "(sv.mssv ILIKE %s OR sv.ho_ten ILIKE %s OR p.ten_phong ILIKE %s OR sv.ma_van_tay ILIKE %s)"
        )
        q = f"%{search.strip()}%"
        params.extend([q, q, q, q])

    where_sql = " AND ".join(conditions)

    rows = await fetch_all(
        f"""
        SELECT
            sv.mssv,
            sv.ho_ten,
            sv.sdt,
            sv.ma_van_tay,
            p.ma_phong,
            p.ten_phong,
            p.ma_khu,
            COALESCE(hd.mssv_dai_dien = sv.mssv, FALSE) AS la_truong_phong,
            dd.thoi_gian_quet,
            dd.cong_quet,
            dd.loai_cuoi,
            CASE
                WHEN dd.trang_thai = 'DA_DIEM_DANH' THEN 'DA_DIEM_DANH'
                ELSE 'CHUA_DIEM_DANH'
            END AS trang_thai_ngay
        FROM luu_tru lt
        JOIN sinh_vien sv ON sv.mssv = lt.mssv
        JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN hop_dong hd
            ON hd.ma_phong = lt.ma_phong AND hd.ma_ky = lt.ma_ky AND hd.trang_thai = 'HIEU_LUC'
        LEFT JOIN diem_danh_hang_ngay dd
            ON dd.mssv = sv.mssv AND dd.ngay = %s
        WHERE {where_sql}
        ORDER BY p.ten_phong ASC, (hd.mssv_dai_dien = sv.mssv) DESC NULLS LAST, sv.mssv ASC
        """,
        params,
    )

    thong_ke = {
        "tong_sv_noi_tru": len(rows),
        "da_diem_danh": sum(1 for r in rows if r["trang_thai_ngay"] == "DA_DIEM_DANH"),
        "chua_diem_danh": sum(1 for r in rows if r["trang_thai_ngay"] == "CHUA_DIEM_DANH"),
        "dang_trong_ktx": sum(
            1 for r in rows if r["trang_thai_ngay"] == "DA_DIEM_DANH" and r["loai_cuoi"] == "VAO"
        ),
        "da_ra_ngoai": sum(
            1 for r in rows if r["trang_thai_ngay"] == "DA_DIEM_DANH" and r["loai_cuoi"] == "RA"
        ),
    }

    if trang_thai != "TAT_CA":
        rows = [r for r in rows if r["trang_thai_ngay"] == trang_thai]
    if loai_ra_vao != "TAT_CA":
        rows = [r for r in rows if r["loai_cuoi"] == loai_ra_vao]

    if scope_khu:
        alerts = await fetch_all(
            """
            SELECT ma_cb, ma_van_tay_quet, cong, loai_luot, mssv, ho_ten, ten_phong,
                   cho_phep_vao, ket_qua, ly_do, thoi_gian
            FROM canh_bao_cong_van_tay
            WHERE cong ILIKE %s OR ten_phong LIKE %s
            ORDER BY ma_cb DESC
            LIMIT 15
            """,
            (f"%Khu {scope_khu}%", f"{scope_khu}%"),
        )
    else:
        alerts = await fetch_all(
            """
            SELECT ma_cb, ma_van_tay_quet, cong, loai_luot, mssv, ho_ten, ten_phong,
                   cho_phep_vao, ket_qua, ly_do, thoi_gian
            FROM canh_bao_cong_van_tay
            ORDER BY ma_cb DESC
            LIMIT 15
            """
        )

    return {
        "pham_vi_khu": scope_khu,
        "ngay": target_date.isoformat(),
        "thong_ke": thong_ke,
        "items": rows,
        "nhat_ky_cong": alerts,
    }


@router.post("/scan-fingerprint")
async def scan_gate_fingerprint(payload: GateScanRequest, admin=Depends(require_admin)):
    """Quét vân tay tại cổng KTX: kiểm tra người lạ & ghi nhận điểm danh Vào/Ra kèm thời gian."""
    target_date = payload.ngay or datetime.now(VN_TZ).date()
    scope_khu = get_scope_khu(admin)
    ma_quet = payload.ma_quet.strip().upper()
    cong = payload.cong.strip()

    if scope_khu:
        sv_zone = await fetch_one(
            """
            SELECT p.ma_khu
            FROM sinh_vien sv
            JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
            JOIN phong p ON p.ma_phong = lt.ma_phong
            WHERE sv.ma_van_tay = %s OR sv.mssv = %s
            LIMIT 1
            """,
            (ma_quet, ma_quet),
        )
        if sv_zone and sv_zone["ma_khu"] != scope_khu:
            raise HTTPException(
                status_code=403,
                detail=f"Sinh viên thuộc Khu {sv_zone['ma_khu']}, không nằm trong phạm vi quản lý Khu {scope_khu} của bạn.",
            )
        cong = f"Cổng vân tay Khu {scope_khu}"

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT sp_quet_van_tay_cong_ktx(%s, %s, %s, %s) AS res",
            (payload.ma_quet.strip(), payload.loai, cong, target_date),
        )
        r = await cur.fetchone()
    return r["res"]


@router.post("/register-fingerprint/{mssv}")
async def register_student_fingerprint(mssv: str, admin=Depends(require_admin)):
    """Cấp mã vân tay cho sinh viên đang lưu trú KTX để được phép qua cổng."""
    mssv_u = mssv.strip().upper()
    lt = await fetch_one(
        """
        SELECT lt.ma_phong, p.ma_khu
        FROM luu_tru lt
        JOIN phong p ON p.ma_phong = lt.ma_phong
        WHERE lt.mssv = %s AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        """,
        (mssv_u,),
    )
    if not lt:
        raise HTTPException(
            status_code=400,
            detail="Chỉ cấp mã vân tay ra vào cổng cho sinh viên đang có phòng lưu trú tại KTX.",
        )
    assert_khu_access(admin, lt["ma_khu"])

    ma_vt = f"VT-{mssv_u}"
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "UPDATE sinh_vien SET ma_van_tay = %s WHERE mssv = %s RETURNING mssv, ho_ten, ma_van_tay",
            (ma_vt, mssv_u),
        )
        row = await cur.fetchone()
    return {
        "thanh_cong": True,
        "sinh_vien": row,
        "thong_bao": f"Đã đăng ký mã vân tay {ma_vt} cho sinh viên {row['ho_ten']} ({mssv_u}).",
    }


@router.get("")
async def list_access_logs(
    ngay: date | None = None,
    search: str | None = None,
    loai: Literal["TAT_CA", "RA", "VAO"] = "TAT_CA",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    admin=Depends(require_admin),
):
    target_date = ngay or datetime.now(VN_TZ).date()
    scope_khu = get_scope_khu(admin)
    conditions = ["(l.thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE = %s"]
    params: list = [target_date]

    if scope_khu:
        conditions.append("p.ma_khu = %s")
        params.append(scope_khu)
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
    admin=Depends(require_admin),
):
    target_date = ngay or datetime.now(VN_TZ).date()
    scope_khu = get_scope_khu(admin)
    if scope_khu:
        rows = await fetch_all(
            "SELECT * FROM fn_sinh_vien_chua_ve(%s, TIME '23:59:59') WHERE ma_khu = %s",
            (target_date, scope_khu),
        )
    else:
        rows = await fetch_all(
            "SELECT * FROM fn_sinh_vien_chua_ve(%s, TIME '23:59:59')",
            (target_date,),
        )
    return {
        "ngay": target_date.isoformat(),
        "moc_gio": "24:00",
        "items": rows,
        "total": len(rows),
    }


@router.get("/export-daily")
async def export_daily_attendance_xlsx(
    ngay: date | None = None,
    ma_khu: str | None = None,
    admin=Depends(require_admin),
):
    """Xuất file Excel danh sách điểm danh ra vào KTX theo ngày."""
    target_date = ngay or datetime.now(VN_TZ).date()
    scope_khu = get_scope_khu(admin)
    effective_khu = resolve_khu_filter(admin, ma_khu)

    conditions = ["lt.ma_ky = fn_ky_hoc_hien_hanh()", "lt.ngay_ra IS NULL", "p.ma_khu IN ('A', 'B')"]
    params: list = [target_date]
    if effective_khu:
        conditions.append("p.ma_khu = %s")
        params.append(effective_khu)

    items = await fetch_all(
        f"""
        SELECT
            sv.mssv, sv.ho_ten, sv.ma_van_tay,
            p.ten_phong, p.ma_khu,
            dd.thoi_gian_quet, dd.loai_cuoi,
            CASE
                WHEN dd.trang_thai = 'DA_DIEM_DANH' THEN 'DA_DIEM_DANH'
                ELSE 'CHUA_DIEM_DANH'
            END AS trang_thai_ngay
        FROM luu_tru lt
        JOIN sinh_vien sv ON sv.mssv = lt.mssv
        JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN diem_danh_hang_ngay dd
            ON dd.mssv = sv.mssv AND dd.ngay = %s
        WHERE {' AND '.join(conditions)}
        ORDER BY p.ten_phong ASC, sv.mssv ASC
        """,
        params,
    )
    scope_label = f"Khu {effective_khu or scope_khu}" if (effective_khu or scope_khu) else "Toàn KTX (Khu A & B)"
    suffix = f"khu_{(effective_khu or scope_khu).lower()}" if (effective_khu or scope_khu) else "toan_ktx"
    buf = build_daily_attendance_xlsx(target_date.strftime("%d/%m/%Y"), items, scope_label)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="danh_sach_ra_vao_{target_date.isoformat()}_{suffix}.xlsx"'
        },
    )


@router.get("/export-strangers")
async def export_stranger_gate_scans_xlsx(admin=Depends(require_admin)):
    """Xuất file Excel danh sách người lạ / từ chối quét vân tay tại cổng KTX."""
    scope_khu = get_scope_khu(admin)
    strangers = await fetch_stranger_gate_scans(scope_khu)
    if not strangers:
        raise HTTPException(
            status_code=400,
            detail="Hiện chưa có lượt quét người lạ hoặc từ chối mở cổng nào trong phạm vi quản lý.",
        )
    scope_label = f"Khu {scope_khu}" if scope_khu else "Toàn KTX (Khu A & B)"
    suffix = f"khu_{scope_khu.lower()}" if scope_khu else "toan_ktx"
    buf = build_stranger_scans_xlsx(strangers, scope_label)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="danh_sach_nguoi_la_quet_cong_{suffix}.xlsx"'
        },
    )

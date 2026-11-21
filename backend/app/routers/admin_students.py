from datetime import datetime
import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.ai.clustering import cluster_dormitory_students, fetch_stranger_gate_scans
from app.auth import (
    assert_khu_access,
    get_scope_khu,
    hash_password,
    require_admin,
    require_super_admin,
    resolve_khu_filter,
)
from app.db import fetch_all, fetch_one, transaction
from app.utils.bill_reports import build_cluster_list_xlsx, build_stranger_scans_xlsx

router = APIRouter(prefix="/api/admin/students", tags=["Quản lý - Hồ sơ sinh viên"])

MSSV_REGEX = re.compile(r"^[A-Z][0-9]{7}$")
PHONE_REGEX = re.compile(r"^0[0-9]{9,10}$")


class CreateStudentRequest(BaseModel):
    mssv: str = Field(..., min_length=8, max_length=8)
    ho_ten: str = Field(..., min_length=2, max_length=120)
    gioi_tinh: Literal["NAM", "NU"]
    nganh: str = Field(..., min_length=2, max_length=120)
    sdt: str = Field(..., min_length=10, max_length=11)
    email: str | None = None

    @field_validator("mssv")
    @classmethod
    def check_mssv(cls, v: str) -> str:
        val = v.strip().upper()
        if not MSSV_REGEX.match(val):
            raise ValueError("MSSV phải theo mẫu CTU: 1 chữ cái + 7 chữ số (ví dụ B2112345).")
        return val

    @field_validator("sdt")
    @classmethod
    def check_sdt(cls, v: str) -> str:
        val = v.strip()
        if not PHONE_REGEX.match(val):
            raise ValueError("Số điện thoại phải gồm 10–11 chữ số và bắt đầu bằng số 0.")
        return val


class UpdateStudentRequest(BaseModel):
    ho_ten: str = Field(..., min_length=2, max_length=120)
    gioi_tinh: Literal["NAM", "NU"]
    nganh: str = Field(..., min_length=2, max_length=120)
    sdt: str = Field(..., min_length=10, max_length=11)
    email: str = Field(..., min_length=10, max_length=120)

    @field_validator("sdt")
    @classmethod
    def check_sdt(cls, v: str) -> str:
        val = v.strip()
        if not PHONE_REGEX.match(val):
            raise ValueError("Số điện thoại phải gồm 10–11 chữ số và bắt đầu bằng số 0.")
        return val


class SendWarningRequest(BaseModel):
    noi_dung: str | None = Field(default=None, max_length=1000)


class SendRevocationNoticeRequest(BaseModel):
    thoi_gian_trinh_bay: datetime
    dia_diem_trinh_bay: str = Field(
        default="Phòng Quản lý Ký túc xá - Trường ĐH Cần Thơ",
        min_length=3,
        max_length=200,
    )
    ly_do: str = Field(
        default="Đóng trễ phí KTX vượt quá 2 kỳ quy định sau khi đã gửi cảnh cáo",
        min_length=3,
        max_length=1000,
    )


class RevokeRoomRequest(BaseModel):
    ly_do: str = Field(default="Đóng trễ phí KTX trên 2 kỳ", min_length=3, max_length=500)


async def _assert_student_zone(admin: dict, mssv: str) -> None:
    scope_khu = get_scope_khu(admin)
    if scope_khu is None:
        return
    row = await fetch_one(
        """
        SELECT p.ma_khu
        FROM luu_tru lt
        JOIN phong p ON p.ma_phong = lt.ma_phong
        WHERE lt.mssv = %s AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        """,
        (mssv.strip().upper(),),
    )
    if not row:
        raise HTTPException(
            status_code=403,
            detail=f"Sinh viên không lưu trú tại Khu {scope_khu}.",
        )
    assert_khu_access(admin, row["ma_khu"])


@router.get("")
async def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    search: str | None = None,
    nganh: str | None = None,
    ma_khu: str | None = None,
    trang_thai_o: Literal["TAT_CA", "DA_CO_PHONG", "CHUA_CO_PHONG"] = "TAT_CA",
    so_ky_tre_min: int | None = Query(default=None, ge=0, le=10),
    sort_by: Literal["mssv", "ho_ten", "nganh", "ten_phong"] = "mssv",
    sort_dir: Literal["asc", "desc"] = "asc",
    admin=Depends(require_admin),
):
    scope_khu = get_scope_khu(admin)
    effective_khu = resolve_khu_filter(admin, ma_khu)

    conditions: list[str] = ["1=1"]
    params: list = []

    if search and search.strip():
        conditions.append("(sv.mssv ILIKE %s OR sv.ho_ten ILIKE %s)")
        q = f"%{search.strip()}%"
        params.extend([q, q])
    if nganh and nganh.strip():
        conditions.append("sv.nganh = %s")
        params.append(nganh.strip())
    if effective_khu:
        conditions.append("p.ma_khu = %s")
        params.append(effective_khu)
    elif trang_thai_o == "DA_CO_PHONG":
        conditions.append("p.ma_phong IS NOT NULL AND p.ma_khu IN ('A', 'B')")
    elif trang_thai_o == "CHUA_CO_PHONG":
        conditions.append("p.ma_phong IS NULL")

    if so_ky_tre_min is not None and so_ky_tre_min > 0:
        conditions.append("sv.so_ky_dong_tre >= %s")
        params.append(so_ky_tre_min)

    where_sql = " AND ".join(conditions)
    sort_map = {
        "mssv": "sv.mssv",
        "ho_ten": "sv.ho_ten",
        "nganh": "sv.nganh",
        "ten_phong": "p.ten_phong",
    }
    order_sql = f"{sort_map[sort_by]} {'ASC' if sort_dir == 'asc' else 'DESC'} NULLS LAST, sv.mssv ASC"
    offset = (page - 1) * page_size

    base_from = """
        FROM sinh_vien sv
        LEFT JOIN luu_tru lt
            ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        LEFT JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN hop_dong hd
            ON hd.ma_phong = lt.ma_phong AND hd.ma_ky = lt.ma_ky AND hd.trang_thai = 'HIEU_LUC'
        LEFT JOIN xu_ly_no_phi_ktx xl
            ON xl.mssv = sv.mssv AND xl.ma_ky = lt.ma_ky
    """

    stats_conds = ["lt.ma_ky = fn_ky_hoc_hien_hanh()", "lt.ngay_ra IS NULL", "p.ma_khu IN ('A', 'B')"]
    stats_params: list = []
    if scope_khu:
        stats_conds.append("p.ma_khu = %s")
        stats_params.append(scope_khu)

    stats_row = await fetch_one(
        f"""
        SELECT COUNT(*) FILTER (WHERE hd.ma_hd IS NOT NULL)::INT AS so_da_ky,
               COUNT(*) FILTER (WHERE hd.ma_hd IS NULL)::INT AS so_chua_ky,
               COUNT(*) FILTER (WHERE sv.so_ky_dong_tre BETWEEN 1 AND 2)::INT AS so_tre_1_2_ky,
               COUNT(*) FILTER (WHERE sv.so_ky_dong_tre > 2)::INT AS so_tre_tren_2_ky,
               COUNT(*) FILTER (WHERE sv.so_ky_dong_tre > 2 AND xl.ma_xl IS NULL)::INT AS so_chua_canh_cao,
               COUNT(*) FILTER (WHERE sv.so_ky_dong_tre > 2 AND xl.trang_thai = 'DA_CANH_CAO')::INT AS so_da_canh_cao,
               COUNT(*) FILTER (WHERE sv.so_ky_dong_tre > 2 AND xl.trang_thai = 'DA_GUI_TB_THU_HOI')::INT AS so_da_gui_tb_thu_hoi
        FROM luu_tru lt
        JOIN sinh_vien sv ON sv.mssv = lt.mssv
        JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN hop_dong hd
            ON hd.ma_phong = lt.ma_phong AND hd.ma_ky = lt.ma_ky AND hd.trang_thai = 'HIEU_LUC'
        LEFT JOIN xu_ly_no_phi_ktx xl
            ON xl.mssv = sv.mssv AND xl.ma_ky = lt.ma_ky
        WHERE {' AND '.join(stats_conds)}
        """,
        stats_params,
    )

    if trang_thai_o == "TAT_CA" and not effective_khu and not ma_khu:
        sv_conds: list[str] = ["1=1"]
        sv_params: list = []
        if search and search.strip():
            sv_conds.append("(sv.mssv ILIKE %s OR sv.ho_ten ILIKE %s)")
            q = f"%{search.strip()}%"
            sv_params.extend([q, q])
        if nganh and nganh.strip():
            sv_conds.append("sv.nganh = %s")
            sv_params.append(nganh.strip())
        if so_ky_tre_min is not None and so_ky_tre_min > 0:
            sv_conds.append("sv.so_ky_dong_tre >= %s")
            sv_params.append(so_ky_tre_min)
        count_row = await fetch_one(
            f"SELECT COUNT(*)::INT AS total FROM sinh_vien sv WHERE {' AND '.join(sv_conds)}",
            sv_params,
        )
    else:
        count_row = await fetch_one(
            f"SELECT COUNT(*)::INT AS total {base_from} WHERE {where_sql}",
            params,
        )

    items = await fetch_all(
        f"""
        SELECT sv.mssv, sv.ho_ten, sv.gioi_tinh, sv.nganh, sv.sdt, sv.email,
               sv.so_ky_dong_tre,
               p.ma_phong, p.ten_phong, p.ma_khu, lt.ngay_vao,
               COALESCE(hd.mssv_dai_dien = sv.mssv, FALSE) AS la_truong_phong,
               CASE
                   WHEN p.ma_phong IS NULL THEN 'CHUA_XEP_PHONG'
                   WHEN hd.ma_hd IS NOT NULL THEN 'DA_KY'
                   ELSE 'CHUA_KY'
               END AS trang_thai_hop_dong,
               xl.trang_thai AS trang_thai_xu_ly_no,
               xl.ngay_canh_cao,
               xl.ngay_gui_tb_thu_hoi,
               xl.thoi_gian_trinh_bay,
               xl.dia_diem_trinh_bay,
               xl.ly_do_thu_hoi
        {base_from}
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT %s OFFSET %s
        """,
        [*params, page_size, offset],
    )
    nganh_rows = await fetch_all(
        "SELECT DISTINCT nganh FROM sinh_vien ORDER BY nganh ASC"
    )
    return {
        "pham_vi_khu": scope_khu,
        "items": items,
        "total": count_row["total"] if count_row else 0,
        "so_da_ky": stats_row["so_da_ky"] if stats_row else 0,
        "so_chua_ky": stats_row["so_chua_ky"] if stats_row else 0,
        "so_tre_1_2_ky": stats_row["so_tre_1_2_ky"] if stats_row else 0,
        "so_tre_tren_2_ky": stats_row["so_tre_tren_2_ky"] if stats_row else 0,
        "so_chua_canh_cao": stats_row["so_chua_canh_cao"] if stats_row else 0,
        "so_da_canh_cao": stats_row["so_da_canh_cao"] if stats_row else 0,
        "so_da_gui_tb_thu_hoi": stats_row["so_da_gui_tb_thu_hoi"] if stats_row else 0,
        "page": page,
        "page_size": page_size,
        "nganh_list": [r["nganh"] for r in nganh_rows],
    }


@router.post("/send-warning-all-overdue")
async def send_warning_all_overdue(admin=Depends(require_admin)):
    """Bước 1 hàng loạt: Gửi cảnh cáo đến tất cả sinh viên đang ở đóng trễ > 2 kỳ chưa nhận cảnh cáo."""
    scope_khu = get_scope_khu(admin)
    khu_cond = "p.ma_khu = %s" if scope_khu else "p.ma_khu IN ('A', 'B')"
    params: list = [scope_khu] if scope_khu else []

    targets = await fetch_all(
        f"""
        SELECT sv.mssv
        FROM sinh_vien sv
        JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN xu_ly_no_phi_ktx xl ON xl.mssv = sv.mssv AND xl.ma_ky = lt.ma_ky
        WHERE sv.so_ky_dong_tre > 2
          AND xl.ma_xl IS NULL
          AND {khu_cond}
        ORDER BY sv.mssv
        """,
        params,
    )
    if not targets:
        raise HTTPException(
            status_code=400,
            detail="Hiện không có sinh viên đóng trễ > 2 kỳ nào chưa được gửi cảnh cáo trong phạm vi quản lý.",
        )

    results = []
    async with transaction() as conn, conn.cursor() as cur:
        for t in targets:
            await cur.execute(
                "SELECT sp_gui_canh_cao_no_phi(%s, NULL, %s) AS res",
                (t["mssv"], admin["ten_dang_nhap"]),
            )
            r = await cur.fetchone()
            results.append(r["res"])

    return {
        "thanh_cong": True,
        "so_luong_canh_cao": len(results),
        "chi_tiet": results,
        "thong_bao": f"Đã gửi cảnh cáo đến {len(results)} sinh viên đóng trễ > 2 kỳ.",
    }


@router.post("/{mssv}/send-warning")
async def send_warning_to_student(
    mssv: str,
    payload: SendWarningRequest | None = None,
    admin=Depends(require_admin),
):
    """Bước 1: Gửi cảnh cáo chậm đóng phí KTX cho sinh viên đóng trễ > 2 kỳ."""
    await _assert_student_zone(admin, mssv)
    noi_dung = payload.noi_dung if payload else None
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT sp_gui_canh_cao_no_phi(%s, %s, %s) AS res",
            (mssv.strip().upper(), noi_dung, admin["ten_dang_nhap"]),
        )
        r = await cur.fetchone()
    return r["res"]


@router.post("/{mssv}/send-revocation-notice")
async def send_revocation_notice_to_student(
    mssv: str,
    payload: SendRevocationNoticeRequest,
    admin=Depends(require_admin),
):
    """Bước 2: Sau khi đã cảnh cáo, gửi thông báo thu hồi phòng kèm thời gian & địa điểm đến trình bày."""
    await _assert_student_zone(admin, mssv)
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT sp_gui_thong_bao_thu_hoi_phong(%s, %s, %s, %s, %s) AS res",
            (
                mssv.strip().upper(),
                payload.thoi_gian_trinh_bay,
                payload.dia_diem_trinh_bay.strip(),
                payload.ly_do.strip(),
                admin["ten_dang_nhap"],
            ),
        )
        r = await cur.fetchone()
    return r["res"]


@router.post("/{mssv}/revoke-room")
async def revoke_student_room(
    mssv: str,
    payload: RevokeRoomRequest | None = None,
    admin=Depends(require_admin),
):
    """Bước 3: Thu hồi phòng chính thức sau khi đã cảnh cáo & gửi thông báo mời trình bày."""
    await _assert_student_zone(admin, mssv)
    mssv_u = mssv.strip().upper()
    xl = await fetch_one(
        "SELECT trang_thai FROM xu_ly_no_phi_ktx WHERE mssv = %s AND ma_ky = fn_ky_hoc_hien_hanh()",
        (mssv_u,),
    )
    if not xl or xl["trang_thai"] != "DA_GUI_TB_THU_HOI":
        raise HTTPException(
            status_code=400,
            detail="Vui lòng thực hiện đủ 2 bước: (1) Gửi cảnh cáo và (2) Gửi thông báo thu hồi phòng (hẹn trình bày) trước khi thu hồi chỗ ở chính thức.",
        )

    ly_do = payload.ly_do if payload else "Đóng trễ phí KTX trên 2 kỳ"
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT sp_thu_hoi_phong_sinh_vien(%s, %s) AS res",
            (mssv_u, ly_do),
        )
        r = await cur.fetchone()
    return r["res"]


class ClusterNotifyRequest(BaseModel):
    nhom_code: Literal["NHAC_THANH_TOAN"]
    mssv: str | None = None
    tieu_de: str | None = Field(default=None, max_length=200)
    noi_dung: str | None = Field(default=None, max_length=1500)


@router.get("/ai/clusters")
async def get_student_clusters(admin=Depends(require_admin)):
    """Phân nhóm sinh viên nội trú theo phí KTX và giờ giấc cổng vân tay."""
    return await cluster_dormitory_students(get_scope_khu(admin))


def _cluster_export_response(
    nhom_code: Literal["GUONG_MAU", "NHAC_THANH_TOAN", "LUU_Y_GIO_GIAC"],
    students: list[dict],
    scope_khu: str | None,
) -> StreamingResponse:
    if not students:
        raise HTTPException(
            status_code=400,
            detail="Hiện chưa có sinh viên thuộc nhóm này trong phạm vi quản lý.",
        )

    scope_label = f"Khu {scope_khu}" if scope_khu else "Toàn KTX (Khu A & B)"
    buf = build_cluster_list_xlsx(nhom_code, students, scope_label)
    suffix = f"khu_{scope_khu.lower()}" if scope_khu else "toan_ktx"
    filename_map = {
        "GUONG_MAU": f"danh_sach_sv_guong_mau_{suffix}.xlsx",
        "NHAC_THANH_TOAN": f"danh_sach_sv_tre_phi_ktx_{suffix}.xlsx",
        "LUU_Y_GIO_GIAC": f"danh_sach_ra_vao_khuya_{suffix}.xlsx",
    }
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename_map[nhom_code]}"'
        },
    )


@router.get("/ai/clusters/export")
async def export_cluster_list(
    nhom_code: Literal["GUONG_MAU", "NHAC_THANH_TOAN", "LUU_Y_GIO_GIAC"] = Query(
        default="GUONG_MAU"
    ),
    admin=Depends(require_admin),
):
    """Xuất danh sách Excel theo từng nhóm sinh viên nội trú."""
    scope_khu = get_scope_khu(admin)
    data = await cluster_dormitory_students(scope_khu)
    filtered = [
        s
        for s in data.get("students", [])
        if nhom_code in s.get("nhom_codes", [s.get("nhom_code")])
    ]
    return _cluster_export_response(nhom_code, filtered, scope_khu)


@router.get("/ai/clusters/export-strangers")
async def export_cluster_strangers(admin=Depends(require_admin)):
    """Xuất danh sách Excel người lạ / từ chối quét vân tay cổng KTX."""
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


@router.get("/ai/clusters/export-commendation")
async def export_commendation_list(admin=Depends(require_admin)):
    """Xuất danh sách Excel sinh viên nội trú Gương mẫu / Ổn định."""
    scope_khu = get_scope_khu(admin)
    data = await cluster_dormitory_students(scope_khu)
    filtered = [
        s
        for s in data.get("students", [])
        if "GUONG_MAU" in s.get("nhom_codes", [s.get("nhom_code")])
    ]
    return _cluster_export_response("GUONG_MAU", filtered, scope_khu)


@router.post("/ai/clusters/notify")
async def notify_student_cluster(
    payload: ClusterNotifyRequest, admin=Depends(require_admin)
):
    """Gửi thông báo nhắc nhở đóng phí KTX trễ (>= 2 kỳ)."""
    scope_khu = get_scope_khu(admin)
    if payload.mssv:
        await _assert_student_zone(admin, payload.mssv)

    data = await cluster_dormitory_students(scope_khu)
    targets = [
        s
        for s in data.get("students", [])
        if payload.nhom_code in s.get("nhom_codes", [s.get("nhom_code")])
    ]
    if payload.mssv:
        mssv_u = payload.mssv.strip().upper()
        targets = [s for s in targets if s.get("mssv") == mssv_u]

    if not targets:
        raise HTTPException(
            status_code=400,
            detail="Không tìm thấy sinh viên phù hợp trong nhóm được chọn.",
        )

    han_row = await fetch_one("SELECT gia_tri FROM cau_hinh WHERE khoa = 'han_nop_ktx'")
    han_ktx = (han_row["gia_tri"] if han_row else None) or "quy định"

    loai_tb = "HOA_DON"
    default_title = "Nhắc nhở đóng phí KTX trễ hạn"
    default_body = (
        f"Ban Quản lý KTX ĐH Cần Thơ ghi nhận bạn chưa đóng phí KTX từ 2 kỳ trở lên. "
        f"Vui lòng hoàn tất thanh toán phí KTX (hạn hiện hành: {han_ktx}) để tránh bị gửi cảnh cáo "
        f"và xem xét thu hồi chỗ ở theo quy định."
    )

    title = (payload.tieu_de or "").strip() or default_title
    body = (payload.noi_dung or "").strip() or default_body
    mssv_list = [t["mssv"] for t in targets]

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
            SELECT lt.mssv, lt.ma_phong, p.ma_khu, %s, %s, %s
            FROM luu_tru lt
            JOIN phong p ON p.ma_phong = lt.ma_phong
            WHERE lt.ma_ky = fn_ky_hoc_hien_hanh()
              AND lt.ngay_ra IS NULL
              AND lt.mssv = ANY(%s)
            """,
            (loai_tb, title, body, mssv_list),
        )
        sent = cur.rowcount

    return {
        "thanh_cong": True,
        "nhom_code": payload.nhom_code,
        "so_sinh_vien_nhan": sent,
        "thong_bao": f"Đã gửi thông báo đến {sent} sinh viên.",
    }


@router.post("/send-late-reminders")
async def send_late_reminders_bulk(admin=Depends(require_admin)):
    """Nhắc nhở đóng tiền KTX trễ hạn đến tất cả sinh viên đang trễ 1–2 kỳ."""
    scope_khu = get_scope_khu(admin)
    khu_cond = "p.ma_khu = %s" if scope_khu else "p.ma_khu IN ('A', 'B')"
    params: list = [scope_khu] if scope_khu else []

    han_row = await fetch_one("SELECT gia_tri FROM cau_hinh WHERE khoa = 'han_nop_ktx'")
    han_ktx = han_row["gia_tri"] if han_row else "theo quy định"

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            f"""
            INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
            SELECT sv.mssv, lt.ma_phong, p.ma_khu, 'HOA_DON',
                   format('Nhắc nhở đóng tiền KTX trễ hạn (%s kỳ) - Phòng %s', sv.so_ky_dong_tre, p.ten_phong),
                   format('Sinh viên %s (%s) hiện đang đóng trễ phí KTX %s kỳ. Vui lòng hoàn tất thanh toán trước hạn %s để tránh bị gửi cảnh cáo và xem xét thu hồi phòng (áp dụng khi trễ trên 2 kỳ).',
                       sv.ho_ten, sv.mssv, sv.so_ky_dong_tre, %s)
            FROM sinh_vien sv
            JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
            JOIN phong p ON p.ma_phong = lt.ma_phong
            WHERE sv.so_ky_dong_tre BETWEEN 1 AND 2
              AND {khu_cond}
            """,
            [han_ktx, *params],
        )
        sent = cur.rowcount

    if sent == 0:
        raise HTTPException(
            status_code=400,
            detail="Hiện không có sinh viên nào đóng trễ 1–2 kỳ trong phạm vi quản lý.",
        )

    return {
        "thanh_cong": True,
        "so_sinh_vien_nhan": sent,
        "thong_bao": f"Đã gửi thông báo nhắc đóng phí trễ hạn đến {sent} sinh viên.",
    }


@router.post("/{mssv}/send-late-reminder")
async def send_late_reminder_student(mssv: str, admin=Depends(require_admin)):
    """Nhắc nhở 1 sinh viên đang đóng trễ phí KTX (>= 1 kỳ)."""
    await _assert_student_zone(admin, mssv)
    mssv_u = mssv.strip().upper()
    row = await fetch_one(
        """
        SELECT sv.mssv, sv.ho_ten, sv.so_ky_dong_tre, lt.ma_phong, p.ten_phong, p.ma_khu
        FROM sinh_vien sv
        JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        JOIN phong p ON p.ma_phong = lt.ma_phong
        WHERE sv.mssv = %s
        """,
        (mssv_u,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Sinh viên hiện không lưu trú trong kỳ hiện hành.")
    if (row["so_ky_dong_tre"] or 0) < 1:
        raise HTTPException(status_code=400, detail="Sinh viên này không có kỳ đóng trễ phí KTX.")

    han_row = await fetch_one("SELECT gia_tri FROM cau_hinh WHERE khoa = 'han_nop_ktx'")
    han_ktx = han_row["gia_tri"] if han_row else "theo quy định"

    title = f"Nhắc nhở đóng tiền KTX trễ hạn ({row['so_ky_dong_tre']} kỳ) - Phòng {row['ten_phong']}"
    body = (
        f"Sinh viên {row['ho_ten']} ({mssv_u}) hiện đang đóng trễ phí KTX {row['so_ky_dong_tre']} kỳ. "
        f"Đề nghị sinh viên khẩn trương hoàn tất thanh toán (hạn KTX hiện hành: {han_ktx}). "
        f"Lưu ý: Nếu đóng trễ vượt quá 2 kỳ, Ban Quản lý sẽ gửi cảnh cáo và thông báo thu hồi phòng."
    )

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
            VALUES (%s, %s, %s, 'HOA_DON', %s, %s)
            """,
            (mssv_u, row["ma_phong"], row["ma_khu"], title, body),
        )

    return {
        "thanh_cong": True,
        "thong_bao": f"Đã gửi thông báo nhắc đóng phí KTX trễ hạn đến sinh viên {row['ho_ten']} ({mssv_u}).",
    }


@router.get("/{mssv}")
async def get_student_detail(mssv: str, admin=Depends(require_admin)):
    await _assert_student_zone(admin, mssv)
    row = await fetch_one(
        """
        SELECT sv.*, p.ma_phong, p.ten_phong, p.ma_khu, p.suc_chua, p.co_nau_an,
               lt.ngay_vao,
               (hd.mssv_dai_dien = sv.mssv) AS la_dai_dien,
               tk.trang_thai AS trang_thai_tai_khoan,
               xl.trang_thai AS trang_thai_xu_ly_no,
               xl.ngay_canh_cao,
               xl.ngay_gui_tb_thu_hoi,
               xl.thoi_gian_trinh_bay,
               xl.dia_diem_trinh_bay,
               xl.ly_do_thu_hoi
        FROM sinh_vien sv
        LEFT JOIN luu_tru lt
            ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        LEFT JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN hop_dong hd
            ON hd.ma_phong = lt.ma_phong AND hd.ma_ky = lt.ma_ky AND hd.trang_thai = 'HIEU_LUC'
        LEFT JOIN tai_khoan tk ON tk.mssv = sv.mssv
        LEFT JOIN xu_ly_no_phi_ktx xl ON xl.mssv = sv.mssv AND xl.ma_ky = lt.ma_ky
        WHERE sv.mssv = %s
        """,
        (mssv.strip().upper(),),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")
    return row


@router.post("", status_code=201)
async def create_student(
    payload: CreateStudentRequest, _admin=Depends(require_super_admin)
):
    email = (payload.email or f"{payload.mssv.lower()}@student.ctu.edu.vn").strip().lower()
    expected_email = f"{payload.mssv.lower()}@student.ctu.edu.vn"
    if email != expected_email:
        raise HTTPException(
            status_code=400,
            detail=f"Email CTU phải theo định dạng {expected_email}.",
        )

    pw_hash = hash_password("Ktx@123")
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO sinh_vien (mssv, ho_ten, gioi_tinh, nganh, sdt, email)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                payload.mssv,
                payload.ho_ten.strip(),
                payload.gioi_tinh,
                payload.nganh.strip(),
                payload.sdt,
                email,
            ),
        )
        sv = await cur.fetchone()
        await cur.execute(
            """
            INSERT INTO tai_khoan (ten_dang_nhap, mat_khau_bam, vai_tro, mssv, ho_ten_hien_thi, trang_thai, phai_doi_mat_khau)
            VALUES (%s, %s, 'SINH_VIEN', %s, %s, 'HOAT_DONG', FALSE)
            """,
            (payload.mssv, pw_hash, payload.mssv, payload.ho_ten.strip()),
        )
    return {
        **sv,
        "thong_bao": f"Đã thêm hồ sơ sinh viên {payload.mssv}.",
    }


@router.put("/{mssv}")
async def update_student(
    mssv: str, payload: UpdateStudentRequest, admin=Depends(require_admin)
):
    await _assert_student_zone(admin, mssv)
    mssv_u = mssv.strip().upper()
    email = payload.email.strip().lower()
    expected_email = f"{mssv_u.lower()}@student.ctu.edu.vn"
    if email != expected_email:
        raise HTTPException(
            status_code=400,
            detail=f"Email CTU phải theo định dạng {expected_email}.",
        )

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT p.ten_phong, p.gioi_tinh
            FROM luu_tru lt
            JOIN phong p ON p.ma_phong = lt.ma_phong
            WHERE lt.mssv = %s AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
            """,
            (mssv_u,),
        )
        cur_room = await cur.fetchone()
        if cur_room and cur_room["gioi_tinh"] != payload.gioi_tinh:
            raise HTTPException(
                status_code=400,
                detail=f"Không thể đổi giới tính vì sinh viên đang ở phòng {cur_room['ten_phong']} ({cur_room['gioi_tinh']}).",
            )

        await cur.execute(
            """
            UPDATE sinh_vien
            SET ho_ten = %s, gioi_tinh = %s, nganh = %s, sdt = %s, email = %s
            WHERE mssv = %s
            RETURNING *
            """,
            (
                payload.ho_ten.strip(),
                payload.gioi_tinh,
                payload.nganh.strip(),
                payload.sdt,
                email,
                mssv_u,
            ),
        )
        sv = await cur.fetchone()
        if not sv:
            raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")

        await cur.execute(
            "UPDATE tai_khoan SET ho_ten_hien_thi = %s WHERE mssv = %s",
            (payload.ho_ten.strip(), mssv_u),
        )
    return sv

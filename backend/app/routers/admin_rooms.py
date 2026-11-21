import csv
import io
import json
import re
from typing import Literal

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.ai.semantic_search import search_rooms_semantic
from app.auth import assert_khu_access, get_scope_khu, require_admin, resolve_khu_filter
from app.db import fetch_all, fetch_one, transaction

router = APIRouter(prefix="/api/admin/rooms", tags=["Quản lý - Phòng và giường ở"])


class CreateZoneRequest(BaseModel):
    ma_khu: str = Field(..., min_length=1, max_length=10)
    ten_khu: str = Field(..., min_length=2, max_length=100)


class CreateRoomRequest(BaseModel):
    ten_phong: str = Field(..., min_length=2, max_length=20)
    ma_khu: str = Field(..., min_length=1, max_length=10)
    suc_chua: Literal[4, 6, 8]
    co_nau_an: bool = False
    gioi_tinh: Literal["NAM", "NU"]
    gia_phong: int = Field(..., ge=0)


class UpdateRoomRequest(BaseModel):
    suc_chua: Literal[4, 6, 8] | None = None
    co_nau_an: bool | None = None
    gioi_tinh: Literal["NAM", "NU"] | None = None
    gia_phong: int | None = Field(default=None, ge=0)
    tinh_trang: Literal["TRONG", "CON_CHO", "DAY", "BAO_TRI"] | None = None


class AutoAssignRequest(BaseModel):
    mssv_list: list[str] = Field(..., min_length=1)
    suc_chua: Literal[4, 6, 8]
    ma_khu: str | None = None
    co_nau_an: bool | None = None
    cho_phep_chua_day: bool = False


class ManualAssignRequest(BaseModel):
    mssv: str = Field(..., min_length=8, max_length=8)
    ma_phong: int


class MergeItem(BaseModel):
    mssv: str
    ma_phong_cu: int
    ma_phong_moi: int


class MergeConfirmRequest(BaseModel):
    de_xuat: list[MergeItem] = Field(..., min_length=1)


@router.get("/zones")
async def list_zones(admin=Depends(require_admin)):
    scope_khu = get_scope_khu(admin)
    where_sql = "WHERE k.ma_khu = %s" if scope_khu else "WHERE k.ma_khu IN ('A', 'B')"
    params: list = [scope_khu] if scope_khu else []
    rows = await fetch_all(
        f"""
        SELECT k.ma_khu, k.ten_khu,
               COUNT(p.ma_phong)::INT AS so_phong
        FROM khu k
        LEFT JOIN phong p ON p.ma_khu = k.ma_khu
        {where_sql}
        GROUP BY k.ma_khu, k.ten_khu
        ORDER BY k.ma_khu
        """,
        params,
    )
    return {"items": rows, "pham_vi_khu": scope_khu}


@router.post("/zones", status_code=201)
async def create_zone(_payload: CreateZoneRequest, _admin=Depends(require_admin)):
    raise HTTPException(
        status_code=400,
        detail="Hệ thống KTX chỉ quản lý cố định 2 khu: Khu A và Khu B.",
    )


@router.get("")
async def list_rooms(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    ma_khu: str | None = None,
    suc_chua: int | None = None,
    co_nau_an: bool | None = None,
    gioi_tinh: str | None = None,
    trang_thai: str | None = None,
    search: str | None = None,
    sort_by: Literal["ten_phong", "so_nguoi_o", "gia_phong", "trang_thai_phong"] = "ten_phong",
    sort_dir: Literal["asc", "desc"] = "asc",
    admin=Depends(require_admin),
):
    effective_khu = resolve_khu_filter(admin, ma_khu)
    conditions: list[str] = ["ma_khu IN ('A', 'B')"]
    params: list = []

    if effective_khu:
        conditions.append("ma_khu = %s")
        params.append(effective_khu)
    if suc_chua in (4, 6, 8):
        conditions.append("suc_chua = %s")
        params.append(suc_chua)
    if co_nau_an is not None:
        conditions.append("co_nau_an = %s")
        params.append(co_nau_an)
    if gioi_tinh in ("NAM", "NU"):
        conditions.append("gioi_tinh = %s")
        params.append(gioi_tinh)
    if trang_thai in ("TRONG", "CON_CHO", "DAY", "BAO_TRI"):
        conditions.append("trang_thai_phong = %s")
        params.append(trang_thai)
    if search and search.strip():
        conditions.append("ten_phong ILIKE %s")
        params.append(f"%{search.strip()}%")

    where_sql = " AND ".join(conditions)
    sort_col_map = {
        "ten_phong": "ten_phong",
        "so_nguoi_o": "so_nguoi_o",
        "gia_phong": "gia_phong",
        "trang_thai_phong": "trang_thai_phong",
    }
    order_sql = f"{sort_col_map[sort_by]} {'ASC' if sort_dir == 'asc' else 'DESC'}, ten_phong ASC"
    offset = (page - 1) * page_size

    count_row = await fetch_one(
        f"SELECT COUNT(*)::INT AS total FROM v_phong_chi_tiet WHERE {where_sql}",
        params,
    )
    items = await fetch_all(
        f"""
        SELECT ma_phong, ten_phong, ma_khu, ten_khu, suc_chua, co_nau_an, gioi_tinh,
               gia_phong, so_nguoi_o, so_giuong_trong, trang_thai_phong,
               da_ky_hop_dong, mssv_dai_dien, ten_dai_dien
        FROM v_phong_chi_tiet
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT %s OFFSET %s
        """,
        [*params, page_size, offset],
    )
    return {
        "pham_vi_khu": get_scope_khu(admin),
        "items": items,
        "total": count_row["total"] if count_row else 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/semantic-search")
async def semantic_search_admin_rooms(
    q: str = Query(..., min_length=2),
    limit: int = Query(12, ge=1, le=30),
    admin=Depends(require_admin),
):
    """Tìm kiếm phòng theo ngữ nghĩa tiếng Việt (giới hạn trong phạm vi khu được phân quyền)."""
    scope_khu = get_scope_khu(admin)
    items = await search_rooms_semantic(q, limit=limit, include_full=True, ma_khu=scope_khu)
    return {"query": q, "items": items, "pham_vi_khu": scope_khu}


@router.get("/{ma_phong}/residents")
async def get_room_residents(ma_phong: int, admin=Depends(require_admin)):
    room = await fetch_one(
        "SELECT * FROM v_phong_chi_tiet WHERE ma_phong = %s",
        (ma_phong,),
    )
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng.")
    assert_khu_access(admin, room["ma_khu"])

    residents = await fetch_all(
        """
        SELECT sv.mssv, sv.ho_ten, sv.gioi_tinh, sv.nganh, sv.sdt, sv.email, lt.ngay_vao,
               (hd.mssv_dai_dien = sv.mssv) AS la_dai_dien
        FROM luu_tru lt
        JOIN sinh_vien sv ON sv.mssv = lt.mssv
        LEFT JOIN hop_dong hd
            ON hd.ma_phong = lt.ma_phong AND hd.ma_ky = lt.ma_ky AND hd.trang_thai = 'HIEU_LUC'
        WHERE lt.ma_phong = %s
          AND lt.ma_ky = fn_ky_hoc_hien_hanh()
          AND lt.ngay_ra IS NULL
        ORDER BY (hd.mssv_dai_dien = sv.mssv) DESC NULLS LAST, sv.ho_ten ASC
        """,
        (ma_phong,),
    )
    return {"phong": room, "sinh_vien": residents}


@router.post("", status_code=201)
async def create_room(payload: CreateRoomRequest, admin=Depends(require_admin)):
    ma_khu = payload.ma_khu.strip().upper()
    assert_khu_access(admin, ma_khu)
    if ma_khu not in ("A", "B"):
        raise HTTPException(status_code=400, detail="Hệ thống chỉ quản lý 2 khu: Khu A và Khu B.")

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO phong (ten_phong, ma_khu, suc_chua, co_nau_an, gioi_tinh, gia_phong, tinh_trang)
            VALUES (%s, %s, %s, %s, %s, %s, 'TRONG')
            RETURNING ma_phong, ten_phong, ma_khu, suc_chua, co_nau_an, gioi_tinh, gia_phong, tinh_trang
            """,
            (
                payload.ten_phong.strip().upper(),
                ma_khu,
                payload.suc_chua,
                payload.co_nau_an,
                payload.gioi_tinh,
                payload.gia_phong,
            ),
        )
        row = await cur.fetchone()
    return row


@router.put("/{ma_phong}")
async def update_room(
    ma_phong: int, payload: UpdateRoomRequest, admin=Depends(require_admin)
):
    existing = await fetch_one("SELECT ma_khu FROM phong WHERE ma_phong = %s", (ma_phong,))
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng.")
    assert_khu_access(admin, existing["ma_khu"])

    fields = payload.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="Không có thông tin nào để cập nhật.")

    sets = ", ".join(f"{k} = %s" for k in fields)
    vals = list(fields.values()) + [ma_phong]
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            f"UPDATE phong SET {sets} WHERE ma_phong = %s RETURNING *",
            vals,
        )
        row = await cur.fetchone()
    return row


@router.post("/auto-assign/parse-file")
async def parse_mssv_file(
    file: UploadFile = File(...), _admin=Depends(require_admin)
):
    """Đọc danh sách MSSV từ file CSV, TXT hoặc Excel (.xlsx)."""
    content = await file.read()
    filename = (file.filename or "").lower()
    mssv_pattern = re.compile(r"\b[A-Za-z][0-9]{7}\b")
    found: list[str] = []

    if filename.endswith(".xlsx"):
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        for row in ws.iter_rows(values_only=True):
            for cell in row:
                if cell is not None:
                    found.extend(m.upper() for m in mssv_pattern.findall(str(cell)))
    else:
        text = content.decode("utf-8-sig", errors="ignore")
        if filename.endswith(".csv"):
            reader = csv.reader(io.StringIO(text))
            for row in reader:
                for cell in row:
                    found.extend(m.upper() for m in mssv_pattern.findall(cell))
        else:
            found.extend(m.upper() for m in mssv_pattern.findall(text))

    unique_mssvs = sorted(set(found))
    if not unique_mssvs:
        raise HTTPException(
            status_code=400,
            detail="Không tìm thấy MSSV hợp lệ nào (mẫu CTU gồm 1 chữ cái + 7 chữ số, ví dụ B2400185) trong file tải lên.",
        )
    return {"mssv_list": unique_mssvs, "so_luong": len(unique_mssvs)}


@router.post("/auto-assign/preview")
async def preview_auto_assign(
    payload: AutoAssignRequest, admin=Depends(require_admin)
):
    effective_khu = resolve_khu_filter(admin, payload.ma_khu)
    row = await fetch_one(
        """
        SELECT sp_xep_phong_tu_dong(%s::VARCHAR[], %s, %s, %s, %s, TRUE, NULL) AS result
        """,
        (
            [m.strip().upper() for m in payload.mssv_list if m.strip()],
            payload.suc_chua,
            effective_khu,
            payload.co_nau_an,
            payload.cho_phep_chua_day,
        ),
    )
    return row["result"]


@router.post("/auto-assign/confirm")
async def confirm_auto_assign(
    payload: AutoAssignRequest, admin=Depends(require_admin)
):
    effective_khu = resolve_khu_filter(admin, payload.ma_khu)
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT sp_xep_phong_tu_dong(%s::VARCHAR[], %s, %s, %s, %s, FALSE, NULL) AS result
            """,
            (
                [m.strip().upper() for m in payload.mssv_list if m.strip()],
                payload.suc_chua,
                effective_khu,
                payload.co_nau_an,
                payload.cho_phep_chua_day,
            ),
        )
        row = await cur.fetchone()
    return row["result"]


@router.post("/manual-assign")
async def manual_assign_student(
    payload: ManualAssignRequest, admin=Depends(require_admin)
):
    mssv = payload.mssv.strip().upper()
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute("SELECT fn_ky_hoc_hien_hanh() AS ma_ky")
        ky = (await cur.fetchone())["ma_ky"]

        await cur.execute(
            "SELECT ten_phong, ma_khu FROM phong WHERE ma_phong = %s",
            (payload.ma_phong,),
        )
        phong = await cur.fetchone()
        if not phong:
            raise HTTPException(status_code=404, detail="Không tìm thấy phòng.")
        assert_khu_access(admin, phong["ma_khu"])

        await cur.execute(
            """
            INSERT INTO luu_tru (mssv, ma_phong, ma_ky, ngay_vao)
            VALUES (%s, %s, %s, CURRENT_DATE)
            """,
            (mssv, payload.ma_phong, ky),
        )
        await cur.execute(
            """
            INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
            VALUES (%s, %s, %s, 'HE_THONG', %s, %s)
            """,
            (
                mssv,
                payload.ma_phong,
                phong["ma_khu"],
                f"Thông báo xếp phòng {phong['ten_phong']}",
                f"Bạn đã được Ban Quản lý xếp vào phòng {phong['ten_phong']} (Khu {phong['ma_khu']}) cho kỳ {ky}.",
            ),
        )
    return {
        "thanh_cong": True,
        "thong_bao": f"Đã xếp sinh viên {mssv} vào phòng {phong['ten_phong']}.",
    }


@router.delete("/{ma_phong}/residents/{mssv}")
async def checkout_resident(
    ma_phong: int, mssv: str, admin=Depends(require_admin)
):
    room = await fetch_one("SELECT ma_khu FROM phong WHERE ma_phong = %s", (ma_phong,))
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng.")
    assert_khu_access(admin, room["ma_khu"])

    mssv_u = mssv.strip().upper()
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute("SELECT fn_ky_hoc_hien_hanh() AS ma_ky")
        ky = (await cur.fetchone())["ma_ky"]

        await cur.execute(
            """
            SELECT ma_hd FROM hop_dong
            WHERE ma_phong = %s AND ma_ky = %s AND mssv_dai_dien = %s AND trang_thai = 'HIEU_LUC'
            FOR UPDATE
            """,
            (ma_phong, ky, mssv_u),
        )
        hd = await cur.fetchone()
        if hd:
            await cur.execute(
                """
                SELECT mssv FROM luu_tru
                WHERE ma_phong = %s AND ma_ky = %s AND ngay_ra IS NULL AND mssv <> %s
                ORDER BY ngay_vao ASC LIMIT 1
                """,
                (ma_phong, ky, mssv_u),
            )
            other = await cur.fetchone()
            if other:
                await cur.execute(
                    "UPDATE hop_dong SET mssv_dai_dien = %s WHERE ma_hd = %s",
                    (other["mssv"], hd["ma_hd"]),
                )
            else:
                await cur.execute(
                    "UPDATE hop_dong SET trang_thai = 'CHAM_DUT' WHERE ma_hd = %s",
                    (hd["ma_hd"],),
                )

        await cur.execute(
            """
            UPDATE luu_tru SET ngay_ra = CURRENT_DATE
            WHERE mssv = %s AND ma_phong = %s AND ma_ky = %s AND ngay_ra IS NULL
            RETURNING mssv
            """,
            (mssv_u, ma_phong, ky),
        )
        if not await cur.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Sinh viên không còn lưu trú tại phòng này.",
            )
    return {"thanh_cong": True, "thong_bao": f"Đã ghi nhận sinh viên {mssv_u} rời khỏi phòng."}


@router.get("/merge-proposals")
async def get_merge_proposals(admin=Depends(require_admin)):
    scope_khu = get_scope_khu(admin)
    row = await fetch_one("SELECT fn_de_xuat_gop_phong(NULL) AS items")
    items = row["items"] if row and row["items"] else []
    if scope_khu and items:
        rooms = await fetch_all(
            "SELECT ma_phong, ma_khu FROM phong WHERE ma_khu IN ('A', 'B')"
        )
        zone_map = {r["ma_phong"]: r["ma_khu"] for r in rooms}
        items = [
            it
            for it in items
            if zone_map.get(it.get("ma_phong_cu")) == scope_khu
            and zone_map.get(it.get("ma_phong_moi")) == scope_khu
        ]
    return {"items": items, "total": len(items), "pham_vi_khu": scope_khu}


@router.post("/merge-confirm")
async def confirm_merge_rooms(
    payload: MergeConfirmRequest, admin=Depends(require_admin)
):
    room_ids = {item.ma_phong_cu for item in payload.de_xuat} | {
        item.ma_phong_moi for item in payload.de_xuat
    }
    rooms = await fetch_all(
        "SELECT ma_phong, ma_khu FROM phong WHERE ma_phong = ANY(%s)",
        (list(room_ids),),
    )
    for r in rooms:
        assert_khu_access(admin, r["ma_khu"])

    data_json = json.dumps([item.model_dump() for item in payload.de_xuat])
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT sp_gop_phong_cuoi_ky(%s::JSONB, NULL) AS result",
            (data_json,),
        )
        row = await cur.fetchone()
    return row["result"]

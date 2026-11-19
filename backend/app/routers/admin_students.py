import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.ai.clustering import cluster_dormitory_students
from app.auth import hash_password, require_admin
from app.db import fetch_all, fetch_one, transaction

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


@router.get("")
async def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    search: str | None = None,
    nganh: str | None = None,
    ma_khu: str | None = None,
    trang_thai_o: Literal["TAT_CA", "DA_CO_PHONG", "CHUA_CO_PHONG"] = "TAT_CA",
    sort_by: Literal["mssv", "ho_ten", "nganh", "ten_phong"] = "mssv",
    sort_dir: Literal["asc", "desc"] = "asc",
    _admin=Depends(require_admin),
):
    conditions: list[str] = ["1=1"]
    params: list = []

    if search and search.strip():
        conditions.append("(sv.mssv ILIKE %s OR sv.ho_ten ILIKE %s)")
        q = f"%{search.strip()}%"
        params.extend([q, q])
    if nganh and nganh.strip():
        conditions.append("sv.nganh = %s")
        params.append(nganh.strip())
    if ma_khu and ma_khu.strip():
        conditions.append("p.ma_khu = %s")
        params.append(ma_khu.strip().upper())
    if trang_thai_o == "DA_CO_PHONG":
        conditions.append("p.ma_phong IS NOT NULL")
    elif trang_thai_o == "CHUA_CO_PHONG":
        conditions.append("p.ma_phong IS NULL")

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
    """

    count_row = await fetch_one(
        f"""
        SELECT COUNT(*)::INT AS total,
               COUNT(*) FILTER (WHERE p.ma_phong IS NOT NULL AND hd.ma_hd IS NOT NULL)::INT AS so_da_ky,
               COUNT(*) FILTER (WHERE p.ma_phong IS NOT NULL AND hd.ma_hd IS NULL)::INT AS so_chua_ky
        {base_from} WHERE {where_sql}
        """,
        params,
    )
    items = await fetch_all(
        f"""
        SELECT sv.mssv, sv.ho_ten, sv.gioi_tinh, sv.nganh, sv.sdt, sv.email,
               p.ma_phong, p.ten_phong, p.ma_khu, lt.ngay_vao,
               CASE
                   WHEN p.ma_phong IS NULL THEN 'CHUA_XEP_PHONG'
                   WHEN hd.ma_hd IS NOT NULL THEN 'DA_KY'
                   ELSE 'CHUA_KY'
               END AS trang_thai_hop_dong
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
        "items": items,
        "total": count_row["total"] if count_row else 0,
        "so_da_ky": count_row["so_da_ky"] if count_row else 0,
        "so_chua_ky": count_row["so_chua_ky"] if count_row else 0,
        "page": page,
        "page_size": page_size,
        "nganh_list": [r["nganh"] for r in nganh_rows],
    }


@router.get("/ai/clusters")
async def get_student_clusters(_admin=Depends(require_admin)):
    """Phân nhóm sinh viên nội trú bằng K-Means (k=3) & PCA."""
    return await cluster_dormitory_students()


@router.get("/{mssv}")
async def get_student_detail(mssv: str, _admin=Depends(require_admin)):
    row = await fetch_one(
        """
        SELECT sv.*, p.ma_phong, p.ten_phong, p.ma_khu, p.suc_chua, p.co_nau_an,
               lt.ngay_vao,
               (hd.mssv_dai_dien = sv.mssv) AS la_dai_dien,
               tk.trang_thai AS trang_thai_tai_khoan
        FROM sinh_vien sv
        LEFT JOIN luu_tru lt
            ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        LEFT JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN hop_dong hd
            ON hd.ma_phong = lt.ma_phong AND hd.ma_ky = lt.ma_ky AND hd.trang_thai = 'HIEU_LUC'
        LEFT JOIN tai_khoan tk ON tk.mssv = sv.mssv
        WHERE sv.mssv = %s
        """,
        (mssv.strip().upper(),),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên.")
    return row


@router.post("", status_code=201)
async def create_student(
    payload: CreateStudentRequest, _admin=Depends(require_admin)
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
    mssv: str, payload: UpdateStudentRequest, _admin=Depends(require_admin)
):
    mssv_u = mssv.strip().upper()
    email = payload.email.strip().lower()
    expected_email = f"{mssv_u.lower()}@student.ctu.edu.vn"
    if email != expected_email:
        raise HTTPException(
            status_code=400,
            detail=f"Email CTU phải theo định dạng {expected_email}.",
        )

    async with transaction() as conn, conn.cursor() as cur:
        # Kiểm tra nếu đổi giới tính mà sinh viên đang ở phòng khác giới
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

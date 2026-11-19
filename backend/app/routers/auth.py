from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import (
    check_login_rate_limit,
    clear_failed_logins,
    create_access_token,
    get_current_user,
    is_maintenance_mode,
    record_failed_login,
    revoke_token,
    verify_password,
)
from app.db import execute, fetch_one

router = APIRouter(prefix="/api/auth", tags=["Xác thực"])


class LoginRequest(BaseModel):
    ten_dang_nhap: str = Field(..., min_length=1, max_length=50)
    mat_khau: str = Field(..., min_length=1, max_length=128)


class VisitTrackRequest(BaseModel):
    duong_dan: str = Field("/", max_length=200)


@router.get("/system-status")
async def get_system_status():
    maint = await is_maintenance_mode()
    ky = await fetch_one(
        "SELECT ma_ky, ten_ky, ngay_bat_dau, ngay_ket_thuc FROM ky_hoc WHERE dang_hien_hanh = TRUE LIMIT 1"
    )
    return {"maintenance_mode": maint, "ky_hoc_hien_tai": ky}


@router.post("/track-visit")
async def track_web_visit(payload: VisitTrackRequest):
    """Ghi nhận lượt người dùng truy cập trang web."""
    await execute(
        "INSERT INTO luot_truy_cap_web (ma_tk, vai_tro, duong_dan) VALUES (NULL, NULL, %s)",
        (payload.duong_dan[:200],),
    )
    return {"ok": True}


@router.post("/login")
async def login(payload: LoginRequest, request: Request):
    username = payload.ten_dang_nhap.strip()
    client_ip = request.client.host if request.client else "unknown"

    check_login_rate_limit(username, client_ip)

    account = await fetch_one(
        """
        SELECT ma_tk, ten_dang_nhap, mat_khau_bam, vai_tro, mssv, ho_ten_hien_thi,
               trang_thai
        FROM tai_khoan
        WHERE lower(ten_dang_nhap) = lower(%s)
        """,
        (username,),
    )

    if not account or not verify_password(payload.mat_khau, account["mat_khau_bam"]):
        record_failed_login(username, client_ip)
        raise HTTPException(
            status_code=401,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác.",
        )

    if account["trang_thai"] != "HOAT_DONG":
        raise HTTPException(
            status_code=403,
            detail="Tài khoản của bạn đã bị khóa.",
        )

    clear_failed_logins(username, client_ip)
    token, _ = create_access_token(account)

    # Ghi nhận lượt truy cập trang web khi đăng nhập thành công
    await execute(
        "INSERT INTO luot_truy_cap_web (ma_tk, vai_tro, duong_dan) VALUES (%s, %s, %s)",
        (
            account["ma_tk"],
            account["vai_tro"],
            "/admin" if account["vai_tro"] == "QUAN_LY" else "/student",
        ),
    )

    maint = await is_maintenance_mode()
    ky = await fetch_one(
        "SELECT ma_ky, ten_ky FROM ky_hoc WHERE dang_hien_hanh = TRUE LIMIT 1"
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "ma_tk": account["ma_tk"],
            "ten_dang_nhap": account["ten_dang_nhap"],
            "vai_tro": account["vai_tro"],
            "mssv": account["mssv"],
            "ho_ten_hien_thi": account["ho_ten_hien_thi"],
        },
        "maintenance_mode": maint,
        "ky_hoc_hien_tai": ky,
    }


@router.post("/logout")
async def logout(user: dict[str, Any] = Depends(get_current_user)):
    revoke_token(user["jti"])
    return {"thanh_cong": True}


@router.get("/me")
async def me(user: dict[str, Any] = Depends(get_current_user)):
    maint = await is_maintenance_mode()
    ky = await fetch_one(
        "SELECT ma_ky, ten_ky, ngay_bat_dau, ngay_ket_thuc FROM ky_hoc WHERE dang_hien_hanh = TRUE LIMIT 1"
    )
    extra: dict[str, Any] = {}
    if user["vai_tro"] == "SINH_VIEN" and user.get("mssv"):
        room_info = await fetch_one(
            """
            SELECT p.ma_phong, p.ten_phong, p.ma_khu,
                   (hd.mssv_dai_dien = lt.mssv) AS la_dai_dien
            FROM luu_tru lt
            JOIN phong p ON p.ma_phong = lt.ma_phong
            LEFT JOIN hop_dong hd
                ON hd.ma_phong = lt.ma_phong AND hd.ma_ky = lt.ma_ky AND hd.trang_thai = 'HIEU_LUC'
            WHERE lt.mssv = %s AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
            """,
            (user["mssv"],),
        )
        unread = await fetch_one(
            "SELECT COUNT(*)::INT AS so_chua_doc FROM thong_bao WHERE mssv = %s AND da_doc = FALSE",
            (user["mssv"],),
        )
        extra["phong_hien_tai"] = room_info
        extra["thong_bao_chua_doc"] = unread["so_chua_doc"] if unread else 0

    return {
        "user": {
            "ma_tk": user["ma_tk"],
            "ten_dang_nhap": user["ten_dang_nhap"],
            "vai_tro": user["vai_tro"],
            "mssv": user["mssv"],
            "ho_ten_hien_thi": user["ho_ten_hien_thi"],
        },
        "maintenance_mode": maint,
        "ky_hoc_hien_tai": ky,
        **extra,
    }

"""
Xác thực bcrypt + JWT, hết hạn sau 30 phút không hoạt động,
giới hạn đăng nhập sai và kiểm tra phân quyền theo vai trò & khu vực phía máy chủ.
"""
from __future__ import annotations

import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db import fetch_one

security = HTTPBearer(auto_error=False)

ADMIN_ROLES = {"QUAN_LY", "QUAN_LY_KHU_A", "QUAN_LY_KHU_B"}
VALID_ZONES = {"A", "B"}

# Bộ nhớ phiên đăng nhập để hỗ trợ:
# 1. Thu hồi token ngay khi đăng xuất (logout)
# 2. Hết hạn sau 30 phút không hoạt động (sliding inactivity timeout)
_revoked_jtis: set[str] = set()
_last_activity: dict[str, float] = {}

# Giới hạn số lần đăng nhập sai theo (username, ip)
_failed_logins: dict[tuple[str, str], list[float]] = defaultdict(list)


def hash_password(raw_password: str) -> str:
    return bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_password(raw_password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw_password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def check_login_rate_limit(username: str, ip: str) -> None:
    key = (username.lower(), ip)
    now = time.time()
    window = settings.login_lockout_minutes * 60
    attempts = [t for t in _failed_logins[key] if now - t < window]
    _failed_logins[key] = attempts
    if len(attempts) >= settings.login_max_attempts:
        remaining = int((window - (now - attempts[0])) / 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Tài khoản tạm bị giới hạn do nhập sai mật khẩu quá {settings.login_max_attempts} lần. Vui lòng thử lại sau {remaining} phút.",
        )


def record_failed_login(username: str, ip: str) -> None:
    key = (username.lower(), ip)
    _failed_logins[key].append(time.time())


def clear_failed_logins(username: str, ip: str) -> None:
    _failed_logins.pop((username.lower(), ip), None)


def create_access_token(user: dict[str, Any]) -> tuple[str, str]:
    jti = secrets.token_urlsafe(16)
    now_dt = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["ma_tk"]),
        "username": user["ten_dang_nhap"],
        "role": user["vai_tro"],
        "ma_khu_phu_trach": user.get("ma_khu_phu_trach"),
        "mssv": user.get("mssv"),
        "jti": jti,
        "iat": int(now_dt.timestamp()),
        "exp": int((now_dt + timedelta(hours=12)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    _last_activity[jti] = time.time()
    return token, jti


def revoke_token(jti: str) -> None:
    _revoked_jtis.add(jti)
    _last_activity.pop(jti, None)


async def is_maintenance_mode() -> bool:
    row = await fetch_one("SELECT gia_tri FROM cau_hinh WHERE khoa = 'che_do_bao_tri'")
    return bool(row and str(row["gia_tri"]).lower() == "true")


async def get_current_user(
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    token: str | None = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif "token" in request.query_params:
        token = request.query_params["token"]

    if not token:
        raise HTTPException(status_code=401, detail="Vui lòng đăng nhập để tiếp tục.")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ.")

    jti = payload.get("jti", "")
    if jti in _revoked_jtis:
        raise HTTPException(status_code=401, detail="Bạn đã đăng xuất. Vui lòng đăng nhập lại.")

    now = time.time()
    timeout_sec = settings.session_timeout_minutes * 60
    last_act = _last_activity.get(jti)
    if last_act is not None and (now - last_act) > timeout_sec:
        revoke_token(jti)
        raise HTTPException(
            status_code=401,
            detail=f"Phiên đăng nhập đã hết hạn do không hoạt động quá {settings.session_timeout_minutes} phút.",
        )
    _last_activity[jti] = now

    ma_tk = int(payload["sub"])
    user = await fetch_one(
        """
        SELECT ma_tk, ten_dang_nhap, vai_tro, ma_khu_phu_trach, mssv, ho_ten_hien_thi,
               trang_thai, phai_doi_mat_khau
        FROM tai_khoan
        WHERE ma_tk = %s
        """,
        (ma_tk,),
    )
    if not user:
        raise HTTPException(status_code=401, detail="Tài khoản không còn tồn tại.")
    if user["trang_thai"] != "HOAT_DONG":
        raise HTTPException(status_code=403, detail="Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Ban Quản lý KTX.")

    # Chuẩn hóa khu phụ trách nhất quán với vai trò
    if user["vai_tro"] == "QUAN_LY_KHU_A":
        user["ma_khu_phu_trach"] = "A"
    elif user["vai_tro"] == "QUAN_LY_KHU_B":
        user["ma_khu_phu_trach"] = "B"
    elif user["vai_tro"] in ("QUAN_LY", "SINH_VIEN"):
        user["ma_khu_phu_trach"] = None

    user["jti"] = jti
    response.headers["X-Session-Timeout-Minutes"] = str(settings.session_timeout_minutes)
    return user


async def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if user["vai_tro"] not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập phân hệ Quản lý.")
    return user


async def require_super_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if user["vai_tro"] != "QUAN_LY":
        raise HTTPException(
            status_code=403,
            detail="Chức năng này chỉ dành cho Ban Quản lý toàn KTX.",
        )
    return user


def get_scope_khu(admin: dict[str, Any]) -> str | None:
    role = admin.get("vai_tro")
    if role == "QUAN_LY_KHU_A":
        return "A"
    if role == "QUAN_LY_KHU_B":
        return "B"
    khu = admin.get("ma_khu_phu_trach")
    if khu and str(khu).strip().upper() in VALID_ZONES:
        return str(khu).strip().upper()
    return None


def resolve_khu_filter(admin: dict[str, Any], requested_khu: str | None) -> str | None:
    req = requested_khu.strip().upper() if requested_khu and requested_khu.strip() else None
    if req is not None and req not in VALID_ZONES:
        raise HTTPException(
            status_code=400,
            detail="Hệ thống chỉ quản lý 2 khu: Khu A và Khu B.",
        )
    scope = get_scope_khu(admin)
    if scope is not None:
        if req is not None and req != scope:
            raise HTTPException(
                status_code=403,
                detail=f"Tài khoản của bạn chỉ được phép quản lý Khu {scope}.",
            )
        return scope
    return req


def assert_khu_access(admin: dict[str, Any], target_khu: str | None) -> None:
    target = (target_khu or "").strip().upper()
    if target and target not in VALID_ZONES:
        raise HTTPException(
            status_code=400,
            detail="Hệ thống chỉ quản lý 2 khu: Khu A và Khu B.",
        )
    scope = get_scope_khu(admin)
    if scope is not None and target != scope:
        raise HTTPException(
            status_code=403,
            detail=f"Bạn chỉ có quyền thao tác dữ liệu thuộc Khu {scope}.",
        )


async def require_student(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if user["vai_tro"] != "SINH_VIEN" or not user.get("mssv"):
        raise HTTPException(status_code=403, detail="Chức năng này chỉ dành cho sinh viên nội trú.")
    if await is_maintenance_mode():
        raise HTTPException(
            status_code=503,
            detail="Hệ thống đang được sửa chữa, vui lòng quay lại sau.",
        )
    return user

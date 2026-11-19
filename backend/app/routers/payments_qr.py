"""
Cổng thanh toán QR Sandbox nội bộ có chữ ký HMAC-SHA256 & thời hạn 5 phút.
Hỗ trợ quét mã QR thật bằng điện thoại trong cùng mạng LAN/Wi-Fi,
tự động đồng bộ trạng thái Đã nộp theo thời gian thực qua giao dịch ACID.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import socket
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth import require_student
from app.config import settings
from app.db import fetch_one, transaction

router = APIRouter(tags=["Thanh toán QR Sandbox"])

SESSION_TTL_SECONDS = 300  # 5 phút


class CreateQrSessionRequest(BaseModel):
    frontend_origin: str | None = None


class QrActionRequest(BaseModel):
    sig: str


def _detect_lan_ip() -> str:
    """Tự động dò địa chỉ IPv4 LAN/Wi-Fi đang hoạt động của máy chủ."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except Exception:
        pass
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass
    return "127.0.0.1"


def _resolve_qr_base_url(frontend_origin: str | None) -> tuple[str, str]:
    """
    Trả về (base_url, lan_ip).
    Nếu có PUBLIC_FRONTEND_URL (VD: ngrok/domain thật) thì ưu tiên dùng.
    Nếu trình duyệt đang truy cập từ localhost/127.0.0.1 thì tự thay bằng LAN IP để điện thoại quét mở được.
    """
    lan_ip = _detect_lan_ip()
    env_url = os.getenv("PUBLIC_FRONTEND_URL", "").strip().rstrip("/")
    if env_url:
        return env_url, lan_ip

    if frontend_origin:
        parsed = urlparse(frontend_origin.strip())
        if parsed.scheme in ("http", "https") and parsed.hostname:
            if parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
                return frontend_origin.strip().rstrip("/"), lan_ip
            port_part = f":{parsed.port}" if parsed.port else ""
            return f"{parsed.scheme}://{lan_ip}{port_part}", lan_ip

    return f"http://{lan_ip}:3000", lan_ip


def _sign_session(ma_phien: str, ma_hoa_don: int, so_tien: int, mssv: str) -> str:
    msg = f"{ma_phien}|{ma_hoa_don}|{so_tien}|{mssv}".encode("utf-8")
    return hmac.new(
        settings.jwt_secret.encode("utf-8"), msg, hashlib.sha256
    ).hexdigest()


def _remaining_seconds(het_han_luc: datetime) -> int:
    now = datetime.now(timezone.utc)
    exp = het_han_luc if het_han_luc.tzinfo else het_han_luc.replace(tzinfo=timezone.utc)
    return max(0, int((exp - now).total_seconds()))


def _bill_title(loai: str, ma_ky: str, thang: str) -> str:
    if loai == "KTX":
        return f"Tiền phòng KTX ({ma_ky})"
    parts = thang.split("-")
    thang_fmt = f"tháng {parts[1]}/{parts[0]}" if len(parts) == 2 else thang
    return f"Tiền điện nước {thang_fmt}"


@router.post("/api/student/bills/{ma_hoa_don}/qr-session")
async def create_qr_payment_session(
    ma_hoa_don: int,
    payload: CreateQrSessionRequest | None = None,
    user=Depends(require_student),
):
    """Tạo phiên thanh toán QR Sandbox (có chữ ký HMAC, hiệu lực 5 phút)."""
    mssv = user["mssv"]

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT hd.ma_hoa_don, hd.ma_phong, hd.ma_ky, hd.thang, hd.loai,
                   hd.so_tien, hd.trang_thai, p.ten_phong, p.ma_khu,
                   hdg.mssv_dai_dien
            FROM hoa_don hd
            JOIN phong p ON p.ma_phong = hd.ma_phong
            LEFT JOIN hop_dong hdg
                ON hdg.ma_phong = hd.ma_phong
               AND hdg.ma_ky = hd.ma_ky
               AND hdg.trang_thai = 'HIEU_LUC'
            WHERE hd.ma_hoa_don = %s
            FOR UPDATE OF hd
            """,
            (ma_hoa_don,),
        )
        hd = await cur.fetchone()
        if not hd:
            raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn.")
        if hd["trang_thai"] == "DA_NOP":
            raise HTTPException(status_code=400, detail="Hóa đơn này đã được thanh toán.")
        if not hd["mssv_dai_dien"]:
            raise HTTPException(
                status_code=400,
                detail="Phòng chưa có hợp đồng xác định sinh viên đại diện thanh toán.",
            )
        if hd["mssv_dai_dien"] != mssv:
            raise HTTPException(
                status_code=403,
                detail=f"Chỉ sinh viên đại diện phòng ({hd['mssv_dai_dien']}) mới có quyền thanh toán.",
            )

        # Hủy các phiên QR cũ chưa hoàn tất của cùng hóa đơn
        await cur.execute(
            """
            UPDATE phien_thanh_toan_qr
            SET trang_thai = 'DA_HUY'
            WHERE ma_hoa_don = %s AND trang_thai = 'CHO_THANH_TOAN'
            """,
            (ma_hoa_don,),
        )

        ma_phien = secrets.token_urlsafe(18)
        so_tien = int(hd["so_tien"])
        noi_dung_ck = f"KTXCTU HD{ma_hoa_don} {hd['ten_phong']} {mssv}"
        chu_ky = _sign_session(ma_phien, ma_hoa_don, so_tien, mssv)
        het_han_luc = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)

        await cur.execute(
            """
            INSERT INTO phien_thanh_toan_qr (
                ma_phien, ma_hoa_don, mssv_nguoi_tao, so_tien, noi_dung_ck,
                chu_ky_hmac, trang_thai, het_han_luc
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'CHO_THANH_TOAN', %s)
            """,
            (ma_phien, ma_hoa_don, mssv, so_tien, noi_dung_ck, chu_ky, het_han_luc),
        )

    base_url, lan_ip = _resolve_qr_base_url(
        payload.frontend_origin if payload else None
    )
    sig_short = chu_ky[:16]
    qr_url = f"{base_url}/pay/{ma_phien}?sig={sig_short}"

    return {
        "ma_phien": ma_phien,
        "sig": sig_short,
        "qr_url": qr_url,
        "local_pay_path": f"/pay/{ma_phien}?sig={sig_short}",
        "lan_ip": lan_ip,
        "ma_hoa_don": ma_hoa_don,
        "ten_phong": hd["ten_phong"],
        "loai": hd["loai"],
        "tieu_de": _bill_title(hd["loai"], hd["ma_ky"], hd["thang"]),
        "so_tien": so_tien,
        "noi_dung_ck": noi_dung_ck,
        "trang_thai": "CHO_THANH_TOAN",
        "het_han_luc": het_han_luc.isoformat(),
        "con_lai_giay": SESSION_TTL_SECONDS,
    }


@router.get("/api/student/payments/qr/{ma_phien}/status")
async def get_qr_session_status(ma_phien: str, user=Depends(require_student)):
    """Máy tính sinh viên polling trạng thái phiên QR theo thời gian thực."""
    row = await fetch_one(
        """
        SELECT ma_phien, ma_hoa_don, mssv_nguoi_tao, trang_thai,
               ma_giao_dich, het_han_luc, hoan_tat_luc
        FROM phien_thanh_toan_qr
        WHERE ma_phien = %s
        """,
        (ma_phien,),
    )
    if not row or row["mssv_nguoi_tao"] != user["mssv"]:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên thanh toán.")

    trang_thai = row["trang_thai"]
    con_lai = _remaining_seconds(row["het_han_luc"])

    if trang_thai == "CHO_THANH_TOAN" and con_lai == 0:
        async with transaction() as conn, conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE phien_thanh_toan_qr
                SET trang_thai = 'HET_HAN'
                WHERE ma_phien = %s AND trang_thai = 'CHO_THANH_TOAN'
                """,
                (ma_phien,),
            )
        trang_thai = "HET_HAN"

    return {
        "ma_phien": ma_phien,
        "trang_thai": trang_thai,
        "ma_giao_dich": row["ma_giao_dich"],
        "con_lai_giay": con_lai,
        "hoan_tat_luc": row["hoan_tat_luc"],
    }


@router.get("/api/payments/qr/{ma_phien}")
async def get_public_qr_checkout(
    ma_phien: str,
    sig: str = Query(..., min_length=8),
):
    """
    Endpoint công khai (bảo vệ bằng chữ ký HMAC `sig`) dành cho điện thoại sau khi quét mã QR.
    """
    row = await fetch_one(
        """
        SELECT q.ma_phien, q.ma_hoa_don, q.mssv_nguoi_tao, q.so_tien, q.noi_dung_ck,
               q.chu_ky_hmac, q.trang_thai, q.ma_giao_dich, q.het_han_luc, q.hoan_tat_luc,
               hd.loai, hd.ma_ky, hd.thang, hd.trang_thai AS trang_thai_hoa_don,
               p.ten_phong, p.ma_khu, sv.ho_ten AS ten_nguoi_nop
        FROM phien_thanh_toan_qr q
        JOIN hoa_don hd ON hd.ma_hoa_don = q.ma_hoa_don
        JOIN phong p ON p.ma_phong = hd.ma_phong
        JOIN sinh_vien sv ON sv.mssv = q.mssv_nguoi_tao
        WHERE q.ma_phien = %s
        """,
        (ma_phien,),
    )
    if not row or not hmac.compare_digest(row["chu_ky_hmac"][:16], sig):
        raise HTTPException(
            status_code=404,
            detail="Mã QR thanh toán không hợp lệ hoặc chữ ký xác thực không khớp.",
        )

    trang_thai = row["trang_thai"]
    con_lai = _remaining_seconds(row["het_han_luc"])

    if trang_thai == "CHO_THANH_TOAN":
        if row["trang_thai_hoa_don"] == "DA_NOP":
            trang_thai = "THANH_CONG"
        elif con_lai == 0:
            async with transaction() as conn, conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE phien_thanh_toan_qr
                    SET trang_thai = 'HET_HAN'
                    WHERE ma_phien = %s AND trang_thai = 'CHO_THANH_TOAN'
                    """,
                    (ma_phien,),
                )
            trang_thai = "HET_HAN"

    return {
        "ma_phien": row["ma_phien"],
        "ma_hoa_don": row["ma_hoa_don"],
        "ten_phong": row["ten_phong"],
        "ma_khu": row["ma_khu"],
        "tieu_de": _bill_title(row["loai"], row["ma_ky"], row["thang"]),
        "nguoi_nop": row["ten_nguoi_nop"],
        "mssv": row["mssv_nguoi_tao"],
        "so_tien": int(row["so_tien"]),
        "noi_dung_ck": row["noi_dung_ck"],
        "trang_thai": trang_thai,
        "ma_giao_dich": row["ma_giao_dich"],
        "het_han_luc": row["het_han_luc"],
        "hoan_tat_luc": row["hoan_tat_luc"],
        "con_lai_giay": con_lai,
    }


@router.post("/api/payments/qr/{ma_phien}/confirm")
async def confirm_public_qr_payment(ma_phien: str, payload: QrActionRequest):
    """
    Điện thoại xác nhận chuyển khoản Sandbox -> gọi thủ tục ACID `sp_thanh_toan_hoa_don`
    có khóa dòng `FOR UPDATE` chống thanh toán trùng.
    """
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT ma_phien, ma_hoa_don, mssv_nguoi_tao, so_tien,
                   chu_ky_hmac, trang_thai, het_han_luc
            FROM phien_thanh_toan_qr
            WHERE ma_phien = %s
            FOR UPDATE
            """,
            (ma_phien,),
        )
        session = await cur.fetchone()
        if not session or not hmac.compare_digest(session["chu_ky_hmac"][:16], payload.sig):
            raise HTTPException(status_code=403, detail="Chữ ký giao dịch QR không hợp lệ.")

        if session["trang_thai"] == "THANH_CONG":
            raise HTTPException(status_code=409, detail="Giao dịch này đã được thanh toán trước đó.")
        if session["trang_thai"] == "DA_HUY":
            raise HTTPException(status_code=400, detail="Phiên thanh toán này đã bị hủy.")
        if session["trang_thai"] == "HET_HAN" or _remaining_seconds(session["het_han_luc"]) == 0:
            await cur.execute(
                "UPDATE phien_thanh_toan_qr SET trang_thai = 'HET_HAN' WHERE ma_phien = %s",
                (ma_phien,),
            )
            raise HTTPException(status_code=400, detail="Mã QR đã hết hạn. Vui lòng tạo mã QR mới.")

        ma_gd = f"SBX-QR-{session['ma_hoa_don']}-{secrets.token_hex(4).upper()}"
        await cur.execute(
            "SELECT sp_thanh_toan_hoa_don(%s, %s, %s) AS res",
            (session["ma_hoa_don"], session["mssv_nguoi_tao"], ma_gd),
        )
        pay_res = (await cur.fetchone())["res"]

        await cur.execute(
            """
            UPDATE phien_thanh_toan_qr
            SET trang_thai = 'THANH_CONG',
                ma_giao_dich = %s,
                hoan_tat_luc = NOW()
            WHERE ma_phien = %s
            RETURNING hoan_tat_luc
            """,
            (pay_res["ma_giao_dich"], ma_phien),
        )
        done = await cur.fetchone()

    return {
        "thanh_cong": True,
        "ma_hoa_don": session["ma_hoa_don"],
        "ma_giao_dich": pay_res["ma_giao_dich"],
        "so_tien": int(session["so_tien"]),
        "hoan_tat_luc": done["hoan_tat_luc"],
    }


@router.post("/api/payments/qr/{ma_phien}/cancel")
async def cancel_public_qr_payment(ma_phien: str, payload: QrActionRequest):
    """Hủy phiên thanh toán QR đang chờ (từ điện thoại hoặc máy tính)."""
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT chu_ky_hmac, trang_thai FROM phien_thanh_toan_qr WHERE ma_phien = %s FOR UPDATE",
            (ma_phien,),
        )
        session = await cur.fetchone()
        if not session or not hmac.compare_digest(session["chu_ky_hmac"][:16], payload.sig):
            raise HTTPException(status_code=403, detail="Chữ ký phiên không hợp lệ.")
        if session["trang_thai"] == "CHO_THANH_TOAN":
            await cur.execute(
                "UPDATE phien_thanh_toan_qr SET trang_thai = 'DA_HUY' WHERE ma_phien = %s",
                (ma_phien,),
            )
    return {"thanh_cong": True, "trang_thai": "DA_HUY"}

"""
Cổng thanh toán Sandbox liên kết ngân hàng đảm bảo giao dịch ACID 2 chiều:
- Hiển thị 1 mã QR duy nhất (mở cổng ngân hàng Sandbox hoặc xác nhận trực tiếp qua tài khoản ngân hàng liên kết)
- Thực thi `sp_thanh_toan_ngan_hang_sandbox` (trừ TK ngân hàng SV + cộng quỹ KTX + gạch nợ + biên lai)
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import socket
from datetime import datetime, timedelta, timezone
from typing import Literal
from urllib.parse import quote, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import require_student
from app.config import settings
from app.db import fetch_all, fetch_one, transaction

router = APIRouter(tags=["Thanh toán trực tuyến"])

SESSION_TTL_SECONDS = 900  # 15 phút


class CreateQrSessionRequest(BaseModel):
    frontend_origin: str | None = None


class QrActionRequest(BaseModel):
    sig: str


class QrConfirmRequest(BaseModel):
    sig: str
    phuong_thuc: Literal["QR_NGAN_HANG", "VIETQR", "SANDBOX_QR"] = "QR_NGAN_HANG"
    ma_lk: int | None = None


def _detect_lan_ip() -> str:
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


def _tlv(tag: str, value: str) -> str:
    return f"{tag}{len(value):02d}{value}"


def _crc16_ccitt_false(data: str) -> str:
    crc = 0xFFFF
    for byte in data.encode("utf-8"):
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def _build_vietqr_emvco(
    bank_bin: str, account_no: str, amount: int, description: str
) -> str:
    clean_desc = re.sub(r"[^A-Za-z0-9 ]", "", description)[:50]
    beneficiary = _tlv("00", bank_bin) + _tlv("01", account_no)
    merchant_acc_info = (
        _tlv("00", "A000000727")
        + _tlv("01", beneficiary)
        + _tlv("02", "QRIBFTTA")
    )
    additional_data = _tlv("08", clean_desc) if clean_desc else ""

    payload = (
        _tlv("00", "01")
        + _tlv("01", "12")
        + _tlv("38", merchant_acc_info)
        + _tlv("53", "704")
        + _tlv("54", str(amount))
        + _tlv("58", "VN")
        + (_tlv("62", additional_data) if additional_data else "")
        + "6304"
    )
    return payload + _crc16_ccitt_false(payload)


async def _get_ktx_bank_info() -> dict[str, str]:
    rows = await fetch_all(
        "SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'ngan_hang_%'"
    )
    cfg = {r["khoa"]: r["gia_tri"] for r in rows}
    return {
        "bin": cfg.get("ngan_hang_bin", "970436"),
        "ten": cfg.get("ngan_hang_ten", "Vietcombank - CN Cần Thơ"),
        "stk": cfg.get("ngan_hang_stk", "1026889966"),
        "chu_tk": cfg.get("ngan_hang_chu_tk", "TRUONG DAI HOC CAN THO - KTX"),
    }


def _mask_bank_no(raw: str) -> str:
    digits = re.sub(r"\s+", "", raw or "")
    if len(digits) <= 4:
        return digits
    if len(digits) >= 12:
        return f"{digits[:4]} **** **** {digits[-4:]}"
    return f"**** **** {digits[-4:]}"


async def _get_student_bank_accounts(mssv: str) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT ma_lk, ngan_hang, ma_bin, so_tai_khoan, ten_chu_tk,
               so_du_sandbox, mac_dinh
        FROM tai_khoan_ngan_hang_sv
        WHERE mssv = %s
        ORDER BY mac_dinh DESC, ma_lk ASC
        """,
        (mssv,),
    )
    for r in rows:
        r["so_tai_khoan_che"] = _mask_bank_no(r["so_tai_khoan"])
        r["so_du_sandbox"] = int(r["so_du_sandbox"] or 0)
    return rows


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
    """Tạo phiên thanh toán Sandbox liên kết ngân hàng (hiển thị 1 mã QR duy nhất)."""
    mssv = user["mssv"]

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT hd.ma_hoa_don, hd.ma_phong, hd.ma_ky, hd.thang, hd.loai,
                   hd.so_tien, hd.trang_thai, p.ten_phong, p.ma_khu,
                   EXISTS (
                       SELECT 1 FROM luu_tru lt
                       WHERE lt.mssv = %s AND lt.ma_phong = hd.ma_phong
                         AND lt.ma_ky = hd.ma_ky AND lt.ngay_ra IS NULL
                   ) AS dang_o_phong
            FROM hoa_don hd
            JOIN phong p ON p.ma_phong = hd.ma_phong
            WHERE hd.ma_hoa_don = %s
            FOR UPDATE OF hd
            """,
            (mssv, ma_hoa_don),
        )
        hd = await cur.fetchone()
        if not hd:
            raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn.")
        if hd["trang_thai"] == "DA_NOP":
            raise HTTPException(status_code=400, detail="Hóa đơn này đã được thanh toán.")
        if not hd["dang_o_phong"]:
            raise HTTPException(
                status_code=403,
                detail="Bạn không thuộc danh sách lưu trú hiện tại của phòng này.",
            )

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
                chu_ky_hmac, trang_thai, phuong_thuc, het_han_luc
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'CHO_THANH_TOAN', 'QR_NGAN_HANG', %s)
            """,
            (ma_phien, ma_hoa_don, mssv, so_tien, noi_dung_ck, chu_ky, het_han_luc),
        )

    bank_info = await _get_ktx_bank_info()
    linked_accounts = await _get_student_bank_accounts(mssv)
    vietqr_payload = _build_vietqr_emvco(
        bank_info["bin"], bank_info["stk"], so_tien, noi_dung_ck
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
        "vietqr_payload": vietqr_payload,
        "ngan_hang": bank_info,
        "tai_khoan_lien_ket": linked_accounts,
        "trang_thai": "CHO_THANH_TOAN",
        "het_han_luc": het_han_luc.isoformat(),
        "con_lai_giay": SESSION_TTL_SECONDS,
    }


@router.get("/api/student/payments/qr/{ma_phien}/status")
async def get_qr_session_status(ma_phien: str, user=Depends(require_student)):
    """Polling trạng thái phiên thanh toán theo thời gian thực."""
    row = await fetch_one(
        """
        SELECT ma_phien, ma_hoa_don, mssv_nguoi_tao, trang_thai, phuong_thuc,
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
        "phuong_thuc": row["phuong_thuc"],
        "ma_giao_dich": row["ma_giao_dich"],
        "con_lai_giay": con_lai,
        "hoan_tat_luc": row["hoan_tat_luc"],
    }


@router.get("/api/payments/qr/{ma_phien}")
async def get_public_qr_checkout(
    ma_phien: str,
    sig: str = Query(..., min_length=8),
):
    """Trang cổng thanh toán Sandbox công khai (khi quét mã QR bằng điện thoại / mở tab mới)."""
    row = await fetch_one(
        """
        SELECT q.ma_phien, q.ma_hoa_don, q.mssv_nguoi_tao, q.so_tien, q.noi_dung_ck,
               q.chu_ky_hmac, q.trang_thai, q.phuong_thuc, q.so_the_che, q.ngan_hang_nguon,
               q.ma_giao_dich, q.het_han_luc, q.hoan_tat_luc,
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
            detail="Mã thanh toán không hợp lệ hoặc chữ ký xác thực không khớp.",
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

    bank_info = await _get_ktx_bank_info()
    linked_accounts = await _get_student_bank_accounts(row["mssv_nguoi_tao"])
    so_tien = int(row["so_tien"])

    return {
        "ma_phien": row["ma_phien"],
        "ma_hoa_don": row["ma_hoa_don"],
        "ten_phong": row["ten_phong"],
        "ma_khu": row["ma_khu"],
        "tieu_de": _bill_title(row["loai"], row["ma_ky"], row["thang"]),
        "nguoi_nop": row["ten_nguoi_nop"],
        "mssv": row["mssv_nguoi_tao"],
        "so_tien": so_tien,
        "noi_dung_ck": row["noi_dung_ck"],
        "vietqr_payload": _build_vietqr_emvco(
            bank_info["bin"], bank_info["stk"], so_tien, row["noi_dung_ck"]
        ),
        "ngan_hang": bank_info,
        "tai_khoan_lien_ket": linked_accounts,
        "phuong_thuc": row["phuong_thuc"],
        "so_the_che": row["so_the_che"],
        "ngan_hang_nguon": row["ngan_hang_nguon"],
        "trang_thai": trang_thai,
        "ma_giao_dich": row["ma_giao_dich"],
        "het_han_luc": row["het_han_luc"],
        "hoan_tat_luc": row["hoan_tat_luc"],
        "con_lai_giay": con_lai,
    }


@router.post("/api/payments/qr/{ma_phien}/confirm")
async def confirm_public_qr_payment(ma_phien: str, payload: QrConfirmRequest):
    """
    Xác nhận thanh toán Sandbox qua tài khoản ngân hàng liên kết (ACID 2 chiều):
    - Trừ số dư tài khoản ngân hàng liên kết, cộng quỹ thu KTX, gạch nợ hóa đơn & tạo biên lai.
    """
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT ma_phien, ma_hoa_don, mssv_nguoi_tao, so_tien, noi_dung_ck,
                   chu_ky_hmac, trang_thai, het_han_luc
            FROM phien_thanh_toan_qr
            WHERE ma_phien = %s
            FOR UPDATE
            """,
            (ma_phien,),
        )
        session = await cur.fetchone()
        if not session or not hmac.compare_digest(session["chu_ky_hmac"][:16], payload.sig):
            raise HTTPException(status_code=403, detail="Chữ ký giao dịch không hợp lệ.")

        if session["trang_thai"] == "THANH_CONG":
            raise HTTPException(status_code=409, detail="Giao dịch này đã được thanh toán trước đó.")
        if session["trang_thai"] == "DA_HUY":
            raise HTTPException(status_code=400, detail="Phiên thanh toán này đã bị hủy.")
        if session["trang_thai"] == "HET_HAN" or _remaining_seconds(session["het_han_luc"]) == 0:
            await cur.execute(
                "UPDATE phien_thanh_toan_qr SET trang_thai = 'HET_HAN' WHERE ma_phien = %s",
                (ma_phien,),
            )
            raise HTTPException(status_code=400, detail="Phiên thanh toán đã hết hạn. Vui lòng tạo phiên mới.")

        pt = "QR_NGAN_HANG"
        ma_gd = f"SBX-QR-{session['ma_hoa_don']}-{secrets.token_hex(4).upper()}"

        await cur.execute(
            """
            SELECT sp_thanh_toan_ngan_hang_sandbox(
                %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE
            ) AS res
            """,
            (
                session["ma_hoa_don"],
                session["mssv_nguoi_tao"],
                payload.ma_lk,
                ma_gd,
                pt,
                None,
                None,
                None,
                session["noi_dung_ck"],
            ),
        )
        pay_res = (await cur.fetchone())["res"]

        await cur.execute(
            """
            UPDATE phien_thanh_toan_qr
            SET trang_thai = 'THANH_CONG',
                phuong_thuc = %s,
                ma_giao_dich = %s,
                ngan_hang_nguon = %s,
                hoan_tat_luc = NOW()
            WHERE ma_phien = %s
            RETURNING hoan_tat_luc
            """,
            (pt, pay_res["ma_giao_dich"], pay_res.get("ngan_hang"), ma_phien),
        )
        done = await cur.fetchone()

    return {
        "thanh_cong": True,
        "ma_tt": pay_res.get("ma_tt"),
        "ma_hoa_don": session["ma_hoa_don"],
        "ma_giao_dich": pay_res["ma_giao_dich"],
        "phuong_thuc": pt,
        "ngan_hang": pay_res.get("ngan_hang"),
        "so_tai_khoan": pay_res.get("so_tai_khoan"),
        "noi_dung_ck": session["noi_dung_ck"],
        "so_tien": int(session["so_tien"]),
        "so_du_truoc": pay_res.get("so_du_truoc"),
        "so_du_sau": pay_res.get("so_du_sau"),
        "quy_ktx_moi": pay_res.get("quy_ktx_moi"),
        "hoan_tat_luc": done["hoan_tat_luc"],
    }


@router.post("/api/payments/qr/{ma_phien}/cancel")
async def cancel_public_qr_payment(ma_phien: str, payload: QrActionRequest):
    """Hủy phiên thanh toán đang chờ."""
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

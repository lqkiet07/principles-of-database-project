import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.ai.semantic_search import search_rooms_semantic
from app.auth import require_student
from app.db import execute, fetch_all, fetch_one, transaction

router = APIRouter(prefix="/api/student", tags=["Sinh viên"])


class LinkBankAccountRequest(BaseModel):
    ngan_hang: str = Field(..., min_length=2, max_length=80)
    ma_bin: str = Field(default="970436", min_length=6, max_length=10)
    so_tai_khoan: str = Field(..., min_length=8, max_length=24)
    ten_chu_tk: str = Field(..., min_length=2, max_length=120)
    mac_dinh: bool = True


class SubmitTransferRequest(BaseModel):
    ly_do: str = Field(..., min_length=5, max_length=1000)
    nguyen_vong_khu: str | None = None
    nguyen_vong_loai: Literal[4, 6, 8] | None = None


class SubmitMaintenanceRequest(BaseModel):
    nhom_su_co: Literal["DIEN", "NUOC", "NOI_THAT", "CONG_TRINH", "KHAC"]
    mo_ta: str = Field(..., min_length=5, max_length=1000)
    anh_url: str | None = None


def _mask_bank_no(raw: str) -> str:
    digits = re.sub(r"\s+", "", raw or "")
    if len(digits) <= 4:
        return digits
    return f"**** **** {digits[-4:]}"


async def _get_student_context(mssv: str):
    sv = await fetch_one(
        """
        SELECT sv.mssv, sv.ho_ten, sv.gioi_tinh, sv.nganh, sv.sdt, sv.email,
               sv.so_ky_dong_tre,
               lt.ma_phong, lt.ma_ky, lt.ngay_vao,
               p.ten_phong, p.ma_khu, k.ten_khu, p.suc_chua, p.co_nau_an,
               p.gioi_tinh AS gioi_tinh_phong, p.gia_phong,
               hd.ma_hd, hd.mssv_dai_dien, rep.ho_ten AS ten_dai_dien,
               hd.ngay_ky, hd.trang_thai AS trang_thai_hd,
               kh.ten_ky, kh.ngay_bat_dau, kh.ngay_ket_thuc
        FROM sinh_vien sv
        LEFT JOIN luu_tru lt
            ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        LEFT JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN khu k ON k.ma_khu = p.ma_khu
        LEFT JOIN ky_hoc kh ON kh.ma_ky = COALESCE(lt.ma_ky, fn_ky_hoc_hien_hanh())
        LEFT JOIN hop_dong hd
            ON hd.ma_phong = lt.ma_phong AND hd.ma_ky = lt.ma_ky AND hd.trang_thai = 'HIEU_LUC'
        LEFT JOIN sinh_vien rep ON rep.mssv = hd.mssv_dai_dien
        WHERE sv.mssv = %s
        """,
        (mssv,),
    )
    return sv


@router.get("/bank-accounts")
async def list_linked_bank_accounts(user=Depends(require_student)):
    rows = await fetch_all(
        """
        SELECT ma_lk, ngan_hang, ma_bin, so_tai_khoan, ten_chu_tk,
               so_du_sandbox, mac_dinh, ngay_lien_ket
        FROM tai_khoan_ngan_hang_sv
        WHERE mssv = %s
        ORDER BY mac_dinh DESC, ma_lk ASC
        """,
        (user["mssv"],),
    )
    for r in rows:
        r["so_tai_khoan_che"] = _mask_bank_no(r["so_tai_khoan"])
        r["so_du_sandbox"] = int(r["so_du_sandbox"] or 0)
    return {"items": rows}


@router.post("/bank-accounts", status_code=201)
async def link_bank_account(
    payload: LinkBankAccountRequest, user=Depends(require_student)
):
    digits = re.sub(r"\D", "", payload.so_tai_khoan)
    if not (8 <= len(digits) <= 19):
        raise HTTPException(
            status_code=400,
            detail="Số tài khoản / số thẻ ngân hàng phải gồm 8 đến 19 chữ số.",
        )

    async with transaction() as conn, conn.cursor() as cur:
        if payload.mac_dinh:
            await cur.execute(
                "UPDATE tai_khoan_ngan_hang_sv SET mac_dinh = FALSE WHERE mssv = %s",
                (user["mssv"],),
            )
        await cur.execute(
            """
            INSERT INTO tai_khoan_ngan_hang_sv (
                mssv, ngan_hang, ma_bin, so_tai_khoan, ten_chu_tk, so_du_sandbox, mac_dinh
            )
            VALUES (%s, %s, %s, %s, %s, 15000000, %s)
            ON CONFLICT (mssv, so_tai_khoan) DO UPDATE SET
                ngan_hang  = EXCLUDED.ngan_hang,
                ma_bin     = EXCLUDED.ma_bin,
                ten_chu_tk = EXCLUDED.ten_chu_tk,
                mac_dinh   = EXCLUDED.mac_dinh
            RETURNING ma_lk, ngan_hang, ma_bin, so_tai_khoan, ten_chu_tk,
                      so_du_sandbox, mac_dinh, ngay_lien_ket
            """,
            (
                user["mssv"],
                payload.ngan_hang.strip(),
                payload.ma_bin.strip(),
                digits,
                payload.ten_chu_tk.strip().upper(),
                payload.mac_dinh,
            ),
        )
        row = await cur.fetchone()

    row["so_tai_khoan_che"] = _mask_bank_no(row["so_tai_khoan"])
    row["so_du_sandbox"] = int(row["so_du_sandbox"] or 0)
    return {
        "thanh_cong": True,
        "tai_khoan": row,
        "thong_bao": f"Đã liên kết tài khoản {row['ngan_hang']} ({row['so_tai_khoan_che']}).",
    }


@router.patch("/bank-accounts/{ma_lk}/default")
async def set_default_bank_account(ma_lk: int, user=Depends(require_student)):
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT ma_lk FROM tai_khoan_ngan_hang_sv WHERE ma_lk = %s AND mssv = %s",
            (ma_lk, user["mssv"]),
        )
        if not await cur.fetchone():
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản ngân hàng liên kết.")
        await cur.execute(
            "UPDATE tai_khoan_ngan_hang_sv SET mac_dinh = FALSE WHERE mssv = %s",
            (user["mssv"],),
        )
        await cur.execute(
            "UPDATE tai_khoan_ngan_hang_sv SET mac_dinh = TRUE WHERE ma_lk = %s AND mssv = %s",
            (ma_lk, user["mssv"]),
        )
    return {"thanh_cong": True, "thong_bao": "Đã đặt tài khoản ngân hàng mặc định."}


@router.delete("/bank-accounts/{ma_lk}")
async def unlink_bank_account(ma_lk: int, user=Depends(require_student)):
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            DELETE FROM tai_khoan_ngan_hang_sv
            WHERE ma_lk = %s AND mssv = %s
            RETURNING mac_dinh
            """,
            (ma_lk, user["mssv"]),
        )
        deleted = await cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản ngân hàng.")
        if deleted["mac_dinh"]:
            await cur.execute(
                """
                UPDATE tai_khoan_ngan_hang_sv
                SET mac_dinh = TRUE
                WHERE ma_lk = (
                    SELECT ma_lk FROM tai_khoan_ngan_hang_sv
                    WHERE mssv = %s ORDER BY ma_lk ASC LIMIT 1
                )
                """,
                (user["mssv"],),
            )
    return {"thanh_cong": True, "thong_bao": "Đã hủy liên kết tài khoản ngân hàng."}


@router.get("/bills")
async def get_student_bills(user=Depends(require_student)):
    """Tiền KTX kỳ này, tiền điện nước tháng này, tài khoản ngân hàng liên kết & biên lai điện tử."""
    ctx = await _get_student_context(user["mssv"])
    if not ctx:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ sinh viên.")

    la_dai_dien = bool(ctx["mssv_dai_dien"] and ctx["mssv_dai_dien"] == ctx["mssv"])
    hoa_don_ktx = None
    hoa_don_dien_nuoc = None
    bien_lai_list = []

    if ctx["ma_phong"]:
        hoa_don_ktx = await fetch_one(
            """
            SELECT hd.ma_hoa_don, hd.ma_ky, hd.loai, hd.so_tien, hd.han_nop, hd.trang_thai,
                   tt.ma_tt, tt.ma_giao_dich, tt.thoi_gian AS thoi_gian_thanh_toan,
                   tt.phuong_thuc, tt.ngan_hang, tt.mssv_nguoi_nop
            FROM hoa_don hd
            LEFT JOIN thanh_toan tt ON tt.ma_hoa_don = hd.ma_hoa_don
            WHERE hd.ma_phong = %s AND hd.ma_ky = %s AND hd.loai = 'KTX'
            LIMIT 1
            """,
            (ctx["ma_phong"], ctx["ma_ky"]),
        )
        hoa_don_dien_nuoc = await fetch_one(
            """
            SELECT hd.ma_hoa_don, hd.thang, hd.loai, hd.tien_dien, hd.tien_nuoc,
                   hd.so_tien, hd.han_nop, hd.trang_thai,
                   cs.chi_so_dien_dau, cs.chi_so_dien_cuoi,
                   (cs.chi_so_dien_cuoi - cs.chi_so_dien_dau) AS luong_dien,
                   cs.chi_so_nuoc_dau, cs.chi_so_nuoc_cuoi,
                   (cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau) AS luong_nuoc,
                   tt.ma_tt, tt.ma_giao_dich, tt.thoi_gian AS thoi_gian_thanh_toan,
                   tt.phuong_thuc, tt.ngan_hang, tt.mssv_nguoi_nop
            FROM hoa_don hd
            LEFT JOIN chi_so cs ON cs.ma_phong = hd.ma_phong AND cs.thang = hd.thang
            LEFT JOIN thanh_toan tt ON tt.ma_hoa_don = hd.ma_hoa_don
            WHERE hd.ma_phong = %s AND hd.loai = 'DIEN_NUOC'
            ORDER BY hd.thang DESC
            LIMIT 1
            """,
            (ctx["ma_phong"],),
        )
        bien_lai_list = await fetch_all(
            """
            SELECT tt.ma_tt, tt.ma_hoa_don, tt.ma_giao_dich, tt.so_tien, tt.thoi_gian,
                   tt.phuong_thuc, tt.ngan_hang, tt.noi_dung_ck,
                   tt.mssv_nguoi_nop, sv.ho_ten AS ten_nguoi_nop,
                   hd.loai, hd.ma_ky, hd.thang
            FROM thanh_toan tt
            JOIN hoa_don hd ON hd.ma_hoa_don = tt.ma_hoa_don
            JOIN sinh_vien sv ON sv.mssv = tt.mssv_nguoi_nop
            WHERE hd.ma_phong = %s
            ORDER BY tt.thoi_gian DESC
            LIMIT 10
            """,
            (ctx["ma_phong"],),
        )

    bank_accounts = await fetch_all(
        """
        SELECT ma_lk, ngan_hang, ma_bin, so_tai_khoan, ten_chu_tk,
               so_du_sandbox, mac_dinh, ngay_lien_ket
        FROM tai_khoan_ngan_hang_sv
        WHERE mssv = %s
        ORDER BY mac_dinh DESC, ma_lk ASC
        """,
        (user["mssv"],),
    )
    for b in bank_accounts:
        b["so_tai_khoan_che"] = _mask_bank_no(b["so_tai_khoan"])
        b["so_du_sandbox"] = int(b["so_du_sandbox"] or 0)

    bank_txs = await fetch_all(
        """
        SELECT ma_gd_nh, ma_hoa_don, ma_giao_dich, ngan_hang, so_tai_khoan,
               so_tien, so_du_truoc, so_du_sau, phuong_thuc, noi_dung, thoi_gian
        FROM giao_dich_ngan_hang
        WHERE mssv = %s
        ORDER BY thoi_gian DESC, ma_gd_nh DESC
        LIMIT 10
        """,
        (user["mssv"],),
    )
    for tx in bank_txs:
        tx["so_tai_khoan_che"] = _mask_bank_no(tx["so_tai_khoan"])
        tx["so_tien"] = int(tx["so_tien"])
        tx["so_du_truoc"] = int(tx["so_du_truoc"])
        tx["so_du_sau"] = int(tx["so_du_sau"])

    return {
        "sinh_vien": {
            "mssv": ctx["mssv"],
            "ho_ten": ctx["ho_ten"],
            "ten_phong": ctx["ten_phong"],
            "ten_khu": ctx["ten_khu"],
            "ten_ky": ctx["ten_ky"],
            "la_dai_dien": la_dai_dien,
            "mssv_dai_dien": ctx["mssv_dai_dien"],
            "ten_dai_dien": ctx["ten_dai_dien"],
        },
        "tai_khoan_ngan_hang": bank_accounts,
        "giao_dich_ngan_hang": bank_txs,
        "hoa_don_ktx": hoa_don_ktx,
        "hoa_don_dien_nuoc": hoa_don_dien_nuoc,
        "bien_lai_list": bien_lai_list,
    }


@router.get("/bills/{ma_hoa_don}/receipt")
async def get_bill_receipt(ma_hoa_don: int, user=Depends(require_student)):
    """Xuất biên lai thu tiền điện tử chính thức cho hóa đơn đã thanh toán của phòng sinh viên."""
    ctx = await _get_student_context(user["mssv"])
    if not ctx or not ctx["ma_phong"]:
        raise HTTPException(status_code=403, detail="Bạn chưa có phòng lưu trú trong kỳ hiện tại.")

    receipt = await fetch_one(
        """
        SELECT tt.ma_tt, tt.ma_hoa_don, tt.ma_giao_dich, tt.so_tien, tt.thoi_gian,
               tt.phuong_thuc, tt.ngan_hang, tt.noi_dung_ck,
               tt.mssv_nguoi_nop, sv.ho_ten AS ten_nguoi_nop,
               hd.loai, hd.ma_ky, hd.thang, hd.ma_phong,
               p.ten_phong, p.ma_khu, k.ten_khu
        FROM thanh_toan tt
        JOIN hoa_don hd ON hd.ma_hoa_don = tt.ma_hoa_don
        JOIN phong p ON p.ma_phong = hd.ma_phong
        JOIN khu k ON k.ma_khu = p.ma_khu
        JOIN sinh_vien sv ON sv.mssv = tt.mssv_nguoi_nop
        WHERE tt.ma_hoa_don = %s AND hd.ma_phong = %s
        """,
        (ma_hoa_don, ctx["ma_phong"]),
    )
    if not receipt:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy biên lai thanh toán cho hóa đơn này.",
        )

    bank_rows = await fetch_all(
        "SELECT khoa, gia_tri FROM cau_hinh WHERE khoa LIKE 'ngan_hang_%'"
    )
    bank_cfg = {r["khoa"]: r["gia_tri"] for r in bank_rows}

    return {
        **receipt,
        "so_bien_lai": f"BL-CTU-{receipt['ma_tt']:06d}",
        "don_vi_thu": "Ban Quản lý Ký túc xá - Trường Đại học Cần Thơ",
        "tai_khoan_thu": bank_cfg.get("ngan_hang_stk", "1026889966"),
        "ten_tk_thu": bank_cfg.get("ngan_hang_chu_tk", "TRUONG DAI HOC CAN THO - KTX"),
    }


@router.get("/rooms/semantic-search")
async def semantic_search_student_rooms(
    q: str = Query(..., min_length=2),
    limit: int = Query(6, ge=1, le=20),
    _user=Depends(require_student),
):
    items = await search_rooms_semantic(q, limit=limit, include_full=False)
    return {"query": q, "items": items}


@router.post("/bills/{ma_hoa_don}/pay-qr")
async def pay_bill_via_qr(ma_hoa_don: int, user=Depends(require_student)):
    """Xác nhận thanh toán trực tuyến qua tài khoản ngân hàng liên kết mặc định (ACID)."""
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT sp_thanh_toan_ngan_hang_sandbox(
                %s, %s, NULL, NULL, 'QR_NGAN_HANG', NULL, NULL, NULL, NULL, FALSE
            ) AS res
            """,
            (ma_hoa_don, user["mssv"]),
        )
        r = await cur.fetchone()
    return r["res"]


@router.get("/room")
async def get_student_room(user=Depends(require_student)):
    """Thông tin phòng, bạn cùng phòng & yêu cầu đổi phòng."""
    ctx = await _get_student_context(user["mssv"])
    roommates = []
    if ctx and ctx["ma_phong"]:
        roommates = await fetch_all(
            """
            SELECT sv.mssv, sv.ho_ten, sv.nganh, sv.sdt,
                   (hd.mssv_dai_dien = sv.mssv) AS la_dai_dien
            FROM luu_tru lt
            JOIN sinh_vien sv ON sv.mssv = lt.mssv
            LEFT JOIN hop_dong hd
                ON hd.ma_phong = lt.ma_phong AND hd.ma_ky = lt.ma_ky AND hd.trang_thai = 'HIEU_LUC'
            WHERE lt.ma_phong = %s AND lt.ma_ky = %s AND lt.ngay_ra IS NULL
            ORDER BY (hd.mssv_dai_dien = sv.mssv) DESC NULLS LAST, sv.ho_ten ASC
            """,
            (ctx["ma_phong"], ctx["ma_ky"]),
        )

    transfers = await fetch_all(
        """
        SELECT yc.ma_yc, p1.ten_phong AS ten_phong_hien_tai, p2.ten_phong AS ten_phong_moi,
               yc.nguyen_vong_khu, yc.nguyen_vong_loai, yc.ly_do, yc.trang_thai,
               yc.ghi_chu_duyet, yc.ly_do_tu_choi, yc.thoi_gian, yc.ngay_xu_ly
        FROM yeu_cau_doi_phong yc
        JOIN phong p1 ON p1.ma_phong = yc.phong_hien_tai
        LEFT JOIN phong p2 ON p2.ma_phong = yc.phong_moi
        WHERE yc.mssv = %s
        ORDER BY yc.thoi_gian DESC
        """,
        (user["mssv"],),
    )
    zones = await fetch_all("SELECT ma_khu, ten_khu FROM khu WHERE ma_khu IN ('A', 'B') ORDER BY ma_khu")

    return {
        "phong": {
            "ma_phong": ctx["ma_phong"],
            "ten_phong": ctx["ten_phong"],
            "ma_khu": ctx["ma_khu"],
            "ten_khu": ctx["ten_khu"],
            "suc_chua": ctx["suc_chua"],
            "co_nau_an": ctx["co_nau_an"],
            "gioi_tinh": ctx["gioi_tinh_phong"],
            "gia_phong": ctx["gia_phong"],
            "so_nguoi_o": len(roommates),
        } if ctx and ctx["ma_phong"] else None,
        "ky_luat": {
            "so_ky_dong_tre": ctx["so_ky_dong_tre"] if ctx else 0,
        },
        "ban_cung_phong": roommates,
        "yeu_cau_doi_phong": transfers,
        "co_yeu_cau_dang_cho": any(t["trang_thai"] == "CHO_XU_LY" for t in transfers),
        "khu_list": zones,
    }


@router.post("/room-transfers", status_code=201)
async def submit_room_transfer(
    payload: SubmitTransferRequest, user=Depends(require_student)
):
    ctx = await _get_student_context(user["mssv"])
    if not ctx or not ctx["ma_phong"]:
        raise HTTPException(
            status_code=400,
            detail="Bạn chưa được xếp phòng trong kỳ hiện tại nên không thể gửi yêu cầu đổi phòng.",
        )

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO yeu_cau_doi_phong (
                mssv, ma_ky, phong_hien_tai, nguyen_vong_khu, nguyen_vong_loai, ly_do, trang_thai
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'CHO_XU_LY')
            RETURNING *
            """,
            (
                user["mssv"],
                ctx["ma_ky"],
                ctx["ma_phong"],
                payload.nguyen_vong_khu.strip().upper() if payload.nguyen_vong_khu else None,
                payload.nguyen_vong_loai,
                payload.ly_do.strip(),
            ),
        )
        row = await cur.fetchone()
    return {
        "thanh_cong": True,
        "yeu_cau": row,
        "thong_bao": "Đã gửi yêu cầu đổi phòng đến Ban Quản lý KTX.",
    }


@router.get("/maintenance")
async def get_student_maintenance(user=Depends(require_student)):
    """Đơn sửa chữa của phòng/khu + thông báo bảo trì từ quản lý."""
    ctx = await _get_student_context(user["mssv"])
    tickets = []
    if ctx and ctx["ma_phong"]:
        tickets = await fetch_all(
            """
            SELECT yc.ma_yc, yc.ma_phong, p.ten_phong, COALESCE(yc.ma_khu, p.ma_khu) AS ma_khu,
                   yc.mssv, sv.ho_ten AS nguoi_gui, yc.nhom_su_co, yc.mo_ta, yc.anh_url,
                   yc.trang_thai, yc.ghi_chu_xu_ly, yc.sdt_nguoi_sua, yc.ngay_sua,
                   yc.thoi_gian, yc.cap_nhat_luc
            FROM yeu_cau_bao_tri yc
            LEFT JOIN phong p ON p.ma_phong = yc.ma_phong
            LEFT JOIN sinh_vien sv ON sv.mssv = yc.mssv
            WHERE yc.ma_phong = %s
               OR (yc.ma_phong IS NULL AND yc.ma_khu = %s)
            ORDER BY yc.thoi_gian DESC
            """,
            (ctx["ma_phong"], ctx["ma_khu"]),
        )

    notices = await fetch_all(
        """
        SELECT ma_tb, tieu_de, noi_dung, thoi_gian, da_doc
        FROM thong_bao
        WHERE mssv = %s AND loai = 'BAO_TRI'
        ORDER BY thoi_gian DESC
        LIMIT 20
        """,
        (user["mssv"],),
    )
    return {
        "ten_phong": ctx["ten_phong"] if ctx else None,
        "items": tickets,
        "thong_bao_bao_tri": notices,
    }


@router.post("/maintenance", status_code=201)
async def submit_student_maintenance(
    payload: SubmitMaintenanceRequest, user=Depends(require_student)
):
    ctx = await _get_student_context(user["mssv"])
    if not ctx or not ctx["ma_phong"]:
        raise HTTPException(
            status_code=400,
            detail="Bạn chưa có phòng ở trong kỳ hiện tại nên không thể gửi yêu cầu bảo trì.",
        )

    if payload.anh_url and len(payload.anh_url) > 2_500_000:
        raise HTTPException(status_code=400, detail="Ảnh đính kèm vượt quá dung lượng cho phép (tối đa ~1.8MB).")

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO yeu_cau_bao_tri (ma_phong, ma_khu, mssv, nhom_su_co, mo_ta, anh_url, trang_thai)
            VALUES (%s, %s, %s, %s, %s, %s, 'MOI')
            RETURNING *
            """,
            (
                ctx["ma_phong"],
                ctx["ma_khu"],
                user["mssv"],
                payload.nhom_su_co,
                payload.mo_ta.strip(),
                payload.anh_url,
            ),
        )
        row = await cur.fetchone()
    return {
        "thanh_cong": True,
        "yeu_cau": row,
        "thong_bao": "Đã gửi đơn báo hỏng / sửa chữa thành công.",
    }


@router.get("/contract")
async def get_student_contract(user=Depends(require_student)):
    """Thông tin hợp đồng nội trú."""
    ctx = await _get_student_context(user["mssv"])
    if not ctx:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ sinh viên.")

    return {
        "hop_dong": {
            "da_ky": ctx["ma_hd"] is not None,
            "ma_hd": ctx["ma_hd"],
            "ten_phong": ctx["ten_phong"],
            "ten_khu": ctx["ten_khu"],
            "ma_ky": ctx["ma_ky"],
            "ten_ky": ctx["ten_ky"],
            "ngay_bat_dau": ctx["ngay_bat_dau"],
            "ngay_ket_thuc": ctx["ngay_ket_thuc"],
            "mssv_dai_dien": ctx["mssv_dai_dien"],
            "ten_dai_dien": ctx["ten_dai_dien"],
            "la_dai_dien": bool(ctx["mssv_dai_dien"] and ctx["mssv_dai_dien"] == ctx["mssv"]),
            "ngay_ky": ctx["ngay_ky"],
            "trang_thai": ctx["trang_thai_hd"] or "CHUA_KY",
        }
    }


@router.get("/notifications")
async def get_student_notifications(user=Depends(require_student)):
    items = await fetch_all(
        """
        SELECT ma_tb, loai, tieu_de, noi_dung, thoi_gian, da_doc
        FROM thong_bao
        WHERE mssv = %s
        ORDER BY thoi_gian DESC
        LIMIT 100
        """,
        (user["mssv"],),
    )
    unread = sum(1 for item in items if not item["da_doc"])
    return {"items": items, "so_chua_doc": unread}


@router.post("/notifications/{ma_tb}/read")
async def mark_notification_read(ma_tb: int, user=Depends(require_student)):
    await execute(
        "UPDATE thong_bao SET da_doc = TRUE WHERE ma_tb = %s AND mssv = %s",
        (ma_tb, user["mssv"]),
    )
    return {"thanh_cong": True}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(user=Depends(require_student)):
    await execute(
        "UPDATE thong_bao SET da_doc = TRUE WHERE mssv = %s AND da_doc = FALSE",
        (user["mssv"],),
    )
    return {"thanh_cong": True}

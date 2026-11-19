from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.ai.semantic_search import search_rooms_semantic
from app.auth import require_student
from app.db import execute, fetch_all, fetch_one, transaction

router = APIRouter(prefix="/api/student", tags=["Sinh viên"])


class TopupWalletRequest(BaseModel):
    so_tien: int = Field(..., ge=10000, le=50000000)


class PayWalletRequest(BaseModel):
    gia_lap_loi: bool = False


class SubmitTransferRequest(BaseModel):
    ly_do: str = Field(..., min_length=5, max_length=1000)
    nguyen_vong_khu: str | None = None
    nguyen_vong_loai: Literal[4, 6, 8] | None = None


class SubmitMaintenanceRequest(BaseModel):
    nhom_su_co: Literal["DIEN", "NUOC", "NOI_THAT", "CONG_TRINH", "KHAC"]
    mo_ta: str = Field(..., min_length=5, max_length=1000)
    anh_url: str | None = None


async def _get_student_context(mssv: str):
    sv = await fetch_one(
        """
        SELECT sv.mssv, sv.ho_ten, sv.gioi_tinh, sv.nganh, sv.sdt, sv.email, sv.so_du,
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


@router.get("/bills")
async def get_student_bills(user=Depends(require_student)):
    """Mục 5.1: Tiền KTX kỳ này + Tiền điện nước tháng này của cả phòng (KHÔNG ví, KHÔNG lịch sử thanh toán)."""
    ctx = await _get_student_context(user["mssv"])
    if not ctx:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ sinh viên.")

    la_dai_dien = bool(ctx["mssv_dai_dien"] and ctx["mssv_dai_dien"] == ctx["mssv"])
    hoa_don_ktx = None
    hoa_don_dien_nuoc = None

    if ctx["ma_phong"]:
        hoa_don_ktx = await fetch_one(
            """
            SELECT ma_hoa_don, ma_ky, loai, so_tien, han_nop, trang_thai
            FROM hoa_don
            WHERE ma_phong = %s AND ma_ky = %s AND loai = 'KTX'
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
                   (cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau) AS luong_nuoc
            FROM hoa_don hd
            LEFT JOIN chi_so cs ON cs.ma_phong = hd.ma_phong AND cs.thang = hd.thang
            WHERE hd.ma_phong = %s AND hd.loai = 'DIEN_NUOC'
            ORDER BY hd.thang DESC
            LIMIT 1
            """,
            (ctx["ma_phong"],),
        )

    giao_dich_vi = await fetch_all(
        """
        SELECT ma_gd, loai, so_tien, so_du_truoc, so_du_sau, ma_hoa_don, mo_ta, thoi_gian
        FROM giao_dich_vi
        WHERE mssv = %s
        ORDER BY thoi_gian DESC, ma_gd DESC
        LIMIT 10
        """,
        (user["mssv"],),
    )

    return {
        "sinh_vien": {
            "mssv": ctx["mssv"],
            "ho_ten": ctx["ho_ten"],
            "so_du": int(ctx["so_du"] or 0),
            "ten_phong": ctx["ten_phong"],
            "ten_khu": ctx["ten_khu"],
            "ten_ky": ctx["ten_ky"],
            "la_dai_dien": la_dai_dien,
            "mssv_dai_dien": ctx["mssv_dai_dien"],
            "ten_dai_dien": ctx["ten_dai_dien"],
        },
        "hoa_don_ktx": hoa_don_ktx,
        "hoa_don_dien_nuoc": hoa_don_dien_nuoc,
        "giao_dich_vi": giao_dich_vi,
    }


@router.post("/wallet/topup")
async def topup_student_wallet(payload: TopupWalletRequest, user=Depends(require_student)):
    """Nạp tiền vào tài khoản nội trú (ACID + khóa dòng)."""
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute("SELECT sp_nap_tien_vi(%s, %s) AS res", (user["mssv"], payload.so_tien))
        r = await cur.fetchone()
    return r["res"]


@router.post("/bills/{ma_hoa_don}/pay-wallet")
async def pay_bill_via_wallet(
    ma_hoa_don: int,
    payload: PayWalletRequest | None = None,
    user=Depends(require_student),
):
    """Thanh toán hóa đơn bằng số dư ví (giao dịch ACID trừ tiền SV + cộng quỹ KTX)."""
    gia_lap_loi = bool(payload and payload.gia_lap_loi)
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT sp_thanh_toan_bang_vi(%s, %s, %s) AS res",
            (ma_hoa_don, user["mssv"], gia_lap_loi),
        )
        r = await cur.fetchone()
    return r["res"]


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
    """Xác nhận thanh toán mã QR giả lập — gọi thủ tục khóa dòng chống thanh toán trùng."""
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT sp_thanh_toan_hoa_don(%s, %s, NULL) AS res",
            (ma_hoa_don, user["mssv"]),
        )
        r = await cur.fetchone()
    return r["res"]


@router.get("/room")
async def get_student_room(user=Depends(require_student)):
    """Mục 5.2: Thông tin phòng, bạn cùng phòng (KHÔNG tài sản thiết bị) & yêu cầu đổi phòng."""
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
    zones = await fetch_all("SELECT ma_khu, ten_khu FROM khu ORDER BY ma_khu")

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
        # Partial unique index uq_doi_phong_dang_cho chặn gửi 2 yêu cầu chờ cùng lúc
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
    """Mục 5.3: Đơn sửa chữa của phòng/khu + thông báo bảo trì từ quản lý."""
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
    """Mục 5.4: Chỉ hiển thị thông tin hợp đồng (phòng, kỳ hiệu lực, người đứng tên đại diện, trạng thái). BỎ lịch sử ra vào."""
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

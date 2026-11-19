from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.db import fetch_all, fetch_one, transaction

router = APIRouter(prefix="/api/admin/settings", tags=["Quản lý - Cài đặt hệ thống"])


class UpdatePricesRequest(BaseModel):
    don_gia_dien: int = Field(..., ge=0)
    don_gia_nuoc: int = Field(..., ge=0)


class UpdateConfigRequest(BaseModel):
    han_nop_ktx: date | None = None
    han_nop_dien_nuoc: date | None = None
    moc_gio_chua_ve: str | None = Field(default=None, pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]|24:00$")
    che_do_bao_tri: bool | None = None
    ky_hoc_hien_tai: str | None = None


class CreateSemesterRequest(BaseModel):
    ma_ky: str = Field(..., min_length=3, max_length=20)
    ten_ky: str = Field(..., min_length=3, max_length=100)
    ngay_bat_dau: date
    ngay_ket_thuc: date
    dat_lam_hien_hanh: bool = False


class UpdateAccountRoleRequest(BaseModel):
    vai_tro: Literal["QUAN_LY", "SINH_VIEN"]


@router.get("")
async def get_settings(_admin=Depends(require_admin)):
    cfg_rows = await fetch_all("SELECT khoa, gia_tri, mo_ta FROM cau_hinh ORDER BY khoa")
    config = {r["khoa"]: r["gia_tri"] for r in cfg_rows}

    dg_dien = await fetch_one(
        "SELECT ma_dg, don_gia, ap_dung_tu FROM don_gia WHERE loai = 'DIEN' ORDER BY ap_dung_tu DESC, ma_dg DESC LIMIT 1"
    )
    dg_nuoc = await fetch_one(
        "SELECT ma_dg, don_gia, ap_dung_tu FROM don_gia WHERE loai = 'NUOC' ORDER BY ap_dung_tu DESC, ma_dg DESC LIMIT 1"
    )
    price_history = await fetch_all(
        "SELECT ma_dg, loai, don_gia, ap_dung_tu FROM don_gia ORDER BY ap_dung_tu DESC, ma_dg DESC LIMIT 20"
    )
    semesters = await fetch_all(
        "SELECT ma_ky, ten_ky, ngay_bat_dau, ngay_ket_thuc, dang_hien_hanh FROM ky_hoc ORDER BY ngay_bat_dau DESC"
    )
    zones = await fetch_all(
        """
        SELECT k.ma_khu, k.ten_khu, COUNT(p.ma_phong)::INT AS so_phong
        FROM khu k LEFT JOIN phong p ON p.ma_khu = k.ma_khu
        GROUP BY k.ma_khu, k.ten_khu ORDER BY k.ma_khu
        """
    )

    return {
        "cau_hinh": {
            "han_nop_ktx": config.get("han_nop_ktx", ""),
            "han_nop_dien_nuoc": config.get("han_nop_dien_nuoc", ""),
            "moc_gio_chua_ve": config.get("moc_gio_chua_ve", "24:00"),
            "che_do_bao_tri": str(config.get("che_do_bao_tri", "false")).lower() == "true",
            "ky_hoc_hien_tai": config.get("ky_hoc_hien_tai", ""),
        },
        "don_gia_dien": int(dg_dien["don_gia"]) if dg_dien else 3500,
        "don_gia_nuoc": int(dg_nuoc["don_gia"]) if dg_nuoc else 15000,
        "lich_su_don_gia": price_history,
        "ky_hoc_list": semesters,
        "khu_list": zones,
    }


@router.put("/prices")
async def update_prices(payload: UpdatePricesRequest, _admin=Depends(require_admin)):
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "INSERT INTO don_gia (loai, don_gia, ap_dung_tu) VALUES ('DIEN', %s, NOW())",
            (payload.don_gia_dien,),
        )
        await cur.execute(
            "INSERT INTO don_gia (loai, don_gia, ap_dung_tu) VALUES ('NUOC', %s, NOW())",
            (payload.don_gia_nuoc,),
        )
    return {"thanh_cong": True, "thong_bao": "Đã cập nhật đơn giá điện nước."}


@router.put("/config")
async def update_config(payload: UpdateConfigRequest, _admin=Depends(require_admin)):
    async with transaction() as conn, conn.cursor() as cur:
        updates: list[tuple[str, str]] = []
        if payload.han_nop_ktx is not None:
            updates.append(("han_nop_ktx", payload.han_nop_ktx.isoformat()))
        if payload.han_nop_dien_nuoc is not None:
            updates.append(("han_nop_dien_nuoc", payload.han_nop_dien_nuoc.isoformat()))
        if payload.moc_gio_chua_ve is not None:
            updates.append(("moc_gio_chua_ve", payload.moc_gio_chua_ve))
        if payload.che_do_bao_tri is not None:
            updates.append(("che_do_bao_tri", "true" if payload.che_do_bao_tri else "false"))
        if payload.ky_hoc_hien_tai is not None:
            await cur.execute("SELECT ma_ky FROM ky_hoc WHERE ma_ky = %s", (payload.ky_hoc_hien_tai,))
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Kỳ học không tồn tại.")
            await cur.execute("UPDATE ky_hoc SET dang_hien_hanh = FALSE WHERE dang_hien_hanh = TRUE")
            await cur.execute("UPDATE ky_hoc SET dang_hien_hanh = TRUE WHERE ma_ky = %s", (payload.ky_hoc_hien_tai,))
            updates.append(("ky_hoc_hien_tai", payload.ky_hoc_hien_tai))

        for k, v in updates:
            await cur.execute(
                """
                INSERT INTO cau_hinh (khoa, gia_tri) VALUES (%s, %s)
                ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri
                """,
                (k, v),
            )
    return {"thanh_cong": True, "thong_bao": "Đã lưu cấu hình hệ thống."}


@router.post("/semesters", status_code=201)
async def create_semester(payload: CreateSemesterRequest, _admin=Depends(require_admin)):
    if payload.ngay_ket_thuc <= payload.ngay_bat_dau:
        raise HTTPException(status_code=400, detail="Ngày kết thúc phải sau ngày bắt đầu.")
    ma_ky = payload.ma_ky.strip().upper()
    async with transaction() as conn, conn.cursor() as cur:
        if payload.dat_lam_hien_hanh:
            await cur.execute("UPDATE ky_hoc SET dang_hien_hanh = FALSE WHERE dang_hien_hanh = TRUE")
        await cur.execute(
            """
            INSERT INTO ky_hoc (ma_ky, ten_ky, ngay_bat_dau, ngay_ket_thuc, dang_hien_hanh)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (ma_ky, payload.ten_ky.strip(), payload.ngay_bat_dau, payload.ngay_ket_thuc, payload.dat_lam_hien_hanh),
        )
        row = await cur.fetchone()
        if payload.dat_lam_hien_hanh:
            await cur.execute(
                """
                INSERT INTO cau_hinh (khoa, gia_tri) VALUES ('ky_hoc_hien_tai', %s)
                ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri
                """,
                (ma_ky,),
            )
    return row


@router.get("/accounts")
async def list_accounts(
    vai_tro: Literal["TAT_CA", "QUAN_LY", "SINH_VIEN"] = "TAT_CA",
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    _admin=Depends(require_admin),
):
    conditions = ["1=1"]
    params: list = []
    if vai_tro != "TAT_CA":
        conditions.append("vai_tro = %s")
        params.append(vai_tro)
    if search and search.strip():
        conditions.append("(ten_dang_nhap ILIKE %s OR ho_ten_hien_thi ILIKE %s)")
        q = f"%{search.strip()}%"
        params.extend([q, q])

    where_sql = " AND ".join(conditions)
    offset = (page - 1) * page_size

    count_row = await fetch_one(
        f"SELECT COUNT(*)::INT AS total FROM tai_khoan WHERE {where_sql}", params
    )
    items = await fetch_all(
        f"""
        SELECT ma_tk, ten_dang_nhap, vai_tro, mssv, ho_ten_hien_thi,
               trang_thai, ngay_tao
        FROM tai_khoan
        WHERE {where_sql}
        ORDER BY CASE WHEN vai_tro = 'QUAN_LY' THEN 0 ELSE 1 END ASC, ten_dang_nhap ASC
        LIMIT %s OFFSET %s
        """,
        [*params, page_size, offset],
    )
    return {
        "items": items,
        "total": count_row["total"] if count_row else 0,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/accounts/{ma_tk}/role")
async def update_account_role(
    ma_tk: int, payload: UpdateAccountRoleRequest, admin=Depends(require_admin)
):
    """Chỉ thiết lập vai trò (Quản lý / Sinh viên) cho tài khoản gắn với hồ sơ."""
    if admin["ma_tk"] == ma_tk and payload.vai_tro != "QUAN_LY":
        raise HTTPException(
            status_code=400,
            detail="Không thể tự chuyển vai trò của tài khoản đang đăng nhập.",
        )

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            UPDATE tai_khoan SET vai_tro = %s WHERE ma_tk = %s
            RETURNING ma_tk, ten_dang_nhap, vai_tro, ho_ten_hien_thi
            """,
            (payload.vai_tro, ma_tk),
        )
        row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")
    return {
        "thanh_cong": True,
        "tai_khoan": row,
        "thong_bao": f"Đã cập nhật vai trò tài khoản {row['ten_dang_nhap']} thành {'Quản lý' if payload.vai_tro == 'QUAN_LY' else 'Sinh viên'}.",
    }


@router.get("/audit-logs")
async def list_audit_logs(
    bang: str | None = None,
    limit: int = Query(30, ge=5, le=100),
    _admin=Depends(require_admin),
):
    """Nhật ký Trigger ghi nhận giá trị CŨ (OLD) và MỚI (NEW) khi INSERT/UPDATE/DELETE."""
    params: list = []
    where_sql = "1=1"
    if bang and bang.strip():
        where_sql = "bang_tac_dong = %s"
        params.append(bang.strip().lower())

    rows = await fetch_all(
        f"""
        SELECT ma_log, bang_tac_dong, hanh_dong, khoa_chinh,
               gia_tri_cu, gia_tri_moi, thoi_gian
        FROM nhat_ky_du_lieu
        WHERE {where_sql}
        ORDER BY ma_log DESC
        LIMIT %s
        """,
        [*params, limit],
    )
    return {"items": rows}


@router.get("/wallet-transactions")
async def list_wallet_transactions(
    limit: int = Query(30, ge=5, le=100),
    _admin=Depends(require_admin),
):
    """Theo dõi các giao dịch cộng/trừ số dư ví KTX & tổng quỹ thu."""
    quy_row = await fetch_one("SELECT gia_tri FROM cau_hinh WHERE khoa = 'quy_thu_ktx'")
    rows = await fetch_all(
        """
        SELECT gd.ma_gd, gd.mssv, sv.ho_ten, gd.loai, gd.so_tien,
               gd.so_du_truoc, gd.so_du_sau, gd.ma_hoa_don, gd.mo_ta, gd.thoi_gian
        FROM giao_dich_vi gd
        JOIN sinh_vien sv ON sv.mssv = gd.mssv
        ORDER BY gd.ma_gd DESC
        LIMIT %s
        """,
        (limit,),
    )
    return {
        "quy_thu_ktx": int(quy_row["gia_tri"]) if quy_row and quy_row["gia_tri"].isdigit() else 0,
        "items": rows,
    }


@router.post("/test-trigger-trap")
async def test_trigger_trap(_admin=Depends(require_admin)):
    """Kiểm thử bẫy Trigger: thử sửa/xóa hóa đơn ĐÃ NỘP để chứng minh CSDL tự động chặn."""
    paid_bill = await fetch_one(
        "SELECT ma_hoa_don, so_tien FROM hoa_don WHERE trang_thai = 'DA_NOP' ORDER BY ma_hoa_don LIMIT 1"
    )
    if not paid_bill:
        raise HTTPException(status_code=404, detail="Chưa có hóa đơn đã nộp để kiểm thử Trigger.")

    try:
        async with transaction() as conn, conn.cursor() as cur:
            await cur.execute(
                "UPDATE hoa_don SET so_tien = so_tien + 1000 WHERE ma_hoa_don = %s",
                (paid_bill["ma_hoa_don"],),
            )
    except Exception as exc:
        return {
            "bi_chan": True,
            "ma_hoa_don": paid_bill["ma_hoa_don"],
            "thong_bao_trigger": str(exc).split("\n")[0],
        }
    return {"bi_chan": False, "thong_bao_trigger": "Không bị chặn"}


@router.get("/index-benchmark")
async def benchmark_large_index(_admin=Depends(require_admin)):
    """Chạy EXPLAIN ANALYZE thực tế trên bảng luot_ra_vao (>1.000.000 dòng): Seq Scan vs Index Scan."""
    stats = await fetch_one(
        """
        SELECT COUNT(*)::BIGINT AS total_rows,
               pg_size_pretty(pg_total_relation_size('luot_ra_vao')) AS table_size,
               pg_size_pretty(pg_indexes_size('luot_ra_vao')) AS index_size
        FROM luot_ra_vao
        """
    )

    sql = """
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT ma_luot, mssv, thoi_gian
        FROM luot_ra_vao
        WHERE loai = 'RA'
          AND thoi_gian >= '2025-06-01 00:00:00+07'
          AND thoi_gian < '2025-06-08 00:00:00+07'
    """

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute("SET LOCAL enable_indexscan = off")
        await cur.execute("SET LOCAL enable_bitmapscan = off")
        await cur.execute(sql)
        seq_plan = (await cur.fetchone())["QUERY PLAN"][0]

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute("SET LOCAL enable_seqscan = off")
        await cur.execute(sql)
        idx_plan = (await cur.fetchone())["QUERY PLAN"][0]

    seq_ms = round(float(seq_plan.get("Execution Time", 0.0)), 3)
    idx_ms = round(float(idx_plan.get("Execution Time", 0.0)), 3)
    speedup = round(seq_ms / idx_ms, 1) if idx_ms > 0 else 0

    return {
        "bang": "luot_ra_vao",
        "chi_muc": "idx_luot_ra_vao_loai_thoi_gian (loai, thoi_gian DESC)",
        "tong_so_dong": stats["total_rows"] if stats else 0,
        "kich_thuoc_bang": stats["table_size"] if stats else "",
        "kich_thuoc_chi_muc": stats["index_size"] if stats else "",
        "seq_scan": {
            "node_type": seq_plan["Plan"].get("Node Type"),
            "execution_time_ms": seq_ms,
            "actual_rows": seq_plan["Plan"].get("Actual Rows"),
        },
        "index_scan": {
            "node_type": idx_plan["Plan"].get("Node Type"),
            "execution_time_ms": idx_ms,
            "actual_rows": idx_plan["Plan"].get("Actual Rows"),
        },
        "speedup_x": speedup,
    }

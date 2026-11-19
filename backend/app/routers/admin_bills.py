from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.ai.forecasting import forecast_utility_consumption
from app.auth import require_admin
from app.db import fetch_all, fetch_one, transaction
from app.utils.bill_reports import (
    build_meter_template_xlsx,
    build_utility_report_pdf,
    build_utility_report_xlsx,
    fmt_vnd,
    parse_meter_upload,
)

router = APIRouter(prefix="/api/admin/bills", tags=["Quản lý - Hóa đơn điện nước"])


class ManualMeterRequest(BaseModel):
    ma_phong: int
    thang: str = Field(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$")
    chi_so_dien_cuoi: int = Field(..., ge=0)
    chi_so_nuoc_cuoi: int = Field(..., ge=0)


class ImportRowConfirm(BaseModel):
    ma_phong: int
    chi_so_dien_cuoi: int = Field(..., ge=0)
    chi_so_nuoc_cuoi: int = Field(..., ge=0)


class ImportConfirmRequest(BaseModel):
    thang: str = Field(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$")
    rows: list[ImportRowConfirm] = Field(..., min_length=1)


class SendBillsRequest(BaseModel):
    thang: str = Field(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$")
    mode: Literal["all", "rooms", "student"]
    ma_phong_list: list[int] | None = None
    mssv: str | None = None
    gui_email_ctu: bool = False


@router.get("")
async def list_utility_bills(
    thang: str | None = None,
    ma_khu: str | None = None,
    trang_thai: Literal["TAT_CA", "DA_NOP", "CHUA_NOP", "CHUA_NHAP"] = "TAT_CA",
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=50),
    sort_by: Literal["ten_phong", "so_tien", "trang_thai"] = "ten_phong",
    sort_dir: Literal["asc", "desc"] = "asc",
    _admin=Depends(require_admin),
):
    months_rows = await fetch_all(
        """
        SELECT DISTINCT thang FROM hoa_don WHERE loai = 'DIEN_NUOC'
        UNION
        SELECT DISTINCT thang FROM chi_so
        ORDER BY thang DESC
        """
    )
    available_months = [r["thang"] for r in months_rows]
    current_month = thang or (available_months[0] if available_months else datetime.now().strftime("%Y-%m"))
    if current_month not in available_months:
        available_months = sorted({*available_months, current_month}, reverse=True)

    cfg_han = await fetch_one("SELECT gia_tri FROM cau_hinh WHERE khoa = 'han_nop_dien_nuoc'")
    dg_dien = await fetch_one("SELECT don_gia FROM don_gia WHERE loai = 'DIEN' ORDER BY ap_dung_tu DESC, ma_dg DESC LIMIT 1")
    dg_nuoc = await fetch_one("SELECT don_gia FROM don_gia WHERE loai = 'NUOC' ORDER BY ap_dung_tu DESC, ma_dg DESC LIMIT 1")

    conditions = ["1=1"]
    params: list = [current_month, current_month]

    if ma_khu and ma_khu.strip():
        conditions.append("p.ma_khu = %s")
        params.append(ma_khu.strip().upper())
    if trang_thai == "DA_NOP":
        conditions.append("hd.trang_thai = 'DA_NOP'")
    elif trang_thai == "CHUA_NOP":
        conditions.append("hd.trang_thai = 'CHUA_NOP'")
    elif trang_thai == "CHUA_NHAP":
        conditions.append("cs.ma_phong IS NULL")
    if search and search.strip():
        conditions.append("p.ten_phong ILIKE %s")
        params.append(f"%{search.strip()}%")

    where_sql = " AND ".join(conditions)
    sort_map = {
        "ten_phong": "p.ten_phong",
        "so_tien": "COALESCE(hd.so_tien, -1)",
        "trang_thai": "COALESCE(hd.trang_thai, 'ZZZ')",
    }
    order_sql = f"{sort_map[sort_by]} {'ASC' if sort_dir == 'asc' else 'DESC'}, p.ten_phong ASC"
    offset = (page - 1) * page_size

    base_from = """
        FROM v_phong_chi_tiet p
        LEFT JOIN chi_so cs ON cs.ma_phong = p.ma_phong AND cs.thang = %s
        LEFT JOIN hoa_don hd ON hd.ma_phong = p.ma_phong AND hd.thang = %s AND hd.loai = 'DIEN_NUOC'
    """

    count_row = await fetch_one(
        f"SELECT COUNT(*)::INT AS total {base_from} WHERE {where_sql}",
        params,
    )
    items = await fetch_all(
        f"""
        SELECT
            p.ma_phong,
            p.ten_phong,
            p.ma_khu,
            p.so_nguoi_o,
            p.trang_thai_phong,
            p.mssv_dai_dien,
            p.ten_dai_dien,
            cs.chi_so_dien_dau,
            cs.chi_so_dien_cuoi,
            (cs.chi_so_dien_cuoi - cs.chi_so_dien_dau) AS luong_dien,
            cs.chi_so_nuoc_dau,
            cs.chi_so_nuoc_cuoi,
            (cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau) AS luong_nuoc,
            hd.ma_hoa_don,
            hd.tien_dien,
            hd.tien_nuoc,
            hd.so_tien,
            COALESCE(hd.han_nop, (SELECT gia_tri::DATE FROM cau_hinh WHERE khoa = 'han_nop_dien_nuoc' LIMIT 1)) AS han_nop,
            COALESCE(hd.trang_thai, 'CHUA_NHAP') AS trang_thai,
            COALESCE(hd.da_gui_thong_bao, FALSE) AS da_gui_thong_bao
        {base_from}
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT %s OFFSET %s
        """,
        [*params, page_size, offset],
    )

    return {
        "thang": current_month,
        "available_months": available_months,
        "han_nop_dien_nuoc": cfg_han["gia_tri"] if cfg_han else None,
        "don_gia_dien": int(dg_dien["don_gia"]) if dg_dien else 3500,
        "don_gia_nuoc": int(dg_nuoc["don_gia"]) if dg_nuoc else 15000,
        "items": items,
        "total": count_row["total"] if count_row else 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/template")
async def download_import_template(
    thang: str | None = None,
    _admin=Depends(require_admin),
):
    """Tải file mẫu Excel (.xlsx) nhập chỉ số điện nước theo tên phòng."""
    target_month = thang or datetime.now().strftime("%Y-%m")
    rooms = await fetch_all(
        """
        SELECT p.ten_phong,
               COALESCE((
                   SELECT cs.chi_so_dien_cuoi FROM chi_so cs
                   WHERE cs.ma_phong = p.ma_phong AND cs.thang < %s
                   ORDER BY cs.thang DESC LIMIT 1
               ), 0) AS dien_ky_truoc,
               COALESCE((
                   SELECT cs.chi_so_nuoc_cuoi FROM chi_so cs
                   WHERE cs.ma_phong = p.ma_phong AND cs.thang < %s
                   ORDER BY cs.thang DESC LIMIT 1
               ), 0) AS nuoc_ky_truoc
        FROM v_phong_chi_tiet p
        WHERE p.so_nguoi_o > 0
        ORDER BY p.ten_phong ASC
        """,
        (target_month, target_month),
    )

    buf = build_meter_template_xlsx(rooms)
    filename = f"mau_nhap_chi_so_{target_month}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import/preview")
async def preview_import_meters(
    thang: str = Form(...),
    file: UploadFile = File(...),
    _admin=Depends(require_admin),
):
    """Đọc file Excel/CSV, khớp tên phòng, tính lượng tiêu thụ & tiền, kiểm tra lỗi và cảnh báo bất thường."""
    content = await file.read()
    try:
        raw_rows = parse_meter_upload(file.filename or "", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not raw_rows:
        raise HTTPException(status_code=400, detail="File tải lên không có dòng dữ liệu nào.")

    dg_dien_row = await fetch_one("SELECT don_gia FROM don_gia WHERE loai = 'DIEN' ORDER BY ap_dung_tu DESC, ma_dg DESC LIMIT 1")
    dg_nuoc_row = await fetch_one("SELECT don_gia FROM don_gia WHERE loai = 'NUOC' ORDER BY ap_dung_tu DESC, ma_dg DESC LIMIT 1")
    gia_dien = int(dg_dien_row["don_gia"]) if dg_dien_row else 3500
    gia_nuoc = int(dg_nuoc_row["don_gia"]) if dg_nuoc_row else 15000

    rooms_db = await fetch_all(
        """
        SELECT p.ma_phong, p.ten_phong, p.ma_khu, p.so_nguoi_o,
               COALESCE((
                   SELECT cs.chi_so_dien_cuoi FROM chi_so cs
                   WHERE cs.ma_phong = p.ma_phong AND cs.thang < %s
                   ORDER BY cs.thang DESC LIMIT 1
               ), 0) AS dien_dau,
               COALESCE((
                   SELECT cs.chi_so_nuoc_cuoi FROM chi_so cs
                   WHERE cs.ma_phong = p.ma_phong AND cs.thang < %s
                   ORDER BY cs.thang DESC LIMIT 1
               ), 0) AS nuoc_dau,
               (
                   SELECT AVG(cs.chi_so_dien_cuoi - cs.chi_so_dien_dau) FROM chi_so cs
                   WHERE cs.ma_phong = p.ma_phong AND cs.thang < %s
               ) AS avg_dien,
               (
                   SELECT AVG(cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau) FROM chi_so cs
                   WHERE cs.ma_phong = p.ma_phong AND cs.thang < %s
               ) AS avg_nuoc,
               EXISTS(
                   SELECT 1 FROM hoa_don hd
                   WHERE hd.ma_phong = p.ma_phong AND hd.thang = %s
                     AND hd.loai = 'DIEN_NUOC' AND hd.trang_thai = 'DA_NOP'
               ) AS da_nop
        FROM v_phong_chi_tiet p
        """,
        (thang, thang, thang, thang, thang),
    )
    room_map = {r["ten_phong"].upper(): r for r in rooms_db}

    seen_rooms: set[str] = set()
    valid_rows: list[dict] = []
    error_rows: list[dict] = []
    anomalies: list[dict] = []

    for line_no, ten_phong_raw, dien_str, nuoc_str in raw_rows:
        ten_phong = ten_phong_raw.upper()
        errs: list[str] = []
        warns: list[str] = []

        room = room_map.get(ten_phong)
        if not room:
            errs.append(f"Tên phòng '{ten_phong_raw}' không tồn tại trong hệ thống.")
        elif ten_phong in seen_rooms:
            errs.append(f"Phòng '{ten_phong}' bị trùng lặp trong file.")
        else:
            seen_rooms.add(ten_phong)

        dien_cuoi: int | None = None
        nuoc_cuoi: int | None = None
        try:
            dien_cuoi = int(float(dien_str))
            if dien_cuoi < 0:
                errs.append("Chỉ số điện cuối không được âm.")
        except (ValueError, TypeError):
            errs.append(f"Chỉ số điện cuối '{dien_str}' không phải là số hợp lệ.")

        try:
            nuoc_cuoi = int(float(nuoc_str))
            if nuoc_cuoi < 0:
                errs.append("Chỉ số nước cuối không được âm.")
        except (ValueError, TypeError):
            errs.append(f"Chỉ số nước cuối '{nuoc_str}' không phải là số hợp lệ.")

        if room and not errs:
            if room["da_nop"]:
                errs.append(f"Hóa đơn tháng {thang} của phòng {ten_phong} đã được thanh toán, không thể ghi đè.")
            if dien_cuoi < room["dien_dau"]:
                errs.append(f"Chỉ số điện cuối ({dien_cuoi}) nhỏ hơn chỉ số đầu ({room['dien_dau']}).")
            if nuoc_cuoi < room["nuoc_dau"]:
                errs.append(f"Chỉ số nước cuối ({nuoc_cuoi}) nhỏ hơn chỉ số đầu ({room['nuoc_dau']}).")

        if errs:
            error_rows.append({
                "dong": line_no,
                "ten_phong": ten_phong_raw,
                "chi_so_dien_cuoi": dien_str,
                "chi_so_nuoc_cuoi": nuoc_str,
                "loi": "; ".join(errs),
            })
            continue

        luong_dien = dien_cuoi - room["dien_dau"]
        luong_nuoc = nuoc_cuoi - room["nuoc_dau"]
        tien_dien = luong_dien * gia_dien
        tien_nuoc = luong_nuoc * gia_nuoc
        tong_tien = tien_dien + tien_nuoc

        avg_d = float(room["avg_dien"]) if room["avg_dien"] is not None else None
        avg_n = float(room["avg_nuoc"]) if room["avg_nuoc"] is not None else None
        if (avg_d and avg_d > 0 and luong_dien > avg_d * 2.5) or luong_dien > 700:
            warns.append(f"Điện tiêu thụ ({luong_dien} kWh) cao bất thường so với trung bình ({int(avg_d or 0)} kWh).")
        if (avg_n and avg_n > 0 and luong_nuoc > avg_n * 2.5) or luong_nuoc > 80:
            warns.append(f"Nước tiêu thụ ({luong_nuoc} m³) cao bất thường so với trung bình ({int(avg_n or 0)} m³).")

        item = {
            "dong": line_no,
            "ma_phong": room["ma_phong"],
            "ten_phong": room["ten_phong"],
            "ma_khu": room["ma_khu"],
            "chi_so_dien_dau": room["dien_dau"],
            "chi_so_dien_cuoi": dien_cuoi,
            "luong_dien": luong_dien,
            "chi_so_nuoc_dau": room["nuoc_dau"],
            "chi_so_nuoc_cuoi": nuoc_cuoi,
            "luong_nuoc": luong_nuoc,
            "tien_dien": tien_dien,
            "tien_nuoc": tien_nuoc,
            "so_tien": tong_tien,
            "canh_bao": warns,
        }
        valid_rows.append(item)
        if warns:
            anomalies.append(item)

    missing_rooms = [
        {"ma_phong": r["ma_phong"], "ten_phong": r["ten_phong"], "ma_khu": r["ma_khu"]}
        for r in rooms_db
        if r["so_nguoi_o"] > 0 and r["ten_phong"].upper() not in seen_rooms
    ]

    return {
        "thang": thang,
        "don_gia_dien": gia_dien,
        "don_gia_nuoc": gia_nuoc,
        "tong_dong": len(raw_rows),
        "so_dong_hop_le": len(valid_rows),
        "so_dong_loi": len(error_rows),
        "so_bat_thuong": len(anomalies),
        "hop_le": valid_rows,
        "loi": error_rows,
        "phong_thieu": missing_rooms,
    }


@router.post("/import/confirm")
async def confirm_import_meters(
    payload: ImportConfirmRequest, _admin=Depends(require_admin)
):
    """Lưu toàn bộ chỉ số & tạo hóa đơn trong 1 giao dịch ACID (lỗi giữa chừng tự ROLLBACK)."""
    results = []
    async with transaction() as conn, conn.cursor() as cur:
        for row in payload.rows:
            await cur.execute(
                "SELECT sp_nhap_chi_so_va_tao_hoa_don(%s, %s, %s, %s, NULL) AS res",
                (row.ma_phong, payload.thang, row.chi_so_dien_cuoi, row.chi_so_nuoc_cuoi),
            )
            r = await cur.fetchone()
            results.append(r["res"])

    return {
        "thanh_cong": True,
        "so_phong_da_luu": len(results),
        "thang": payload.thang,
        "chi_tiet": results,
    }


@router.post("/manual")
async def manual_meter_entry(
    payload: ManualMeterRequest, _admin=Depends(require_admin)
):
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute(
            "SELECT sp_nhap_chi_so_va_tao_hoa_don(%s, %s, %s, %s, NULL) AS res",
            (payload.ma_phong, payload.thang, payload.chi_so_dien_cuoi, payload.chi_so_nuoc_cuoi),
        )
        r = await cur.fetchone()
    return r["res"]


@router.post("/send")
async def send_utility_bills(
    payload: SendBillsRequest, _admin=Depends(require_admin)
):
    """Gửi thông báo hóa đơn cho tất cả phòng, các phòng được chọn hoặc gửi riêng 1 sinh viên."""
    sent_count = 0
    emails_simulated: list[str] = []

    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute("SELECT fn_ky_hoc_hien_hanh() AS ma_ky")
        ky = (await cur.fetchone())["ma_ky"]

        if payload.mode == "student":
            if not payload.mssv:
                raise HTTPException(status_code=400, detail="Vui lòng nhập MSSV sinh viên cần gửi.")
            mssv_u = payload.mssv.strip().upper()
            await cur.execute(
                """
                SELECT sv.mssv, sv.ho_ten, sv.email, p.ma_phong, p.ten_phong, p.ma_khu,
                       hd.ma_hoa_don, hd.so_tien, hd.han_nop
                FROM sinh_vien sv
                JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = %s AND lt.ngay_ra IS NULL
                JOIN phong p ON p.ma_phong = lt.ma_phong
                JOIN hoa_don hd ON hd.ma_phong = p.ma_phong AND hd.thang = %s AND hd.loai = 'DIEN_NUOC'
                WHERE sv.mssv = %s
                """,
                (ky, payload.thang, mssv_u),
            )
            target = await cur.fetchone()
            if not target:
                raise HTTPException(
                    status_code=404,
                    detail=f"Không tìm thấy hóa đơn tháng {payload.thang} cho sinh viên {mssv_u}.",
                )
            await cur.execute(
                """
                INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
                VALUES (%s, %s, %s, 'HOA_DON', %s, %s)
                """,
                (
                    target["mssv"],
                    target["ma_phong"],
                    target["ma_khu"],
                    f"Nhắc hóa đơn điện nước tháng {payload.thang} - Phòng {target['ten_phong']}",
                    f"Hóa đơn điện nước tháng {payload.thang} phòng {target['ten_phong']} có tổng tiền {fmt_vnd(target['so_tien'])}, hạn nộp {target['han_nop'].strftime('%d/%m/%Y')}.",
                ),
            )
            await cur.execute(
                "UPDATE hoa_don SET da_gui_thong_bao = TRUE WHERE ma_hoa_don = %s",
                (target["ma_hoa_don"],),
            )
            sent_count = 1
            if payload.gui_email_ctu:
                emails_simulated.append(target["email"])
        else:
            if payload.mode == "rooms" and payload.ma_phong_list:
                await cur.execute(
                    """
                    SELECT hd.ma_hoa_don, hd.ma_phong, hd.so_tien, hd.han_nop,
                           p.ten_phong, p.ma_khu
                    FROM hoa_don hd
                    JOIN phong p ON p.ma_phong = hd.ma_phong
                    WHERE hd.thang = %s AND hd.loai = 'DIEN_NUOC'
                      AND hd.ma_phong = ANY(%s)
                    """,
                    (payload.thang, payload.ma_phong_list),
                )
            else:
                await cur.execute(
                    """
                    SELECT hd.ma_hoa_don, hd.ma_phong, hd.so_tien, hd.han_nop,
                           p.ten_phong, p.ma_khu
                    FROM hoa_don hd
                    JOIN phong p ON p.ma_phong = hd.ma_phong
                    WHERE hd.thang = %s AND hd.loai = 'DIEN_NUOC'
                    """,
                    (payload.thang,),
                )
            bills = await cur.fetchall()
            if not bills:
                raise HTTPException(
                    status_code=400,
                    detail=f"Chưa có hóa đơn điện nước nào trong tháng {payload.thang} để gửi.",
                )

            for b in bills:
                await cur.execute(
                    """
                    SELECT sv.mssv, sv.email
                    FROM luu_tru lt
                    JOIN sinh_vien sv ON sv.mssv = lt.mssv
                    WHERE lt.ma_phong = %s AND lt.ma_ky = %s AND lt.ngay_ra IS NULL
                    """,
                    (b["ma_phong"], ky),
                )
                residents = await cur.fetchall()
                for res in residents:
                    await cur.execute(
                        """
                        INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
                        VALUES (%s, %s, %s, 'HOA_DON', %s, %s)
                        """,
                        (
                            res["mssv"],
                            b["ma_phong"],
                            b["ma_khu"],
                            f"Hóa đơn điện nước tháng {payload.thang} - Phòng {b['ten_phong']}",
                            f"Phòng {b['ten_phong']} có hóa đơn điện nước tháng {payload.thang}: {fmt_vnd(b['so_tien'])}. Hạn nộp: {b['han_nop'].strftime('%d/%m/%Y')}. Sinh viên đại diện vui lòng thanh toán đúng hạn.",
                        ),
                    )
                    sent_count += 1
                    if payload.gui_email_ctu:
                        emails_simulated.append(res["email"])
                await cur.execute(
                    "UPDATE hoa_don SET da_gui_thong_bao = TRUE WHERE ma_hoa_don = %s",
                    (b["ma_hoa_don"],),
                )

    return {
        "thanh_cong": True,
        "so_thong_bao_da_gui": sent_count,
        "so_email_ctu_gia_lap": len(emails_simulated),
        "thong_bao": f"Đã gửi thông báo hóa đơn đến {sent_count} lượt sinh viên"
        + (f" (kèm {len(emails_simulated)} email CTU)." if payload.gui_email_ctu else "."),
    }


@router.post("/generate-ktx")
async def generate_ktx_semester_bills(_admin=Depends(require_admin)):
    async with transaction() as conn, conn.cursor() as cur:
        await cur.execute("SELECT sp_tao_hoa_don_ktx_ky(NULL) AS created")
        r = await cur.fetchone()
    return {
        "thanh_cong": True,
        "so_hoa_don_moi": r["created"],
        "thong_bao": f"Đã phát hành thêm {r['created']} hóa đơn tiền KTX cho các phòng đang lưu trú.",
    }


@router.get("/export")
async def export_utility_report(
    thang: str = Query(..., pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),
    format: Literal["excel", "pdf"] = "excel",
    ma_khu: str | None = None,
    _admin=Depends(require_admin),
):
    conditions = ["thang = %s"]
    params: list = [thang]
    if ma_khu and ma_khu.strip():
        conditions.append("ma_khu = %s")
        params.append(ma_khu.strip().upper())

    rows = await fetch_all(
        f"""
        SELECT ten_phong, ma_khu, ten_khu, chi_so_dien_dau, chi_so_dien_cuoi, luong_dien,
               chi_so_nuoc_dau, chi_so_nuoc_cuoi, luong_nuoc,
               tien_dien, tien_nuoc, so_tien, han_nop, trang_thai
        FROM v_bao_cao_dien_nuoc
        WHERE {' AND '.join(conditions)}
        ORDER BY ten_phong ASC
        """,
        params,
    )

    if format == "excel":
        return StreamingResponse(
            build_utility_report_xlsx(thang, rows),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="bao_cao_dien_nuoc_{thang}.xlsx"'},
        )

    return StreamingResponse(
        build_utility_report_pdf(thang, rows),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="bao_cao_dien_nuoc_{thang}.pdf"'},
    )


@router.get("/forecast")
async def get_utility_forecast(
    ma_khu: str | None = None,
    _admin=Depends(require_admin),
):
    """Dự báo tiêu thụ điện nước 3 tháng tới bằng RandomForestRegressor."""
    return await forecast_utility_consumption(ma_khu or None)

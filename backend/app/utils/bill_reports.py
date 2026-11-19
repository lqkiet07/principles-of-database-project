import csv
import io
import os
from datetime import datetime

import openpyxl
from fpdf import FPDF
from openpyxl.styles import Alignment, Font, PatternFill


def fmt_vnd(amount: int | float | None) -> str:
    if amount is None:
        return "0"
    return f"{int(amount):,}".replace(",", ".") + " đ"


def parse_meter_upload(filename: str, content: bytes) -> list[tuple[int, str, str, str]]:
    """Đọc file Excel (.xlsx) hoặc CSV (.csv) chỉ số điện nước thành danh sách (line_no, ten_phong, dien, nuoc)."""
    lower = (filename or "").lower()
    raw_rows: list[tuple[int, str, str, str]] = []

    if lower.endswith(".xlsx"):
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        for idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
            if idx == 1:
                first = str(row[0] or "").strip().lower()
                if "phong" in first or "phòng" in first or "ten" in first:
                    continue
            if not row or all(c is None or str(c).strip() == "" for c in row):
                continue
            c0 = str(row[0] if len(row) > 0 and row[0] is not None else "").strip()
            c1 = str(row[1] if len(row) > 1 and row[1] is not None else "").strip()
            c2 = str(row[2] if len(row) > 2 and row[2] is not None else "").strip()
            raw_rows.append((idx, c0, c1, c2))
        return raw_rows

    if lower.endswith(".csv"):
        text = content.decode("utf-8-sig", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        for idx, row in enumerate(reader, start=1):
            if idx == 1 and row:
                first = row[0].strip().lower()
                if "phong" in first or "phòng" in first or "ten" in first:
                    continue
            if not row or all(c.strip() == "" for c in row):
                continue
            c0 = row[0].strip() if len(row) > 0 else ""
            c1 = row[1].strip() if len(row) > 1 else ""
            c2 = row[2].strip() if len(row) > 2 else ""
            raw_rows.append((idx, c0, c1, c2))
        return raw_rows

    raise ValueError("Chỉ hỗ trợ file định dạng Excel (.xlsx) hoặc CSV (.csv).")


def build_meter_template_xlsx(rooms: list[dict]) -> io.BytesIO:
    """Tạo file mẫu Excel (.xlsx) nhập chỉ số điện nước."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "ChiSoDienNuoc"
    ws.append(["TenPhong", "ChiSoDienCuoi", "ChiSoNuocCuoi"])
    for col_idx in range(1, 4):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="1F5CA9", end_color="1F5CA9", fill_type="solid")
        cell.alignment = Alignment(horizontal="center")

    for r in rooms:
        ws.append([r["ten_phong"], r["dien_ky_truoc"] + 85, r["nuoc_ky_truoc"] + 12])

    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 18

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def build_utility_report_xlsx(thang: str, rows: list[dict]) -> io.BytesIO:
    """Tạo báo cáo tiền điện nước định dạng Excel (.xlsx)."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"BaoCao_{thang}"
    ws.append([f"BÁO CÁO TIỀN ĐIỆN NƯỚC KÝ TÚC XÁ CTU - THÁNG {thang}"])
    ws.merge_cells("A1:L1")
    ws["A1"].font = Font(bold=True, size=13, color="1F5CA9")
    ws["A1"].alignment = Alignment(horizontal="center")

    headers = [
        "Phòng", "Khu", "Điện đầu", "Điện cuối", "Tiêu thụ điện (kWh)",
        "Nước đầu", "Nước cuối", "Tiêu thụ nước (m³)",
        "Tiền điện (₫)", "Tiền nước (₫)", "Tổng cộng (₫)", "Trạng thái",
    ]
    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        c = ws.cell(row=2, column=col_idx)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill(start_color="1F5CA9", end_color="1F5CA9", fill_type="solid")
        c.alignment = Alignment(horizontal="center")

    for r in rows:
        ws.append([
            r["ten_phong"], r["ten_khu"],
            r["chi_so_dien_dau"], r["chi_so_dien_cuoi"], r["luong_dien"],
            r["chi_so_nuoc_dau"], r["chi_so_nuoc_cuoi"], r["luong_nuoc"],
            int(r["tien_dien"]), int(r["tien_nuoc"]), int(r["so_tien"]),
            "Đã nộp" if r["trang_thai"] == "DA_NOP" else "Chưa nộp",
        ])

    for col_letter, width in zip("ABCDEFGHIJKL", [10, 10, 12, 12, 18, 12, 12, 18, 15, 15, 16, 14]):
        ws.column_dimensions[col_letter].width = width

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def build_utility_report_pdf(thang: str, rows: list[dict]) -> io.BytesIO:
    """Tạo báo cáo tiền điện nước định dạng PDF hỗ trợ Unicode tiếng Việt."""
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    font_regular = r"C:\Windows\Fonts\arial.ttf"
    font_bold = r"C:\Windows\Fonts\arialbd.ttf"
    if os.path.exists(font_regular) and os.path.exists(font_bold):
        pdf.add_font("ArialVN", "", font_regular)
        pdf.add_font("ArialVN", "B", font_bold)
        font_family = "ArialVN"
    else:
        font_family = "Helvetica"

    pdf.set_font(font_family, "B", 14)
    pdf.cell(
        0, 10,
        f"BÁO CÁO ĐIỆN NƯỚC KÝ TÚC XÁ ĐẠI HỌC CẦN THƠ - THÁNG {thang}",
        align="C", new_x="LMARGIN", new_y="NEXT",
    )
    pdf.set_font(font_family, "", 9)
    pdf.cell(
        0, 6,
        f"Ngày xuất báo cáo: {datetime.now().strftime('%d/%m/%Y %H:%M')}  |  Tổng số phòng: {len(rows)}",
        align="C", new_x="LMARGIN", new_y="NEXT",
    )
    pdf.ln(3)

    col_w = [18, 16, 22, 22, 22, 22, 22, 22, 30, 28, 32, 21]
    col_headers = [
        "Phòng", "Khu", "Điện đầu", "Điện cuối", "SL Điện",
        "Nước đầu", "Nước cuối", "SL Nước", "Tiền điện", "Tiền nước", "Tổng tiền", "Trạng thái",
    ]

    pdf.set_fill_color(31, 92, 169)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(font_family, "B", 8.5)
    for w, h in zip(col_w, col_headers):
        pdf.cell(w, 8, h, border=1, align="C", fill=True)
    pdf.ln()

    pdf.set_text_color(15, 23, 42)
    pdf.set_font(font_family, "", 8.5)
    for idx, r in enumerate(rows):
        fill = idx % 2 == 1
        pdf.set_fill_color(248, 250, 252)
        vals = [
            r["ten_phong"], r["ma_khu"],
            str(r["chi_so_dien_dau"] or 0), str(r["chi_so_dien_cuoi"] or 0), str(r["luong_dien"] or 0),
            str(r["chi_so_nuoc_dau"] or 0), str(r["chi_so_nuoc_cuoi"] or 0), str(r["luong_nuoc"] or 0),
            fmt_vnd(r["tien_dien"]), fmt_vnd(r["tien_nuoc"]), fmt_vnd(r["so_tien"]),
            "Đã nộp" if r["trang_thai"] == "DA_NOP" else "Chưa nộp",
        ]
        for i_c, (w, v) in enumerate(zip(col_w, vals)):
            align = "R" if i_c in (2, 3, 4, 5, 6, 7, 8, 9, 10) else "C"
            pdf.cell(w, 7, v, border=1, align=align, fill=fill)
        pdf.ln()

    return io.BytesIO(bytes(pdf.output()))

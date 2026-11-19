"""
Script khởi tạo dữ liệu mẫu thực tế cho Hệ thống Quản lý KTX CTU (Mục 9).
Chạy: python database/07_seed_data.py
"""
from __future__ import annotations

import os
import random
from datetime import date, datetime, timedelta, timezone

import bcrypt
import psycopg

DB_URL = os.getenv(
    "ADMIN_DATABASE_URL",
    "postgresql://postgres:postgres123@localhost:5432/smart_dormitory_db",
)

VN_TZ = timezone(timedelta(hours=7))

HO_LIST = [
    "Nguyễn", "Trần", "Lê", "Phạm", "Huỳnh", "Hoàng", "Phan",
    "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Trương", "Đoàn"
]
DEM_NAM = ["Văn", "Hữu", "Minh", "Quốc", "Thanh", "Đức", "Hoàng", "Gia", "Trung", "Công", "Anh", "Nhật"]
TEN_NAM = ["An", "Bình", "Cường", "Dũng", "Đạt", "Hải", "Hào", "Hiếu", "Hùng", "Huy", "Khang", "Khoa",
           "Kiên", "Lâm", "Long", "Nam", "Nghĩa", "Nhân", "Phát", "Phong", "Phúc", "Quân", "Quang",
           "Sơn", "Tài", "Tân", "Thắng", "Thành", "Thiện", "Thịnh", "Tiến", "Toàn", "Trí", "Trung", "Tuấn", "Tùng", "Vinh"]

DEM_NU = ["Thị", "Ngọc", "Thanh", "Minh", "Thu", "Phương", "Khánh", "Mỹ", "Bảo", "Yến", "Thùy", "Hồng"]
TEN_NU = ["An", "Anh", "Châu", "Chi", "Diệp", "Dung", "Duyên", "Giang", "Hà", "Hân", "Hằng", "Hiền",
          "Hoa", "Hương", "Huyền", "Lan", "Linh", "Loan", "Mai", "My", "Nga", "Ngân", "Ngọc", "Nhi",
          "Như", "Nhung", "Oanh", "Phương", "Quyên", "Quỳnh", "Tâm", "Thảo", "Thơ", "Thư", "Thủy",
          "Tiên", "Trang", "Trinh", "Trúc", "Tú", "Tuyền", "Uyên", "Vân", "Vy", "Yến"]

NGANH_LIST = [
    "Công nghệ thông tin",
    "Kỹ thuật phần mềm",
    "Khoa học máy tính",
    "Hệ thống thông tin",
    "An toàn thông tin",
    "Mạng máy tính và truyền thông dữ liệu",
    "Kinh tế",
    "Quản trị kinh doanh",
    "Kế toán",
    "Tài chính - Ngân hàng",
    "Luật",
    "Ngôn ngữ Anh",
    "Sư phạm Toán học",
    "Công nghệ sinh học",
    "Nông học",
    "Kỹ thuật cơ khí",
    "Kỹ thuật điện",
    "Nuôi trồng thủy sản",
]


def hash_pw(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def main() -> None:
    rng = random.Random(20261119)
    now_vn = datetime.now(VN_TZ)
    today_vn = now_vn.date()

    admin_hash = hash_pw("Admin@123")
    student_hash = hash_pw("Ktx@123")

    with psycopg.connect(DB_URL, autocommit=False) as conn:
        with conn.cursor() as cur:
            # 1. Khu A, Khu B
            cur.executemany(
                "INSERT INTO khu (ma_khu, ten_khu) VALUES (%s, %s)",
                [("A", "Khu A"), ("B", "Khu B")],
            )

            # 2. Kỳ học
            cur.executemany(
                """
                INSERT INTO ky_hoc (ma_ky, ten_ky, ngay_bat_dau, ngay_ket_thuc, dang_hien_hanh)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [
                    ("HK2_2025_2026", "Học kỳ 2 (2025 - 2026)", date(2026, 1, 12), date(2026, 6, 30), False),
                    ("HK1_2026_2027", "Học kỳ 1 (2026 - 2027)", date(2026, 8, 17), date(2026, 12, 31), True),
                ],
            )

            # 3. Cấu hình hệ thống
            cur.executemany(
                "INSERT INTO cau_hinh (khoa, gia_tri, mo_ta) VALUES (%s, %s, %s)",
                [
                    ("ky_hoc_hien_tai", "HK1_2026_2027", "Mã kỳ học hiện hành"),
                    ("han_nop_ktx", (today_vn + timedelta(days=20)).isoformat(), "Hạn đóng tiền phòng KTX chung"),
                    ("han_nop_dien_nuoc", (today_vn + timedelta(days=12)).isoformat(), "Hạn đóng tiền điện nước chung"),
                    ("moc_gio_chua_ve", "24:00", "Mốc giờ xác định sinh viên chưa về trong ngày"),
                    ("che_do_bao_tri", "false", "Bật/tắt chế độ bảo trì hệ thống"),
                ],
            )

            # 4. Đơn giá điện nước (lưu lịch sử áp dụng)
            cur.executemany(
                "INSERT INTO don_gia (loai, don_gia, ap_dung_tu) VALUES (%s, %s, %s)",
                [
                    ("DIEN", 3200, datetime(2026, 1, 1, 0, 0, tzinfo=VN_TZ)),
                    ("NUOC", 14000, datetime(2026, 1, 1, 0, 0, tzinfo=VN_TZ)),
                    ("DIEN", 3500, datetime(2026, 8, 1, 0, 0, tzinfo=VN_TZ)),
                    ("NUOC", 15000, datetime(2026, 8, 1, 0, 0, tzinfo=VN_TZ)),
                ],
            )

            # 5. Tạo 48 phòng (24 Khu A, 24 Khu B) đủ loại 4/6/8, nấu ăn/không, nam/nữ
            price_map = {
                (4, False): 2400000,
                (4, True): 2800000,
                (6, False): 3000000,
                (6, True): 3400000,
                (8, False): 3200000,
                (8, True): 3600000,
            }

            rooms_meta: list[dict] = []
            for khu in ("A", "B"):
                for tang in (1, 2, 3):
                    for idx in range(1, 9):
                        ten_phong = f"{khu}{tang}{idx:02d}"
                        suc_chua = [4, 4, 4, 6, 6, 6, 8, 8][idx - 1]
                        # Tầng 1-2: Khu A Nam tầng 1-2 nửa đầu, Nữ nửa sau... phân bố rõ ràng
                        gioi_tinh = "NAM" if (idx <= 4 if khu == "A" else idx > 4) else "NU"
                        co_nau_an = (tang == 1) or (idx % 2 == 0 and tang == 2)
                        gia_phong = price_map[(suc_chua, co_nau_an)]
                        tinh_trang = "BAO_TRI" if (tang == 3 and idx == 8) else "TRONG"

                        cur.execute(
                            """
                            INSERT INTO phong (ten_phong, ma_khu, suc_chua, co_nau_an, gioi_tinh, gia_phong, tinh_trang)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            RETURNING ma_phong
                            """,
                            (ten_phong, khu, suc_chua, co_nau_an, gioi_tinh, gia_phong, tinh_trang),
                        )
                        ma_phong = cur.fetchone()[0]
                        rooms_meta.append({
                            "ma_phong": ma_phong,
                            "ten_phong": ten_phong,
                            "ma_khu": khu,
                            "suc_chua": suc_chua,
                            "co_nau_an": co_nau_an,
                            "gioi_tinh": gioi_tinh,
                            "gia_phong": gia_phong,
                            "tinh_trang": tinh_trang,
                        })

            # 6. Tài khoản quản lý
            cur.executemany(
                """
                INSERT INTO tai_khoan (ten_dang_nhap, mat_khau_bam, vai_tro, mssv, ho_ten_hien_thi, trang_thai, phai_doi_mat_khau)
                VALUES (%s, %s, 'QUAN_LY', NULL, %s, 'HOAT_DONG', FALSE)
                """,
                [
                    ("admin", admin_hash, "Nguyễn Minh Quản (Trưởng Ban KTX)"),
                    ("canbo1", admin_hash, "Trần Thị Lan (Cán bộ Nội trú)"),
                ],
            )

            # 7. Tạo 220 sinh viên CTU (110 Nam, 110 Nữ)
            students_nam: list[dict] = []
            students_nu: list[dict] = []
            used_phones: set[str] = set()

            def gen_phone() -> str:
                while True:
                    prefix = rng.choice(["091", "093", "094", "096", "097", "098", "033", "035", "038", "070", "083"])
                    p = prefix + "".join(str(rng.randint(0, 9)) for _ in range(7))
                    if p not in used_phones:
                        used_phones.add(p)
                        return p

            for i in range(1, 221):
                khoa_prefix = ["B21", "B22", "B23", "B24"][(i - 1) // 55]
                mssv = f"{khoa_prefix}{i:05d}"
                gioi_tinh = "NAM" if i % 2 == 1 else "NU"
                if i == 1:
                    ho_ten = "Nguyễn Văn An"
                    gioi_tinh = "NAM"
                    nganh = "Công nghệ thông tin"
                elif i == 2:
                    ho_ten = "Trần Thị Bích Ngọc"
                    gioi_tinh = "NU"
                    nganh = "Kỹ thuật phần mềm"
                else:
                    ho = rng.choice(HO_LIST)
                    if gioi_tinh == "NAM":
                        ho_ten = f"{ho} {rng.choice(DEM_NAM)} {rng.choice(TEN_NAM)}"
                    else:
                        ho_ten = f"{ho} {rng.choice(DEM_NU)} {rng.choice(TEN_NU)}"
                    nganh = rng.choice(NGANH_LIST)

                sdt = gen_phone()
                email = f"{mssv.lower()}@student.ctu.edu.vn"

                cur.execute(
                    """
                    INSERT INTO sinh_vien (mssv, ho_ten, gioi_tinh, nganh, sdt, email)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (mssv, ho_ten, gioi_tinh, nganh, sdt, email),
                )
                cur.execute(
                    """
                    INSERT INTO tai_khoan (ten_dang_nhap, mat_khau_bam, vai_tro, mssv, ho_ten_hien_thi, trang_thai, phai_doi_mat_khau)
                    VALUES (%s, %s, 'SINH_VIEN', %s, %s, 'HOAT_DONG', FALSE)
                    """,
                    (mssv, student_hash, mssv, ho_ten),
                )
                sv_obj = {"mssv": mssv, "ho_ten": ho_ten, "gioi_tinh": gioi_tinh, "nganh": nganh}
                if gioi_tinh == "NAM":
                    students_nam.append(sv_obj)
                else:
                    students_nu.append(sv_obj)

            # 8. Xếp sinh viên vào phòng cho HK1_2026_2027 (chừa lại ~35 SV chưa xếp để test Xếp phòng tự động)
            # Đồng thời tạo có chủ đích:
            # - 5 phòng chỉ có đúng 1 sinh viên (để thử Gộp phòng cuối kỳ)
            # - 5 phòng trống hoàn toàn
            # - Một số phòng đầy, một số phòng còn chỗ
            nam_pool = list(students_nam)
            nu_pool = list(students_nu)
            # Giữ lại 18 Nam + 18 Nữ cuối cùng làm sinh viên chưa xếp phòng
            unassigned_nam = nam_pool[-18:]
            unassigned_nu = nu_pool[-18:]
            nam_assign = nam_pool[:-18]  # 92 SV Nam
            nu_assign = nu_pool[:-18]    # 92 SV Nữ

            nam_idx = 0
            nu_idx = 0
            room_residents: dict[int, list[dict]] = {}

            # Đánh dấu các phòng trống cố định và phòng 1 người cố định
            empty_targets = {"A306", "A307", "B305", "B306", "B307"}
            solo_targets = {"A103", "A203", "A207", "B103", "B207"}

            for r in rooms_meta:
                if r["tinh_trang"] == "BAO_TRI" or r["ten_phong"] in empty_targets:
                    room_residents[r["ma_phong"]] = []
                    continue

                pool = nam_assign if r["gioi_tinh"] == "NAM" else nu_assign
                idx = nam_idx if r["gioi_tinh"] == "NAM" else nu_idx

                if idx >= len(pool):
                    room_residents[r["ma_phong"]] = []
                    continue

                if r["ten_phong"] in solo_targets:
                    take = 1
                elif r["ten_phong"] in {"A101", "A102", "B101", "B102"}:
                    take = r["suc_chua"]  # Đầy phòng mẫu đầu tiên
                else:
                    # Xen kẽ phòng đầy và phòng còn chỗ (2 .. suc_chua)
                    desired = r["suc_chua"] if (r["ma_phong"] % 3 == 0) else max(2, r["suc_chua"] - rng.choice([1, 2]))
                    take = min(desired, len(pool) - idx)

                chosen = pool[idx : idx + take]
                if r["gioi_tinh"] == "NAM":
                    nam_idx += len(chosen)
                else:
                    nu_idx += len(chosen)

                room_residents[r["ma_phong"]] = chosen
                for sv in chosen:
                    cur.execute(
                        """
                        INSERT INTO luu_tru (mssv, ma_phong, ma_ky, ngay_vao)
                        VALUES (%s, %s, 'HK1_2026_2027', %s)
                        """,
                        (sv["mssv"], r["ma_phong"], date(2026, 8, 17) + timedelta(days=rng.randint(0, 7))),
                    )

            # 9. Hợp đồng nội trú (chừa 5 phòng có người nhưng CHƯA ký hợp đồng để test)
            unsigned_rooms = {"A204", "A301", "B204", "B301", "B302"}
            room_reps: dict[int, str] = {}
            for r in rooms_meta:
                res = room_residents.get(r["ma_phong"], [])
                if not res:
                    continue
                if r["ten_phong"] in unsigned_rooms:
                    continue
                rep = res[0]["mssv"]
                room_reps[r["ma_phong"]] = rep
                cur.execute(
                    """
                    INSERT INTO hop_dong (ma_phong, ma_ky, mssv_dai_dien, ngay_ky, trang_thai)
                    VALUES (%s, 'HK1_2026_2027', %s, %s, 'HIEU_LUC')
                    """,
                    (r["ma_phong"], rep, date(2026, 8, 20) + timedelta(days=rng.randint(0, 10))),
                )

            # 10. Hóa đơn tiền KTX kỳ HK1_2026_2027
            cur.execute("SELECT sp_tao_hoa_don_ktx_ky('HK1_2026_2027')")
            # Đánh dấu ~55% phòng đã đóng tiền KTX (giữ A101 và một số phòng chưa đóng để demo QR)
            cur.execute(
                """
                SELECT hd.ma_hoa_don, hd.ma_phong, p.ten_phong
                FROM hoa_don hd
                JOIN phong p ON p.ma_phong = hd.ma_phong
                WHERE hd.loai = 'KTX' AND hd.ma_ky = 'HK1_2026_2027'
                ORDER BY p.ten_phong
                """
            )
            ktx_bills = cur.fetchall()
            for ma_hd, ma_phong, ten_phong in ktx_bills:
                if ten_phong in {"A101", "A102", "B101", "B102", "A105"}:
                    continue
                if ma_phong in room_reps and rng.random() < 0.6:
                    cur.execute(
                        "SELECT sp_thanh_toan_hoa_don(%s, %s, %s)",
                        (ma_hd, room_reps[ma_phong], f"QR-KTX-{ten_phong}-20260901"),
                    )

            # 11. Chỉ số & hóa đơn điện nước 3 tháng: 2026-09, 2026-10, 2026-11
            months = ["2026-09", "2026-10", "2026-11"]
            missing_nov_rooms = {"A302", "A303", "B302", "B303", "B304"}
            prev_elec: dict[int, int] = {}
            prev_water: dict[int, int] = {}

            for r in rooms_meta:
                mp = r["ma_phong"]
                res = room_residents.get(mp, [])
                if not res:
                    continue
                prev_elec[mp] = rng.randint(1200, 3500)
                prev_water[mp] = rng.randint(120, 400)
                # Khởi tạo kỳ mốc 2026-08 để 2026-09 có chỉ số đầu tự nhiên
                cur.execute(
                    """
                    INSERT INTO chi_so (ma_phong, thang, chi_so_dien_dau, chi_so_dien_cuoi, chi_so_nuoc_dau, chi_so_nuoc_cuoi)
                    VALUES (%s, '2026-08', %s, %s, %s, %s)
                    """,
                    (mp, prev_elec[mp] - 50, prev_elec[mp], prev_water[mp] - 8, prev_water[mp]),
                )

            for m in months:
                for r in rooms_meta:
                    mp = r["ma_phong"]
                    res = room_residents.get(mp, [])
                    if not res:
                        continue
                    if m == "2026-11" and r["ten_phong"] in missing_nov_rooms:
                        continue

                    n_people = len(res)
                    d_elec = n_people * rng.randint(25, 45) + (20 if r["co_nau_an"] else 0)
                    d_water = n_people * rng.randint(3, 6) + (2 if r["co_nau_an"] else 0)
                    prev_elec[mp] += d_elec
                    prev_water[mp] += d_water

                    cur.execute(
                        "SELECT sp_nhap_chi_so_va_tao_hoa_don(%s, %s, %s, %s, 'HK1_2026_2027')",
                        (mp, m, prev_elec[mp], prev_water[mp]),
                    )
                    res_json = cur.fetchone()[0]
                    ma_hd = res_json["ma_hoa_don"]

                    # Thanh toán cho tháng cũ (95% tháng 09, 80% tháng 10, 35% tháng 11; giữ A101 & A105 chưa nộp tháng 11)
                    if mp in room_reps:
                        pay_prob = 0.95 if m == "2026-09" else (0.80 if m == "2026-10" else 0.35)
                        if m == "2026-11" and r["ten_phong"] in {"A101", "A102", "B101", "A105"}:
                            pay_prob = 0.0
                        if rng.random() < pay_prob:
                            cur.execute(
                                "SELECT sp_thanh_toan_hoa_don(%s, %s, %s)",
                                (ma_hd, room_reps[mp], f"QR-DN-{r['ten_phong']}-{m.replace('-', '')}"),
                            )

            # Đánh dấu đã gửi thông báo cho các hóa đơn tháng 11 đã nhập
            cur.execute("UPDATE hoa_don SET da_gui_thong_bao = TRUE WHERE thang IN ('2026-09', '2026-10')")

            # 12. Yêu cầu bảo trì sửa chữa (nhiều trạng thái, kèm lịch sửa & SĐT kỹ thuật khi đã tiếp nhận)
            room_by_name = {r["ten_phong"]: r for r in rooms_meta}
            maint_samples = [
                ("A101", "A", room_residents[room_by_name["A101"]["ma_phong"]][0]["mssv"], "DIEN", "Bóng đèn tuýp khu vực bàn học bị nhấp nháy liên tục", "MOI", None, None, None),
                ("A102", "A", room_residents[room_by_name["A102"]["ma_phong"]][0]["mssv"], "NUOC", "Vòi sen nhà vệ sinh rò rỉ nước nhẹ", "DA_TIEP_NHAN", "Kỹ thuật sẽ đến thay gioăng và kiểm tra đường ống buổi sáng.", "0918442211", today_vn + timedelta(days=1)),
                ("A104", "A", room_residents[room_by_name["A104"]["ma_phong"]][0]["mssv"], "NOI_THAT", "Bản lề tủ quần áo số 2 bị bung ốc", "DANG_XU_LY", "Đang thay bộ bản lề mới.", "0939551100", today_vn),
                ("A201", "A", room_residents[room_by_name["A201"]["ma_phong"]][0]["mssv"], "DIEN", "Ổ cắm điện gần cửa ra vào không có nguồn", "HOAN_TAT", "Đã thay mới ổ cắm và kiểm tra an toàn điện.", "0918442211", today_vn - timedelta(days=1)),
                ("B101", "B", room_residents[room_by_name["B101"]["ma_phong"]][0]["mssv"], "NUOC", "Bồn rửa mặt thoát nước chậm", "MOI", None, None, None),
                ("B104", "B", room_residents[room_by_name["B104"]["ma_phong"]][0]["mssv"], "CONG_TRINH", "Cửa sổ hành lang bị kẹt chốt khóa", "DANG_XU_LY", "Đang tra dầu và chỉnh lại khung khóa.", "0907338899", today_vn),
                ("B202", "B", room_residents[room_by_name["B202"]["ma_phong"]][0]["mssv"], "NOI_THAT", "Quạt trần quay chậm và kêu lớn", "DA_TIEP_NHAN", "Thay tụ quạt và vệ sinh cánh quạt vào 14:00.", "0918442211", today_vn + timedelta(days=1)),
                ("A308", "A", None, "CONG_TRINH", "Sơn sửa lại tường và thay mới hệ thống ống nước toàn phòng", "DANG_XU_LY", "Đang thi công nâng cấp định kỳ.", "0907338899", today_vn),
                ("B308", "B", None, "DIEN", "Nâng cấp tủ điện và thay mới dây dẫn âm tường", "DANG_XU_LY", "Đang thi công tủ điện phòng B308.", "0918442211", today_vn),
                (None, "B", None, "NUOC", "Bảo trì định kỳ bồn chứa nước mái Khu B (dự kiến cắt nước 13:00 - 15:00)", "DA_TIEP_NHAN", "Vệ sinh bồn chứa toàn khu B.", "0939551100", today_vn + timedelta(days=1)),
            ]
            for ten_p, mk, sv_m, nhom, mo_ta, tt, gc, sdt_s, ngay_s in maint_samples:
                mp = room_by_name[ten_p]["ma_phong"] if ten_p else None
                cur.execute(
                    """
                    INSERT INTO yeu_cau_bao_tri (ma_phong, ma_khu, mssv, nhom_su_co, mo_ta, trang_thai, ghi_chu_xu_ly, sdt_nguoi_sua, ngay_sua, thoi_gian)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (mp, mk, sv_m, nhom, mo_ta, tt, gc, sdt_s, ngay_s, now_vn - timedelta(hours=rng.randint(2, 96))),
                )

            # 13. Yêu cầu đổi phòng (Chờ xử lý / Đã duyệt / Từ chối)
            def get_res(ten_p: str, pos: int = 1) -> str:
                lst = room_residents[room_by_name[ten_p]["ma_phong"]]
                return lst[min(pos, len(lst) - 1)]["mssv"]

            swap_samples = [
                (get_res("A101", 1), "A101", None, "A", 4, "Em muốn chuyển sang phòng cùng khu có bạn học chung lớp Công nghệ thông tin để tiện làm đồ án.", "CHO_XU_LY", None, None),
                (get_res("A105", 1), "A105", None, "A", 6, "Em có nhu cầu chuyển sang phòng có nấu ăn để tự chuẩn bị bữa ăn theo chế độ sức khỏe.", "CHO_XU_LY", None, None),
                (get_res("B102", 1), "B102", None, "B", 4, "Phòng hiện tại ở tầng 1 hơi ồn vào buổi sáng, em xin chuyển lên tầng cao hơn để ôn thi.", "CHO_XU_LY", None, None),
                (get_res("A202", 1), "A202", "A201", "A", 4, "Xin chuyển về gần phòng bạn cùng quê.", "DA_DUYET", "Chuyển hồ sơ đến Phòng Quản lý KTX (Bàn số 2) trước 16:30 để ký bàn giao chìa khóa phòng mới.", None),
                (get_res("B201", 1), "B201", None, "A", 4, "Muốn chuyển sang phòng đơn 1 người.", "TU_CHOI", None, "KTX hiện không có loại phòng đơn 1 người, vui lòng chọn loại phòng 4, 6 hoặc 8 sinh viên."),
            ]
            for sv_m, ten_cu, ten_moi, nv_khu, nv_loai, ly_do, tt, ghi_chu_duyet, ly_do_tc in swap_samples:
                mp_cu = room_by_name[ten_cu]["ma_phong"]
                mp_moi = room_by_name[ten_moi]["ma_phong"] if ten_moi else None
                cur.execute(
                    """
                    INSERT INTO yeu_cau_doi_phong (
                        mssv, ma_ky, phong_hien_tai, phong_moi, nguyen_vong_khu, nguyen_vong_loai,
                        ly_do, trang_thai, ghi_chu_duyet, ly_do_tu_choi, thoi_gian, ngay_xu_ly
                    )
                    VALUES (%s, 'HK1_2026_2027', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        sv_m, mp_cu, mp_moi, nv_khu, nv_loai, ly_do, tt, ghi_chu_duyet, ly_do_tc,
                        now_vn - timedelta(days=rng.randint(1, 5)),
                        now_vn - timedelta(hours=12) if tt != "CHO_XU_LY" else None,
                    ),
                )

            # 14. Nhật ký ra vào cổng 7 ngày gần nhất + ~10 sinh viên chưa về hôm nay
            active_students = [sv["mssv"] for lst in room_residents.values() for sv in lst]
            logs_batch = []
            # 6 ngày trước
            for day_offset in range(6, 0, -1):
                d = today_vn - timedelta(days=day_offset)
                sample_sv = rng.sample(active_students, min(65, len(active_students)))
                for m in sample_sv:
                    out_h = rng.randint(6, 13)
                    out_m = rng.randint(0, 59)
                    in_h = rng.randint(max(out_h + 2, 11), 21)
                    in_m = rng.randint(0, 59)
                    logs_batch.append((m, "RA", datetime(d.year, d.month, d.day, out_h, out_m, tzinfo=VN_TZ)))
                    logs_batch.append((m, "VAO", datetime(d.year, d.month, d.day, in_h, in_m, tzinfo=VN_TZ)))

            # Hôm nay: ~50 SV ra và đã về + 10 SV ra nhưng CHƯA về
            today_sv = rng.sample(active_students, min(60, len(active_students)))
            returned_today = today_sv[:50]
            not_returned_today = today_sv[50:]

            cur_hour = max(now_vn.hour, 8)
            for m in returned_today:
                out_h = rng.randint(6, max(7, min(cur_hour - 2, 14)))
                out_m = rng.randint(0, 59)
                in_h = rng.randint(min(out_h + 1, cur_hour), cur_hour)
                in_m = rng.randint(0, max(0, now_vn.minute - 1) if in_h == cur_hour else 59)
                logs_batch.append((m, "RA", datetime(today_vn.year, today_vn.month, today_vn.day, out_h, out_m, tzinfo=VN_TZ)))
                logs_batch.append((m, "VAO", datetime(today_vn.year, today_vn.month, today_vn.day, in_h, in_m, tzinfo=VN_TZ)))

            for m in not_returned_today:
                out_h = rng.randint(7, max(7, min(cur_hour, 17)))
                out_m = rng.randint(0, max(0, now_vn.minute - 1) if out_h == cur_hour else 59)
                logs_batch.append((m, "RA", datetime(today_vn.year, today_vn.month, today_vn.day, out_h, out_m, tzinfo=VN_TZ)))

            cur.executemany(
                "INSERT INTO luot_ra_vao (mssv, loai, thoi_gian) VALUES (%s, %s, %s)",
                logs_batch,
            )

            # 14b. Dữ liệu lượt truy cập trang web theo ngày / tuần / tháng
            visits_batch = []
            # Các ngày trong tháng hiện tại (từ mùng 1 đến hôm nay)
            first_of_month = today_vn.replace(day=1)
            day_cursor = first_of_month
            while day_cursor <= today_vn:
                n_visits = rng.randint(45, 95) if day_cursor < today_vn else rng.randint(35, 65)
                max_h = 22 if day_cursor < today_vn else max(now_vn.hour, 8)
                for _ in range(n_visits):
                    h = rng.randint(6, max_h)
                    mi = rng.randint(0, 59) if h < max_h else rng.randint(0, max(0, now_vn.minute))
                    role_pick = "QUAN_LY" if rng.random() < 0.15 else "SINH_VIEN"
                    path_pick = "/admin" if role_pick == "QUAN_LY" else "/student"
                    visits_batch.append(
                        (role_pick, path_pick, datetime(day_cursor.year, day_cursor.month, day_cursor.day, h, mi, tzinfo=VN_TZ))
                    )
                day_cursor += timedelta(days=1)

            cur.executemany(
                "INSERT INTO luot_truy_cap_web (vai_tro, duong_dan, thoi_gian) VALUES (%s, %s, %s)",
                visits_batch,
            )

            # 15. Xóa bớt thông báo trùng lặp từ seed thanh toán và tạo thông báo mẫu sạch
            cur.execute("DELETE FROM thong_bao")
            # Thông báo hóa đơn tháng 11 cho A101 và các phòng chưa nộp
            for r in rooms_meta[:10]:
                res = room_residents.get(r["ma_phong"], [])
                for sv in res:
                    cur.execute(
                        """
                        INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung, thoi_gian, da_doc)
                        VALUES (%s, %s, %s, 'HOA_DON', %s, %s, %s, %s)
                        """,
                        (
                            sv["mssv"], r["ma_phong"], r["ma_khu"],
                            f"Thông báo hóa đơn điện nước tháng 11/2026 - Phòng {r['ten_phong']}",
                            f"Hóa đơn điện nước tháng 11/2026 của phòng {r['ten_phong']} đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.",
                            now_vn - timedelta(hours=6),
                            False,
                        ),
                    )
            # Thông báo bảo trì chung cho Khu B
            for r in rooms_meta:
                if r["ma_khu"] == "B":
                    for sv in room_residents.get(r["ma_phong"], []):
                        cur.execute(
                            """
                            INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung, thoi_gian, da_doc)
                            VALUES (%s, %s, 'B', 'BAO_TRI', %s, %s, %s, FALSE)
                            """,
                            (
                                sv["mssv"], r["ma_phong"],
                                "Thông báo bảo trì hệ thống nước Khu B",
                                "Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.",
                                now_vn - timedelta(hours=3),
                            ),
                        )

        conn.commit()
        print("Khoi tao du lieu mau CTU KTX thanh cong!")
        print(f"  - Phong: {len(rooms_meta)} phong (Khu A, Khu B)")
        print(f"  - Sinh vien: 220 (dang o: {len(active_students)}, chua xep: {len(unassigned_nam) + len(unassigned_nu)})")
        print(f"  - Sinh vien chua xep mau (Nam): {[s['mssv'] for s in unassigned_nam[:6]]}")
        print(f"  - Sinh vien chua xep mau (Nu) : {[s['mssv'] for s in unassigned_nu[:6]]}")
        print("  - Tai khoan Quan ly : admin / Admin@123  |  canbo1 / Admin@123")
        print("  - Tai khoan SV dai dien A101: B2100001 / Ktx@123 (doi MK lan dau)")


if __name__ == "__main__":
    main()

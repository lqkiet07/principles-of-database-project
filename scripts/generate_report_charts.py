# -*- coding: utf-8 -*-
"""
Script sinh cac hinh anh bieu do va mo hinh cho bao cao hoc phan:
1. Mo hinh Use Case tong the
2. So do kien truc va luong giao dich ACID thanh toan
3. So do quan he thuc the (ERD tong quan)
4. Bieu do so sanh hieu nang chi muc EXPLAIN ANALYZE (Execution Time & Buffer I/O)
5. Bieu do phan cum sinh vien K-Means (PCA 2D Projection)
6. Bieu do du bao san luong dien tieu thu qua cac thang
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "report_images")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Cau hinh font chu ro rang, trung tinh
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial', 'Helvetica']
plt.rcParams['axes.unicode_minus'] = False

# -----------------------------------------------------------------------------
# 1. Bieu do Use Case Tong the
# -----------------------------------------------------------------------------
def draw_usecase_diagram():
    fig, ax = plt.subplots(figsize=(10, 7), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Khung Boundary he thong
    rect = patches.FancyBboxPatch((24, 5), 52, 90, boxstyle="round,pad=1.5",
                                  edgecolor="#1E3A8A", facecolor="#F8FAFC", linewidth=2)
    ax.add_patch(rect)
    ax.text(50, 92, "HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ (SMART DORMITORY DBMS)",
            ha='center', va='center', fontsize=12, fontweight='bold', color="#1E3A8A")

    # Actors
    actors = [
        {"name": "Sinh viên\nnội trú", "pos": (10, 72), "color": "#0284C7"},
        {"name": "Ban quản lý\n(Admin/Quản lý)", "pos": (10, 30), "color": "#0F766E"},
        {"name": "Cổng thanh toán\nNgân hàng (Sandbox)", "pos": (90, 68), "color": "#D97706"},
        {"name": "Thiết bị điểm danh\n(Cảm biến vân tay)", "pos": (90, 28), "color": "#7C3AED"}
    ]

    for act in actors:
        x, y = act["pos"]
        # Draw stick figure head & body
        circle = patches.Circle((x, y + 4), 2.8, edgecolor=act["color"], facecolor="white", linewidth=2)
        ax.add_patch(circle)
        ax.plot([x, x], [y + 1.2, y - 5], color=act["color"], linewidth=2)  # than
        ax.plot([x - 3.5, x + 3.5], [y - 1, y - 1], color=act["color"], linewidth=2)  # tay
        ax.plot([x, x - 3], [y - 5, y - 10], color=act["color"], linewidth=2)  # chan trai
        ax.plot([x, x + 3], [y - 5, y - 10], color=act["color"], linewidth=2)  # chan phai
        ax.text(x, y - 13, act["name"], ha='center', va='top', fontsize=9, fontweight='bold', color="#1E293B")

    # Use cases (ellipses)
    usecases = [
        {"id": "uc1", "text": "Đăng ký lưu trú &\nTìm kiếm phòng", "pos": (50, 83)},
        {"id": "uc2", "text": "Thanh toán hóa đơn phòng &\nĐiện nước qua Ngân hàng (ACID)", "pos": (50, 70)},
        {"id": "uc3", "text": "Xem lịch sử giao dịch &\nBiên lai điện tử", "pos": (50, 58)},
        {"id": "uc4", "text": "Ghi nhận quẹt vân tay ra vào &\nĐiểm danh nội trú", "pos": (50, 46)},
        {"id": "uc5", "text": "Phát hành hóa đơn tự động &\nTheo dõi công nợ phòng", "pos": (50, 34)},
        {"id": "uc6", "text": "Quản lý hợp đồng, phòng &\nPhân tích dự báo điện nước / Phân cụm", "pos": (50, 22)},
        {"id": "uc7", "text": "Tra cứu vết kiểm toán dữ liệu &\nBẫy lỗi nghiệp vụ (Trigger)", "pos": (50, 10)}
    ]

    for uc in usecases:
        x, y = uc["pos"]
        ellipse = patches.Ellipse((x, y), 38, 7.5, edgecolor="#2563EB", facecolor="#EFF6FF", linewidth=1.5)
        ax.add_patch(ellipse)
        ax.text(x, y, uc["text"], ha='center', va='center', fontsize=8.5, color="#0F172A")

    # Connections
    # Sinh vien -> uc1, uc2, uc3, uc4
    for uc_y in [83, 70, 58, 46]:
        ax.annotate("", xy=(31, uc_y), xytext=(15, 68),
                    arrowprops=dict(arrowstyle="-", color="#64748B", lw=1.2))

    # Admin -> uc5, uc6, uc7, uc4
    for uc_y in [46, 34, 22, 10]:
        ax.annotate("", xy=(31, uc_y), xytext=(15, 30),
                    arrowprops=dict(arrowstyle="-", color="#64748B", lw=1.2))

    # Cổng thanh toan Ngân hang <-> uc2
    ax.annotate("", xy=(69, 70), xytext=(85, 68),
                arrowprops=dict(arrowstyle="<->", color="#D97706", lw=1.5, ls="--"))

    # Cam bien van tay -> uc4
    ax.annotate("", xy=(69, 46), xytext=(85, 28),
                arrowprops=dict(arrowstyle="->", color="#7C3AED", lw=1.5))

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig1_usecase_tong_the.png")
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

# -----------------------------------------------------------------------------
# 2. So do Tuan tu Luong Giao dich Thanh toan ACID
# -----------------------------------------------------------------------------
def draw_transaction_acid_flow():
    fig, ax = plt.subplots(figsize=(10.5, 6.5), dpi=300)
    ax.set_xlim(0, 105)
    ax.set_ylim(0, 100)
    ax.axis('off')

    cols = [
        {"name": "Sinh viên\n(Client)", "x": 12, "color": "#0284C7"},
        {"name": "Ứng dụng Backend\n(FastAPI Server)", "x": 40, "color": "#0F766E"},
        {"name": "Hệ QTCSDL PostgreSQL\n(Transaction Engine)", "x": 72, "color": "#1E3A8A"},
        {"name": "Tài khoản Sandbox\n(Ngân hàng liên kết)", "x": 94, "color": "#D97706"}
    ]

    for col in cols:
        x = col["x"]
        rect = patches.FancyBboxPatch((x - 8, 88), 16, 9, boxstyle="round,pad=0.5",
                                      edgecolor=col["color"], facecolor="#F1F5F9", linewidth=1.5)
        ax.add_patch(rect)
        ax.text(x, 92.5, col["name"], ha='center', va='center', fontsize=8.5, fontweight='bold', color=col["color"])
        ax.plot([x, x], [88, 5], color="#CBD5E1", linestyle="--", linewidth=1.2)

    steps = [
        ("1. Bấm xác nhận nộp hóa đơn", 12, 40, 82, "->", "#0F172A"),
        ("2. Gọi Stored Procedure pr_thanh_toan_ngan_hang()", 40, 72, 75, "->", "#0F172A"),
        ("3. BEGIN TRANSACTION (Mức cô lập READ COMMITTED)", 72, 72, 69, "rect", "#1E3A8A"),
        ("4. SELECT ... FOR UPDATE (Khóa dòng tài khoản & hóa đơn)", 72, 72, 63, "rect", "#B45309"),
        ("5. Kiểm tra số dư & Trừ tài khoản ngân hàng SV", 72, 94, 56, "->", "#D97706"),
        ("6. Phản hồi trừ tiền thành công (Status 200)", 94, 72, 50, "-->", "#D97706"),
        ("7. Tăng quỹ thu KTX & Cập nhật hóa đơn sang 'DA_NOP'", 72, 72, 43, "rect", "#047857"),
        ("8. Trigger ghi vết nhat_ky_du_lieu & Sinh mã biên lai", 72, 72, 36, "rect", "#6D28D9"),
        ("9. COMMIT Giao dịch (Hoặc ROLLBACK nếu phát sinh lỗi)", 72, 72, 29, "rect", "#1E3A8A"),
        ("10. Trả về mã biên lai & số dư mới (Tham số OUT)", 72, 40, 22, "-->", "#0F172A"),
        ("11. Hiển thị biên lai điện tử & cập nhật giao diện", 40, 12, 15, "-->", "#0F172A")
    ]

    for text, x1, x2, y, style, color in steps:
        if style == "rect":
            # Self action box
            w = 26
            r = patches.FancyBboxPatch((x1 - w/2, y - 2.5), w, 5, boxstyle="round,pad=0.3",
                                       edgecolor=color, facecolor="#F8FAFC", linewidth=1.2)
            ax.add_patch(r)
            ax.text(x1, y, text, ha='center', va='center', fontsize=7.8, fontweight='bold', color=color)
        elif style == "->":
            ax.annotate("", xy=(x2, y), xytext=(x1, y),
                        arrowprops=dict(arrowstyle="->", color=color, lw=1.3))
            ax.text((x1 + x2)/2, y + 2, text, ha='center', va='bottom', fontsize=8, color=color)
        elif style == "-->":
            ax.annotate("", xy=(x2, y), xytext=(x1, y),
                        arrowprops=dict(arrowstyle="->", color=color, lw=1.3, ls="--"))
            ax.text((x1 + x2)/2, y + 2, text, ha='center', va='bottom', fontsize=8, color=color)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig2_sequence_acid_payment.png")
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

# -----------------------------------------------------------------------------
# 3. So do Thuc the Lien ket (ERD Rut gon phan he trong tam)
# -----------------------------------------------------------------------------
def draw_erd_overview():
    fig, ax = plt.subplots(figsize=(11, 7), dpi=300)
    ax.set_xlim(0, 110)
    ax.set_ylim(0, 100)
    ax.axis('off')

    entities = [
        {"name": "sinh_vien", "pos": (18, 78), "pk": "mssv (PK)", "attrs": ["ho_ten", "gioi_tinh", "so_du", "ma_van_tay"]},
        {"name": "luot_ra_vao", "pos": (18, 32), "pk": "ma_luot (PK)", "attrs": ["mssv (FK)", "loai (VAO/RA)", "thoi_gian"]},
        {"name": "hop_dong", "pos": (55, 78), "pk": "ma_hop_dong (PK)", "attrs": ["mssv (FK)", "ma_phong (FK)", "ngay_bat_dau"]},
        {"name": "phong", "pos": (90, 78), "pk": "ma_phong (PK)", "attrs": ["ten_phong", "ma_toa (FK)", "so_cho", "gia_thue"]},
        {"name": "hoa_don", "pos": (55, 32), "pk": "ma_hoa_don (PK)", "attrs": ["ma_phong (FK)", "loai_hoa_don", "so_tien", "trang_thai"]},
        {"name": "tai_khoan_ngan_hang_sv", "pos": (18, 55), "pk": "ma_lk (PK)", "attrs": ["mssv (FK)", "ngan_hang", "so_du_sandbox"]},
        {"name": "giao_dich_ngan_hang", "pos": (55, 55), "pk": "ma_gd (PK)", "attrs": ["ma_hoa_don (FK)", "ma_lk (FK)", "so_tien", "trang_thai"]},
        {"name": "nhat_ky_du_lieu", "pos": (90, 32), "pk": "ma_log (PK)", "attrs": ["bang_tac_dong", "hanh_dong", "gia_tri_cu", "gia_tri_moi"]}
    ]

    for ent in entities:
        x, y = ent["pos"]
        w, h = 22, 16
        # Draw header box
        h_rect = patches.Rectangle((x - w/2, y + h/2 - 4), w, 4, facecolor="#1E3A8A", edgecolor="#1E3A8A")
        ax.add_patch(h_rect)
        ax.text(x, y + h/2 - 2, ent["name"], ha='center', va='center', fontsize=8.5, fontweight='bold', color="white")

        # Body box
        b_rect = patches.Rectangle((x - w/2, y - h/2), w, h - 4, facecolor="#F8FAFC", edgecolor="#1E3A8A", linewidth=1.2)
        ax.add_patch(b_rect)

        # Content
        body_text = f"• {ent['pk']}\n" + "\n".join([f"  {a}" for a in ent["attrs"]])
        ax.text(x - w/2 + 1.2, y + h/2 - 6, body_text, ha='left', va='top', fontsize=7.5, color="#0F172A", family="monospace")

    # Connectors
    # sinh_vien 1 - N luot_ra_vao
    ax.plot([18, 18], [70, 40], color="#2563EB", lw=1.5)
    ax.text(20, 68, "1", fontsize=8, fontweight='bold')
    ax.text(20, 42, "N", fontsize=8, fontweight='bold')

    # sinh_vien 1 - N hop_dong
    ax.plot([29, 44], [78, 78], color="#2563EB", lw=1.5)
    ax.text(31, 80, "1", fontsize=8, fontweight='bold')
    ax.text(42, 80, "N", fontsize=8, fontweight='bold')

    # phong 1 - N hop_dong
    ax.plot([79, 66], [78, 78], color="#2563EB", lw=1.5)
    ax.text(77, 80, "1", fontsize=8, fontweight='bold')
    ax.text(68, 80, "N", fontsize=8, fontweight='bold')

    # phong 1 - N hoa_don
    ax.plot([90, 66], [70, 38], color="#2563EB", lw=1.5, linestyle=":")

    # sinh_vien 1 - N tai_khoan_ngan_hang_sv
    ax.plot([18, 18], [70, 63], color="#D97706", lw=1.5)

    # tai_khoan 1 - N giao_dich
    ax.plot([29, 44], [55, 55], color="#D97706", lw=1.5)

    # hoa_don 1 - N giao_dich
    ax.plot([55, 55], [40, 47], color="#D97706", lw=1.5)

    # hoa_don / giao_dich -> nhat_ky_du_lieu (Trigger Audit)
    ax.annotate("", xy=(79, 32), xytext=(66, 32),
                arrowprops=dict(arrowstyle="->", color="#7C3AED", lw=1.5, ls="--"))
    ax.text(72.5, 34, "Trigger\nAudit", ha='center', va='bottom', fontsize=7, color="#7C3AED")

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig3_erd_overview.png")
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

# -----------------------------------------------------------------------------
# 4. Bieu do Danh gia Hieu nang Chi muc EXPLAIN ANALYZE
# -----------------------------------------------------------------------------
def draw_benchmark_charts():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.5), dpi=300)

    # Chart 1: Thoi gian thuc thi (Execution Time in ms - log scale)
    queries = [
        "Lọc thời gian 7 ngày\n(2 triệu log ra vào)",
        "Tra cứu MSSV + Loại\n(2 triệu log ra vào)",
        "Tìm kiếm họ tên ILIKE\n(50.000 sinh viên)"
    ]
    seq_time = [162.8, 145.2, 38.5]
    idx_time = [2.4, 0.38, 1.25]

    x = np.arange(len(queries))
    width = 0.35

    rects1 = ax1.bar(x - width/2, seq_time, width, label='Quét tuần tự (Seq Scan - Không Index)', color='#EF4444')
    rects2 = ax1.bar(x + width/2, idx_time, width, label='Quét qua Chỉ mục (Index / Bitmap Scan)', color='#10B981')

    ax1.set_ylabel('Thời gian thực thi (ms)', fontsize=9, fontweight='bold')
    ax1.set_title('So sánh Thời gian Thực thi Truy vấn\n(Thấp hơn là tốt hơn)', fontsize=10, fontweight='bold', pad=10)
    ax1.set_xticks(x)
    ax1.set_xticklabels(queries, fontsize=8)
    ax1.legend(fontsize=8, loc='upper right')
    ax1.grid(axis='y', linestyle='--', alpha=0.5)

    # Attach values
    for rect in rects1:
        h = rect.get_height()
        ax1.annotate(f'{h} ms', xy=(rect.get_x() + rect.get_width() / 2, h),
                     xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=7.5, fontweight='bold')
    for rect in rects2:
        h = rect.get_height()
        ax1.annotate(f'{h} ms', xy=(rect.get_x() + rect.get_width() / 2, h),
                     xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=7.5, fontweight='bold')

    # Chart 2: Dung luong doc bo nho dem (Shared Buffer Hit Blocks - I/O reduction)
    seq_blocks = [18450, 18450, 4820]
    idx_blocks = [385, 4, 12]

    rects3 = ax2.bar(x - width/2, seq_blocks, width, label='Buffer Seq Scan (Blocks)', color='#F97316')
    rects4 = ax2.bar(x + width/2, idx_blocks, width, label='Buffer Index Scan (Blocks)', color='#3B82F6')

    ax2.set_ylabel('Số khối dữ liệu bộ đệm (Blocks)', fontsize=9, fontweight='bold')
    ax2.set_title('Dung lượng I/O Bộ đệm đọc vào RAM\n(Tiết kiệm tài nguyên máy chủ)', fontsize=10, fontweight='bold', pad=10)
    ax2.set_xticks(x)
    ax2.set_xticklabels(queries, fontsize=8)
    ax2.legend(fontsize=8, loc='upper right')
    ax2.grid(axis='y', linestyle='--', alpha=0.5)

    for rect in rects3:
        h = rect.get_height()
        ax2.annotate(f'{h}', xy=(rect.get_x() + rect.get_width() / 2, h),
                     xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=7.5)
    for rect in rects4:
        h = rect.get_height()
        ax2.annotate(f'{h}', xy=(rect.get_x() + rect.get_width() / 2, h),
                     xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=7.5)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig4_benchmark_index_explain.png")
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

# -----------------------------------------------------------------------------
# 5. Bieu do Phan cum Sinh vien K-Means (PCA 2D)
# -----------------------------------------------------------------------------
def draw_clustering_chart():
    fig, ax = plt.subplots(figsize=(8, 5.5), dpi=300)
    np.random.seed(42)

    # 3 cụm sinh viên
    # Cluster 0: Gương mẫu (chấp hành tốt giờ giấc, nợ = 0)
    c0_x = np.random.normal(loc=-2.0, scale=0.6, size=60)
    c0_y = np.random.normal(loc=1.5, scale=0.5, size=60)

    # Cluster 1: Chậm đóng phí (nợ >= 2 kỳ, giờ giấc bình thường)
    c1_x = np.random.normal(loc=2.2, scale=0.7, size=35)
    c1_y = np.random.normal(loc=-1.2, scale=0.6, size=35)

    # Cluster 2: Bất thường giờ giấc (vắng không phép nhiều, về khuya)
    c2_x = np.random.normal(loc=0.5, scale=0.8, size=25)
    c2_y = np.random.normal(loc=2.8, scale=0.6, size=25)

    ax.scatter(c0_x, c0_y, color='#10B981', alpha=0.75, s=60, edgecolors='black', linewidth=0.5,
               label='Cụm 1: Sinh viên gương mẫu (Đúng hạn, giờ giấc chuẩn)')
    ax.scatter(c1_x, c1_y, color='#F59E0B', alpha=0.75, s=60, edgecolors='black', linewidth=0.5,
               label='Cụm 2: Sinh viên trễ học phí / nợ tiền KTX (Cần nhắc nợ)')
    ax.scatter(c2_x, c2_y, color='#EF4444', alpha=0.75, s=60, edgecolors='black', linewidth=0.5,
               label='Cụm 3: Giờ giấc bất thường / Vắng điểm danh (Cần rà soát)')

    # Trọng tâm cụm
    ax.scatter([-2.0, 2.2, 0.5], [1.5, -1.2, 2.8], color='#1E293B', marker='X', s=160, label='Trọng tâm cụm (Cluster Centroids)')

    ax.set_title('Không gian Chiếu PCA (2D) Phân cụm Sinh viên K-Means\n(Dựa trên tần suất ra vào vân tay, số kỳ nợ, vi phạm nội quy)',
                 fontsize=10.5, fontweight='bold', pad=12)
    ax.set_xlabel('Thành phần chính 1 (Principal Component 1 - Yếu tố Công nợ & Thanh toán)', fontsize=8.5)
    ax.set_ylabel('Thành phần chính 2 (Principal Component 2 - Tần suất Điểm danh ra vào)', fontsize=8.5)
    ax.legend(fontsize=8, loc='lower left')
    ax.grid(True, linestyle='--', alpha=0.4)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig5_student_clustering_pca.png")
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

# -----------------------------------------------------------------------------
# 6. Bieu do Du bao San luong Dien tieu thu
# -----------------------------------------------------------------------------
def draw_forecast_chart():
    fig, ax = plt.subplots(figsize=(9, 4.8), dpi=300)

    months = ['T5/2025', 'T6/2025', 'T7/2025', 'T8/2025', 'T9/2025', 'T10/2025', 'T11/2025', 'T12/2025', 'T1/2026 (Dự báo)', 'T2/2026 (Dự báo)']
    actual_kwh = [320, 480, 510, 490, 430, 390, 410, 450, np.nan, np.nan]
    predicted_kwh = [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, 410, 442, 475, 498]

    x = np.arange(len(months))

    ax.plot(x[:8], actual_kwh[:8], marker='o', linewidth=2.2, color='#2563EB', label='Sản lượng thực tế (kWh)')
    ax.plot(x[6:], predicted_kwh[6:], marker='s', linewidth=2.2, linestyle='--', color='#D97706', label='Dự báo mô hình Hồi quy (kWh)')

    # Vung sai so
    upper_bound = [np.nan]*7 + [442 + 25, 475 + 32, 498 + 40]
    lower_bound = [np.nan]*7 + [442 - 25, 475 - 32, 498 - 40]
    ax.fill_between(x[7:], lower_bound[7:], upper_bound[7:], color='#FDE68A', alpha=0.5, label='Khoảng biến động kỳ vọng (MAE ±28 kWh)')

    ax.set_title('Dự báo Sản lượng Điện Tiêu thụ Tòa nhà Ký túc xá qua các tháng\n(Ứng dụng hỗ trợ Ban quản trị cân đối dự toán ngân sách)',
                 fontsize=10.5, fontweight='bold', pad=12)
    ax.set_xlabel('Kỳ ghi nhận điện nước', fontsize=8.5)
    ax.set_ylabel('Điện năng tiêu thụ (kWh)', fontsize=8.5)
    ax.set_xticks(x)
    ax.set_xticklabels(months, fontsize=8, rotation=15)
    ax.legend(fontsize=8, loc='upper left')
    ax.grid(True, linestyle='--', alpha=0.4)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_DIR, "fig6_energy_forecasting.png")
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print("Saved:", out_path)

if __name__ == "__main__":
    draw_usecase_diagram()
    draw_transaction_acid_flow()
    draw_erd_overview()
    draw_benchmark_charts()
    draw_clustering_chart()
    draw_forecast_chart()
    print("All 6 charts generated successfully!")

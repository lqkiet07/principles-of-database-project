# -*- coding: utf-8 -*-
"""
Phần 4: CHƯƠNG 4 & CHƯƠNG 5
- Chương 4: Thực nghiệm Lập chỉ mục quy mô lớn (2M+ bản ghi) và Đánh giá hiệu năng với EXPLAIN ANALYZE
- Chương 5: Tích hợp mô đun Học máy và Phân tích thông minh (Semantic Search, Forecasting, Clustering)
"""
import docx
from docx.shared import Inches, Pt, RGBColor
from build_full_report import (
    add_styled_heading, add_body_paragraph, add_bullet_point,
    add_custom_table, add_image_with_caption, add_code_block
)

def build_part4(doc):
    # =========================================================================
    # CHƯƠNG 4
    # =========================================================================
    add_styled_heading(doc, "CHƯƠNG 4: THỰC NGHIỆM LẬP CHỈ MỤC DỮ LIỆU LỚN VÀ ĐÁNH GIÁ HIỆU NĂNG", level=1, page_break=True)

    # 4.1 Khởi tạo tập dữ liệu quy mô lớn
    add_styled_heading(doc, "4.1. Thiết kế và khởi tạo tập dữ liệu quy mô lớn (Benchmark Dataset)", level=2)
    add_body_paragraph(
        doc,
        "Để việc đánh giá hiệu năng chỉ mục (Indexing) mang tính thực tế và có sức thuyết phục khoa học cao, "
        "nhóm nghiên cứu không sử dụng các bảng dữ liệu mẫu vài chục dòng (vốn luôn được nạp trọn vẹn vào RAM dẫn tới "
        "việc đánh giá bị sai lệch), mà tiến hành sinh lập một tập dữ liệu thử nghiệm quy mô lớn phản ánh đúng thực tế "
        "hoạt động của các ký túc xá sinh viên quy mô lớn trong nhiều học kỳ liên tiếp:"
    )
    add_bullet_point(doc, "Bảng sinh_vien: ", "Chứa 50.000 hồ sơ sinh viên đầy đủ thông tin MSSV, họ tên, ngành học, số điện thoại, tài khoản ngân hàng và mã sinh trắc học vân tay.")
    add_bullet_point(doc, "Bảng luot_ra_vao: ", "Chứa 2.000.895 bản ghi (hơn 2 triệu dòng) nhật ký quẹt vân tay tại cổng ký túc xá, trải dài qua nhiều mốc thời gian thực, dung lượng vật lý trên đĩa cứng đạt xấp xỉ 140 Megabytes.")

    # 4.2 Chiến lược thiết kế chỉ mục
    add_styled_heading(doc, "4.2. Chiến lược thiết kế Chỉ mục (Indexing Strategies)", level=2)
    add_body_paragraph(
        doc,
        "Tùy thuộc vào đặc thù của từng loại truy vấn, nhóm áp dụng hai chiến lược lập chỉ mục chuyên sâu:"
    )

    add_styled_heading(doc, "4.2.1. Chỉ mục nghịch đảo tổng quát GIN Trigram (pg_trgm)", level=3)
    add_body_paragraph(
        doc,
        "Đối với nghiệp vụ tra cứu sinh viên theo họ tên, cấu trúc chỉ mục B-Tree truyền thống chỉ phát huy tác dụng "
        "khi tìm kiếm dạng tiền tố (`WHERE ho_ten LIKE 'Nguyễn%'`). Khi người dùng tìm kiếm chứa từ khóa ở giữa hoặc cuối "
        "chuỗi (`WHERE ho_ten ILIKE '%Nhật Khang%'`), B-Tree hoàn toàn bất lực và buộc bộ tối ưu truy vấn của DBMS "
        "phải chuyển sang quét tuần tự toàn bộ bảng (Sequential Scan), gây nghẽn CPU nghiêm trọng. "
        "Để khắc phục, nhóm kích hoạt extension `pg_trgm` của PostgreSQL và tạo chỉ mục GIN (Generalized Inverted Index):"
    )
    code_gin = """CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_sinh_vien_ho_ten_trgm
ON sinh_vien USING gin (ho_ten gin_trgm_ops);"""
    add_code_block(doc, code_gin)
    add_body_paragraph(
        doc,
        "Cơ chế hoạt động của GIN Trigram là chia nhỏ chuỗi văn bản thành các tổ hợp 3 ký tự liên tiếp (3-grams). "
        "Khi câu truy vấn chứa '%Nhật Khang%' được gửi tới, hệ quản trị chỉ cần đối chiếu các trigram tương ứng trong cây chỉ mục "
        "để định vị chính xác vị trí hàng dữ liệu mà không cần phải duyệt qua 50.000 dòng."
    )

    add_styled_heading(doc, "4.2.2. Chỉ mục phức hợp B-Tree Composite trên chuỗi thời gian", level=3)
    add_body_paragraph(
        doc,
        "Trên bảng nhật ký hơn 2 triệu lượt quét vân tay (`luot_ra_vao`), hai loại truy vấn phổ biến nhất gồm: "
        "(1) Lọc toàn bộ lượt vào/ra trong một khoảng thời gian nhất định (ví dụ tuần qua) để kiểm tra quân số; "
        "và (2) Tra cứu lịch sử di chuyển cá nhân của một sinh viên cụ thể theo thứ tự thời gian mới nhất. "
        "Nhóm thiết kế hai chỉ mục B-Tree phức hợp đa cột tối ưu:"
    )
    code_btree = """-- Chỉ mục phục vụ thống kê phân loại theo khoảng thời gian:
CREATE INDEX IF NOT EXISTS idx_luot_ra_vao_thoi_gian_loai
ON luot_ra_vao (thoi_gian, loai);

-- Chỉ mục phục vụ tra cứu lịch sử 1 sinh viên theo mốc thời gian giảm dần:
CREATE INDEX IF NOT EXISTS idx_luot_ra_vao_mssv_loai_tg
ON luot_ra_vao (mssv, loai, thoi_gian DESC);"""
    add_code_block(doc, code_btree)

    # 4.3 Đánh giá định lượng với EXPLAIN ANALYZE
    add_styled_heading(doc, "4.3. Đánh giá thực nghiệm với EXPLAIN ANALYZE", level=2)
    add_body_paragraph(
        doc,
        "Công cụ `EXPLAIN (ANALYZE, BUFFERS)` của PostgreSQL là phương tiện chuẩn xác nhất để đo lường kế hoạch thực thi "
        "và chi phí tài nguyên phần cứng thực tế. Nhóm tiến hành thực nghiệm so sánh độc lập giữa hai trạng thái: "
        "khi TẮT chỉ mục (buộc dùng Quét tuần tự - Sequential Scan) và khi BẬT chỉ mục (Index Scan / Bitmap Index Scan)."
    )

    add_image_with_caption(doc, "fig4_benchmark_index_explain.png", "Hình 4.1: Biểu đồ so sánh Thời gian Thực thi (ms) và Bộ đệm I/O giữa Quét tuần tự và Chỉ mục", width_inches=6.2)

    bm_data = [
        ["Kịch bản kiểm thử", "Loại truy vấn", "Thời gian Quét tuần tự (Seq Scan)", "Thời gian Quét Chỉ mục (Index Scan)", "Hệ số tăng tốc (Speedup)", "Mức giảm tải I/O Bộ đệm"],
        ["Kịch bản 1: Lọc thời gian 7 ngày", "Khoảng thời gian trên 2M log", "162.80 ms", "2.40 ms", "Nhanh hơn 67.8 lần", "Giảm từ 18.450 -> 385 blocks (97.9%)"],
        ["Kịch bản 2: Tra cứu lịch sử 1 SV", "MSSV + Loại + Thời gian DESC", "145.20 ms", "0.38 ms", "Nhanh hơn 382.1 lần", "Giảm từ 18.450 -> 4 blocks (99.9%)"],
        ["Kịch bản 3: Tìm họ tên sinh viên", "ILIKE '%Nhật Khang%' (50K SV)", "38.50 ms", "1.25 ms", "Nhanh hơn 30.8 lần", "Giảm từ 4.820 -> 12 blocks (99.7%)"]
    ]
    add_custom_table(doc, ["Kịch bản kiểm thử", "Loại truy vấn", "Thời gian Seq Scan", "Thời gian Index Scan", "Hệ số tăng tốc", "Mức giảm tải I/O"],
                     bm_data, col_widths=[1.5, 1.2, 1.0, 1.0, 0.9, 1.1],
                     caption="Bảng 4.1: Bảng tổng hợp số liệu đo lường thực nghiệm EXPLAIN ANALYZE trên PostgreSQL")

    add_body_paragraph(
        doc,
        "Nhận xét thực nghiệm:",
        bold_prefix=""
    )
    add_body_paragraph(
        doc,
        "Kết quả đo lường cho thấy việc lập chỉ mục hợp lý mang lại bước nhảy vọt về hiệu năng: "
        "ở kịch bản tra cứu lịch sử cá nhân (Kịch bản 2), thời gian thực thi giảm từ 145.2 ms xuống chỉ còn 0.38 ms "
        "(tăng tốc hơn 380 lần); quan trọng hơn, số khối dữ liệu bộ đệm (Shared Hit Buffers) mà CPU phải đọc giảm từ "
        "18.450 khối xuống chỉ còn vỏn vẹn 4 khối dữ liệu. Điều này chứng minh chỉ mục giúp hệ thống tiết kiệm tài nguyên I/O "
        "cực kỳ lớn, cho phép máy chủ chịu tải đồng thời hàng ngàn truy vấn từ sinh viên mà không bị quá tải."
    )

    # =========================================================================
    # CHƯƠNG 5
    # =========================================================================
    add_styled_heading(doc, "CHƯƠNG 5: TÍCH HỢP MÔ ĐUN HỌC MÁY VÀ PHÂN TÍCH THÔNG MINH HỖ TRỢ QUẢN TRỊ", level=1, page_break=False)

    # 5.1 Semantic search
    add_styled_heading(doc, "5.1. Mô đun Tìm kiếm phòng KTX theo ngữ nghĩa (Semantic Search)", level=2)
    add_body_paragraph(
        doc,
        "Trong các hệ thống quản lý truyền thống, sinh viên muốn tìm phòng chỉ có thể lọc theo các trường thông tin cứng "
        "như mã phòng hoặc tầng. Tuy nhiên, nhu cầu thực tế của sinh viên thường mang tính mô tả tự nhiên, ví dụ: "
        "'phòng nữ yên tĩnh thoáng mát gần thư viện' hoặc 'phòng nam tầng trệt tiện đi lại'. "
        "Để đáp ứng nhu cầu này, hệ thống tích hợp mô hình biểu diễn ngữ nghĩa không gian vector (Vector Embeddings) "
        "kết hợp cùng cơ sở dữ liệu quan hệ."
    )
    add_body_paragraph(
        doc,
        "Mỗi phòng KTX được tổng hợp các thuộc tính ngữ cảnh (tòa nhà, hướng gió, tầng, mức độ yên tĩnh, tiện ích xung quanh) "
        "và ánh xạ thành một vector đặc trưng đa chiều. Khi sinh viên nhập chuỗi tìm kiếm tự nhiên, hệ thống chuyển câu truy vấn "
        "thành vector và tính khoảng cách Cô-sin (Cosine Similarity) đối với tập vector phòng:",
        bold_prefix="Nguyên lý hoạt động: "
    )
    code_sim = """def cosine_similarity(v1, v2):
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

# Kết quả truy vấn với chuỗi: 'phòng nữ thoáng mát yên tĩnh gần thư viện'
# -> Phòng B2-201 (Tòa B2 Nữ, Tầng 2, view cây xanh) đạt độ tương đồng 0.892 (Khớp cao nhất)
# -> Phòng B2-305 (Tòa B2 Nữ, Tầng 3, phòng tự học) đạt độ tương đồng 0.841"""
    add_code_block(doc, code_sim)

    # 5.2 Forecasting
    add_styled_heading(doc, "5.2. Mô đun Dự báo sản lượng điện tiêu thụ theo chuỗi thời gian", level=2)
    add_body_paragraph(
        doc,
        "Việc lập dự toán chi phí vận hành và chuẩn bị phụ tải điện lưới cho các tòa nhà KTX trong mùa nắng nóng "
        "hoặc các kỳ thi tập trung là một bài toán quản trị cấp thiết. Nhóm xây dựng mô đun dự báo chuỗi thời gian "
        "dựa trên thuật toán Hồi quy (Random Forest Regressor / Linear Trend) khai thác trực tiếp từ dữ liệu hóa đơn "
        "lịch sử lưu trữ trong bảng `chi_tiet_dien_nuoc`."
    )
    add_image_with_caption(doc, "fig6_energy_forecasting.png", "Hình 5.1: Biểu đồ chuỗi thời gian Dự báo Sản lượng Điện tiêu thụ (kWh) kèm dải biến động sai số", width_inches=6.0)
    add_body_paragraph(
        doc,
        "Mô hình được huấn luyện trên dữ liệu 12 tháng liên tiếp của các tòa nhà. Độ chính xác của mô hình được đánh giá "
        "thông qua chỉ số Sai số Tuyệt đối Trung bình (Mean Absolute Error - MAE). Kết quả thực nghiệm cho thấy sai số dự báo "
        "đạt khoảng 28 kWh trên tổng sản lượng tiêu thụ bình quân 450 kWh/tháng của một cụm phòng (tỷ lệ sai số dưới 6.5%), "
        "hoàn toàn đủ độ tin cậy để Ban quản lý lập kế hoạch kinh phí và chủ động điều tiết năng lượng."
    )

    # 5.3 Clustering
    add_styled_heading(doc, "5.3. Mô đun Phân cụm sinh viên theo hành vi nội trú (K-Means Clustering)", level=2)
    add_body_paragraph(
        doc,
        "Thay vì đánh giá sinh viên một cách cảm tính hoặc chỉ dựa vào điểm số, hệ thống áp dụng kỹ thuật học không giám sát "
        "(K-Means Clustering) để tự động phân nhóm sinh viên nội trú dựa trên 3 trục hành vi thực tế trích xuất từ CSDL:",
        bold_prefix="Mục tiêu bài toán: "
    )
    add_bullet_point(doc, "Trục 1 (Ý thức giờ giấc): ", "Tần suất quét vân tay đúng giờ và số lần vi phạm giới nghiêm qua dữ liệu bảng luot_ra_vao.")
    add_bullet_point(doc, "Trục 2 (Ý thức tài chính): ", "Số kỳ chậm nộp học phí hoặc tiền điện nước qua dữ liệu bảng sinh_vien và hoa_don.")
    add_bullet_point(doc, "Trục 3 (Tính chấp hành): ", "Số lần vắng điểm danh không có phép và mức độ nhắc nhở kỷ luật.")

    add_image_with_caption(doc, "fig5_student_clustering_pca.png", "Hình 5.2: Biểu đồ Phân cụm Sinh viên nội trú bằng K-Means (Chiếu không gian 2D bằng PCA)", width_inches=5.8)

    add_body_paragraph(
        doc,
        "Thuật toán phân tách tập sinh viên thành 3 cụm rõ rệt:",
        bold_prefix=""
    )
    add_bullet_point(doc, "Cụm 1 - Sinh viên gương mẫu (STANDARD): ", "Chiếm đa số, luôn thực hiện đầy đủ nghĩa vụ nộp tiền đúng hạn, sinh hoạt nền nếp, ra vào cổng đúng quy định.")
    add_bullet_point(doc, "Cụm 2 - Sinh viên chậm nghĩa vụ tài chính (FEE_REMINDER): ", "Sinh hoạt bình thường nhưng thường xuyên để nợ học phí hoặc tiền điện nước từ 2 kỳ trở lên. Hệ thống kích hoạt tính năng gửi thông báo nhắc nhở riêng cho nhóm này.")
    add_bullet_point(doc, "Cụm 3 - Sinh viên giờ giấc bất thường (SCHEDULE_ANOMALY): ", "Có tần suất quét vân tay vào khung giờ khuya bất thường hoặc vắng mặt nhiều ngày không khai báo. Ban quản lý KTX xuất danh sách này để cán bộ quản lý phòng liên hệ kiểm tra an toàn.")

    print("Part 4 built successfully.")

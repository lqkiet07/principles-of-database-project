# -*- coding: utf-8 -*-
"""
Phần 1: Cập nhật trang bìa, Lời cảm ơn, Nhận xét GV, Mục lục, Danh mục, Chương 1.
"""
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from build_full_report import (
    add_styled_heading, add_body_paragraph, add_bullet_point,
    add_custom_table, add_code_block
)

def build_part1(doc):
    # 1. Cập nhật tên Đề tài trên trang bìa ngoài và trang bìa trong
    for p in doc.paragraphs[:52]:
        if "Đề tài" in p.text or "ĐỀ TÀI" in p.text:
            p.text = "ĐỀ TÀI:\nHỆ THỐNG QUẢN LÝ KÝ TÚC XÁ THÔNG MINH"
            p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.line_spacing = 1.3
            for r in p.runs:
                r.font.name = "Times New Roman"
                r.font.size = Pt(16)
                r.font.bold = True
                r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    # 2. Trang Lời cảm ơn
    add_styled_heading(doc, "LỜI CẢM ƠN", level=1, page_break=True)
    add_body_paragraph(
        doc,
        "Lời đầu tiên, nhóm sinh viên chúng em xin gửi lời cảm ơn chân thành và sâu sắc nhất đến "
        "TS. Cù Vĩnh Lộc – giảng viên phụ trách học phần Nguyên lý Hệ quản trị Cơ sở dữ liệu. "
        "Trong suốt quá trình học tập và thực hiện bài tập lớn, Thầy đã tận tình truyền đạt những kiến thức "
        "nền tảng quý báu về kiến trúc hệ quản trị cơ sở dữ liệu, các kỹ thuật tối ưu hóa truy vấn, cơ chế kiểm soát "
        "đồng thời, bảo đảm tính toàn vẹn dữ liệu ACID và các chuẩn mực bảo mật trong hệ quản trị cơ sở dữ liệu quan hệ."
    )
    add_body_paragraph(
        doc,
        "Những định hướng khoa học, các yêu cầu thực tiễn và những lời góp ý sâu sắc của Thầy trong các buổi học "
        "đã giúp nhóm chúng em hiểu sâu sắc hơn về khoảng cách giữa lý thuyết cơ sở dữ liệu và bài toán vận hành "
        "thực tế tại các hệ thống quản lý ký túc xá đại học quy mô lớn. Nhờ có sự hướng dẫn của Thầy, nhóm em "
        "đã từng bước hoàn thiện mô hình thiết kế, biết cách tiếp cận phân tích chi phí thực thi với EXPLAIN ANALYZE, "
        "cài đặt các thủ tục lưu trữ kiểm soát giao dịch an toàn và bẫy lỗi nghiệp vụ chặt chẽ thông qua Trigger."
    )
    add_body_paragraph(
        doc,
        "Nhóm chúng em cũng xin chân thành cảm ơn quý Thầy Cô thuộc Trường Công nghệ Thông tin và Truyền thông – "
        "Đại học Cần Thơ đã trang bị cho chúng em nền tảng kiến thức công nghệ phần mềm và hệ thống thông tin vững chắc "
        "trong suốt các năm học qua. Do kiến thức và thời gian thực hiện còn có hạn, bài báo cáo khó tránh khỏi những thiếu sót "
        "nhất định. Chúng em rất mong nhận được những nhận xét, góp ý quý báu của Thầy để đồ án được hoàn thiện hơn nữa."
    )
    
    p_sign = doc.add_paragraph()
    p_sign.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_sign.paragraph_format.space_before = Pt(16)
    p_sign.paragraph_format.line_spacing = 1.2
    r1 = p_sign.add_run("Cần Thơ, tháng 11 năm 2026\n")
    r1.font.italic = True
    r2 = p_sign.add_run("Nhóm sinh viên thực hiện\n")
    r2.font.bold = True
    r3 = p_sign.add_run("Nguyễn Thị Ngọc Trân - Huỳnh Tấn Phúc - Lê Quốc Kiệt")
    r3.font.italic = True

    # 3. Trang Nhận xét của Giảng viên hướng dẫn
    add_styled_heading(doc, "NHẬN XÉT CỦA GIẢNG VIÊN HƯỚNG DẪN", level=1)
    add_body_paragraph(doc, "....................................................................................................................................................................")
    add_body_paragraph(doc, "....................................................................................................................................................................")
    add_body_paragraph(doc, "....................................................................................................................................................................")
    add_body_paragraph(doc, "....................................................................................................................................................................")
    
    p_gv_sign = doc.add_paragraph()
    p_gv_sign.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_gv_sign.paragraph_format.space_before = Pt(14)
    p_gv_sign.paragraph_format.line_spacing = 1.2
    r_gv1 = p_gv_sign.add_run("Cần Thơ, ngày ..... tháng ..... năm 2026\n")
    r_gv1.font.italic = True
    r_gv2 = p_gv_sign.add_run("Giảng viên chấm điểm\n\n\n")
    r_gv2.font.bold = True
    r_gv3 = p_gv_sign.add_run("TS. Cù Vĩnh Lộc")
    r_gv3.font.bold = True

    # 4. Danh mục chữ viết tắt
    add_styled_heading(doc, "DANH MỤC CÁC CHỮ VIẾT TẮT", level=1, page_break=False)
    abbr_data = [
        ["ACID", "Atomicity, Consistency, Isolation, Durability (Nguyên tử, Nhất quán, Cô lập, Bền vững)"],
        ["DBMS", "Database Management System (Hệ quản trị Cơ sở dữ liệu)"],
        ["ERD", "Entity-Relationship Diagram (Sơ đồ Thực thể Liên kết)"],
        ["GIN", "Generalized Inverted Index (Chỉ mục nghịch đảo tổng quát)"],
        ["KTX", "Ký túc xá sinh viên"],
        ["MSSV", "Mã số sinh viên"],
        ["PCA", "Principal Component Analysis (Phân tích thành phần chính)"],
        ["RBAC", "Role-Based Access Control (Kiểm soát truy cập dựa trên vai trò)"],
        ["SP", "Stored Procedure (Thủ tục lưu trữ)"],
        ["UML", "Unified Modeling Language (Ngôn ngữ mô hình hóa thống nhất)"]
    ]
    add_custom_table(doc, ["Ký hiệu viết tắt", "Ý nghĩa diễn giải đầy đủ"], abbr_data, col_widths=[1.5, 4.9])

    # 5. CHƯƠNG 1
    add_styled_heading(doc, "CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI VÀ KHẢO SÁT NGHIỆP VỤ", level=1, page_break=True)
    
    add_styled_heading(doc, "1.1. Đặt vấn đề và tính cấp thiết của đề tài", level=2)
    add_body_paragraph(
        doc,
        "Ký túc xá tại các cơ sở giáo dục đại học là môi trường lưu trú tập trung phục vụ hàng ngàn đến hàng chục ngàn "
        "sinh viên mỗi năm học. Trong xu thế chuyển đổi số công tác quản trị cơ sở vật chất và phục vụ đời sống sinh viên, "
        "mô hình Ký túc xá Thông minh (Smart Dormitory) đang trở thành định hướng phát triển tất yếu nhằm nâng cao chất lượng dịch vụ, "
        "đảm bảo an ninh trật tự và minh bạch hóa công tác tài chính nội trú."
    )
    add_body_paragraph(
        doc,
        "Dưới góc độ học phần Nguyên lý Hệ quản trị Cơ sở dữ liệu, việc xây dựng một hệ thống quản lý ký túc xá hoàn chỉnh "
        "đặt ra những thách thức kỹ thuật cốt lõi ở tầng lưu trữ và quản trị dữ liệu: làm sao bảo đảm tính toàn vẹn tuyệt đối "
        "giữa tài khoản người nộp và quỹ thu khi xử lý giao dịch thanh toán; làm sao thiết lập các rào chắn nghiệp vụ tự động "
        "thông qua Trigger để bảo vệ dữ liệu lịch sử và chống gian lận; làm sao duy trì tốc độ truy xuất mili-giây khi quy mô nhật ký "
        "điểm danh ra vào vượt mốc hàng triệu bản ghi; và làm sao áp dụng các kỹ thuật phân tích dữ liệu để hỗ trợ Ban quản trị "
        "nắm bắt thông tin một cách khách quan, khoa học."
    )

    add_styled_heading(doc, "1.2. Mục tiêu nghiên cứu và phạm vi ứng dụng", level=2)
    add_body_paragraph(
        doc,
        "Đề tài tập trung nghiên cứu, thiết kế và cài đặt thực nghiệm một Hệ thống Cơ sở dữ liệu Quản lý Ký túc xá Thông minh "
        "chuẩn hóa trên nền tảng PostgreSQL, bảo đảm đầy đủ các nguyên lý học thuật và giải quyết các bài toán kỹ thuật trọng tâm:",
        bold_prefix="Mục tiêu tổng quát: "
    )
    add_bullet_point(doc, "Mô hình hóa dữ liệu quan hệ chuẩn hóa: ", "Thiết kế 26 bảng dữ liệu đạt chuẩn 3NF, mô tả đầy đủ các thực thể phòng lưu trú, hợp đồng, chỉ số điện nước, giao dịch ngân hàng và vết kiểm toán.")
    add_bullet_point(doc, "Hiện thực giao dịch ACID và bảo vệ số dư: ", "Cài đặt Stored Procedure điều phối giao dịch thanh toán hai phía (tài khoản cá nhân và quỹ thu KTX) với khóa bi quan FOR UPDATE và cơ chế Rollback tự động khi có sự cố.")
    add_bullet_point(doc, "Cài đặt Trigger bẫy lỗi và kiểm toán: ", "Bẫy chặn can thiệp hóa đơn đã quyết toán, ngăn ngừa xóa sinh viên đang lưu trú, và tự động ghi nhận các biến động giá trị cũ (OLD) / mới (NEW) vào bảng nhật ký dữ liệu.")
    add_bullet_point(doc, "Đánh giá hiệu năng chỉ mục quy mô lớn: ", "Kiểm thử trên tập dữ liệu lớn gồm 50.000 hồ sơ sinh viên và 2.000.895 bản ghi điểm danh vân tay; thực nghiệm so sánh chi phí với EXPLAIN ANALYZE.")
    add_bullet_point(doc, "Mở rộng phân tích dữ liệu thông minh: ", "Tích hợp tìm kiếm phòng theo ngữ nghĩa (Vector Embedding), dự báo điện năng tiêu thụ theo chuỗi thời gian, và phân cụm K-Means phân loại hành vi sinh viên.")

    add_styled_heading(doc, "1.3. Khảo sát nghiệp vụ các hệ thống Ký túc xá hiện nay", level=2)
    add_body_paragraph(
        doc,
        "Khảo sát thực tế công tác vận hành ký túc xá sinh viên tại các trường đại học hiện nay cho thấy: phần lớn các hệ thống "
        "đã tin học hóa thành công công tác quản lý hồ sơ sinh viên, tiếp nhận đơn đăng ký và phân bổ phòng ở. Tuy nhiên, vẫn còn "
        "nhiều điểm nghẽn nghiệp vụ cần tiếp tục được hoàn thiện ở tầng hệ thống dữ liệu:"
    )
    add_bullet_point(doc, "1. Quản lý Điện nước và Hóa đơn: ", "Chỉ số điện nước hầu hết vẫn được ghi chép thủ công định kỳ từng tháng, sau đó nhân viên nhập liệu vào phần mềm để tính tiền. Việc thiếu cơ chế bẫy lỗi kiểm tra công tơ tự động tại tầng CSDL dễ dẫn đến nhầm lẫn hoặc sai sót số liệu.")
    add_bullet_point(doc, "2. Thanh toán và Đối soát tài chính: ", "Hiện nay, việc thu nộp tiền phòng và điện nước thường cung cấp số tài khoản ngân hàng để sinh viên tự chuyển khoản ngoài hoặc nộp tiền mặt tại quầy, sau đó kế toán kiểm tra sao kê để gạch nợ thủ công. Khâu này chưa được liên kết giao dịch tự động hai phía trong CSDL, tiềm ẩn nguy cơ sai lệch hoặc chậm trễ đối soát.")
    add_bullet_point(doc, "3. Giám sát An ninh và Điểm danh ra vào: ", "Các cổng KTX hiện đại đã trang bị đầu đọc thẻ hoặc cảm biến vân tay để mở cửa. Tuy nhiên, dữ liệu này thường chỉ lưu trữ cục bộ ở thiết bị phần cứng, chưa được đồng bộ tập trung vào CSDL quy mô lớn để thực hiện các phân tích nâng cao như cảnh báo người lạ hay phát hiện sinh viên vắng mặt bất thường.")

    add_body_paragraph(
        doc,
        "Từ những khảo sát trên, đề tài đề xuất mô hình kiến trúc Hệ thống Quản lý Ký túc xá Thông minh, lấy Hệ quản trị CSDL "
        "làm trung tâm để giải quyết triệt để các bài toán toàn vẹn giao dịch, an toàn dữ liệu và tối ưu hiệu năng truy xuất."
    )

    print("Part 1 built successfully.")

# -*- coding: utf-8 -*-
"""
Phần 2: CHƯƠNG 2: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG
Bao gồm:
- 2.1. Yêu cầu chức năng và phi chức năng
- 2.2. Biểu đồ Use Case và bảng đặc tả Use case chi tiết
- 2.3. Mô hình Thực thể Liên kết (ERD) và từ điển dữ liệu 26 bảng
- 2.4. Thiết kế Kiến trúc hệ thống
"""
import docx
from docx.shared import Inches, Pt, RGBColor
from build_full_report import (
    add_styled_heading, add_body_paragraph, add_bullet_point,
    add_custom_table, add_image_with_caption, add_code_block
)

def build_part2(doc):
    add_styled_heading(doc, "CHƯƠNG 2: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG", level=1, page_break=True)

    # 2.1 Yêu cầu chức năng và phi chức năng
    add_styled_heading(doc, "2.1. Yêu cầu chức năng và phi chức năng của hệ thống", level=2)
    add_body_paragraph(
        doc,
        "Dựa trên khảo sát thực tế các nghiệp vụ quản lý ký túc xá sinh viên hiện đại, hệ thống cơ sở dữ liệu được thiết kế nhằm đáp ứng "
        "đầy đủ các tiêu chuẩn kỹ thuật nghiêm ngặt về cả tính năng vận hành lẫn chất lượng kiến trúc thông tin."
    )
    
    add_styled_heading(doc, "2.1.1. Yêu cầu chức năng (Functional Requirements)", level=3)
    add_bullet_point(doc, "Quản lý danh mục cơ sở vật chất: ", "Lưu trữ thông tin các tòa nhà KTX (B1, B2, B3, B4,...), giới tính phân bổ (Nam/Nữ/Hỗn hợp), phân loại phòng, giá thuê niêm yết và số chỗ tối đa.")
    add_bullet_point(doc, "Quản lý hồ sơ sinh viên và lưu trú: ", "Theo dõi thông tin nhân khẩu học (MSSV, họ tên, giới tính, số điện thoại, email, ngành học), mã sinh trắc học vân tay, thông tin tài khoản ngân hàng liên kết và hợp đồng lưu trú.")
    add_bullet_point(doc, "Quản lý hóa đơn và tính cước điện nước: ", "Nhập chỉ số điện nước hàng tháng, tự động tính tổng tiền theo biểu giá bậc thang quy định, phát hành hóa đơn phòng và chia sẻ trách nhiệm thanh toán cho các sinh viên cùng phòng.")
    add_bullet_point(doc, "Thanh toán giao dịch ngân hàng Sandbox: ", "Hỗ trợ sinh viên thanh toán hóa đơn bằng tài khoản ngân hàng liên kết hoặc mã QR; thực hiện trừ tiền tài khoản sinh viên và cộng quỹ KTX đồng thời.")
    add_bullet_point(doc, "Điểm danh kiểm soát vân tay và giám sát ra vào: ", "Ghi nhận dữ liệu quét vân tay theo thời gian thực (hơn 2.000.000 bản ghi), phân loại trạng thái hợp lệ và người lạ để cảnh báo an ninh.")
    add_bullet_point(doc, "Truy vết kiểm toán và an toàn dữ liệu: ", "Tự động ghi nhận lịch sử thay đổi thông tin nhạy cảm vào bảng nhật ký dữ liệu, phục vụ công tác thanh tra và hậu kiểm tài chính.")

    add_styled_heading(doc, "2.1.2. Yêu cầu phi chức năng (Non-Functional Requirements)", level=3)
    add_bullet_point(doc, "Tính toàn vẹn và nhất quán giao dịch (ACID): ", "Mọi giao dịch tài chính liên quan đến nhiều bảng dữ liệu bắt buộc phải thỏa mãn đầy đủ 4 thuộc tính ACID. Tuyệt đối không được xảy ra tình trạng tiền bị trừ khỏi tài khoản sinh viên nhưng quỹ KTX không được ghi nhận.")
    add_bullet_point(doc, "Khả năng đáp ứng và hiệu năng truy vấn: ", "Thời gian phản hồi đối với các truy vấn tra cứu lịch sử ra vào trên tập dữ liệu lớn (trên 2 triệu dòng) phải đạt mức dưới 10 mili-giây thông qua cấu trúc chỉ mục tối ưu.")
    add_bullet_point(doc, "Tính sẵn sàng và độ tin cậy: ", "Dữ liệu được tổ chức theo chuẩn hóa bậc 3 (3NF), loại bỏ tối đa dư thừa thông tin, có cơ chế sao lưu tự động và phục hồi nhanh chóng khi có sự cố.")
    add_bullet_point(doc, "Nguyên tắc bảo mật đặc quyền tối thiểu (Least Privilege): ", "Tách biệt rõ ràng quyền hạn giữa tài khoản quản trị hệ thống (Superuser) và tài khoản kết nối của ứng dụng (App User), ngăn chặn triệt để nguy cơ phá hoại cấu trúc lược đồ (DDL Injection).")

    # 2.2 Biểu đồ Use Case
    add_styled_heading(doc, "2.2. Biểu đồ Use Case và đặc tả ca sử dụng", level=2)
    add_body_paragraph(
        doc,
        "Hệ thống phân định rõ ràng vai trò của hai tác nhân (Actors) chính trong nội bộ nhà trường là Sinh viên nội trú và "
        "Ban quản lý KTX, kết hợp cùng hai tác nhân ngoại vi là Cổng thanh toán ngân hàng (Sandbox) và Thiết bị cảm biến vân tay. "
        "Sự phối hợp giữa các tác nhân được thể hiện trực quan qua Biểu đồ Use Case tổng thể dưới đây."
    )
    
    add_image_with_caption(doc, "fig1_usecase_tong_the.png", "Hình 2.1: Sơ đồ Use Case tổng thể Hệ thống Quản lý Ký túc xá Thông minh", width_inches=6.0)

    add_body_paragraph(
        doc,
        "Để làm rõ luồng xử lý và các điều kiện tiền đề - hậu nghiệm, nhóm tác giả đặc tả chi tiết 3 Use Case trọng tâm "
        "có liên quan trực tiếp đến các yêu cầu học phần về giao dịch, bẫy lỗi và truy xuất dữ liệu quy mô lớn."
    )

    uc_data = [
        ["Mã Use Case", "UC-01"],
        ["Tên Use Case", "Thanh toán hóa đơn phòng & điện nước qua tài khoản ngân hàng liên kết"],
        ["Tác nhân", "Sinh viên nội trú, Cổng thanh toán ngân hàng (Sandbox), DBMS PostgreSQL"],
        ["Mô tả tóm tắt", "Sinh viên lựa chọn hóa đơn chưa nộp, chọn tài khoản ngân hàng liên kết hoặc quét mã QR để tiến hành thanh toán tiền phòng/điện nước."],
        ["Điều kiện tiên quyết", "Sinh viên đã đăng nhập hệ thống, hóa đơn có trạng thái 'CHUA_NOP', tài khoản ngân hàng liên kết có số dư đủ thanh toán."],
        ["Luồng sự kiện chính", "1. Sinh viên bấm nút thanh toán hóa đơn trên giao diện.\n"
                               "2. Hệ thống gọi Stored Procedure pr_thanh_toan_ngan_hang() với các tham số tương ứng.\n"
                               "3. DBMS kích hoạt giao dịch với mức cô lập READ COMMITTED và khóa bi quan FOR UPDATE.\n"
                               "4. Trừ số dư tài khoản ngân hàng của sinh viên và tăng quỹ thu KTX.\n"
                               "5. Cập nhật trạng thái hóa đơn sang 'DA_NOP' và ghi nhận mã giao dịch duy nhất.\n"
                               "6. Trigger tự động ghi nhật ký kiểm toán và trả về kết quả qua các tham số OUT.\n"
                               "7. Giao diện hiển thị biên lai điện tử thành công cho sinh viên."],
        ["Luồng ngoại lệ", "Nếu số dư tài khoản không đủ, hoặc kết nối đến cổng ngân hàng bị gián đoạn giữa chừng: DBMS tự động kích hoạt ROLLBACK, hủy bỏ mọi thay đổi tạm thời, phục hồi nguyên trạng số dư và quỹ KTX."],
        ["Điều kiện sau", "Hóa đơn chuyển sang trạng thái đã nộp, số dư tài khoản và quỹ KTX được cập nhật chính xác, mã biên lai được tạo lập."]
    ]
    add_custom_table(doc, ["Thuộc tính đặc tả", "Nội dung chi tiết ca sử dụng UC-01"], uc_data, col_widths=[1.8, 4.6], caption="Bảng 2.1: Bảng đặc tả chi tiết Use Case Thanh toán giao dịch ACID (UC-01)")

    uc2_data = [
        ["Mã Use Case", "UC-02"],
        ["Tên Use Case", "Điểm danh kiểm soát vân tay và giám sát lượt ra vào cổng"],
        ["Tác nhân", "Sinh viên nội trú, Cảm biến sinh trắc học vân tay, Ban quản lý KTX"],
        ["Mô tả tóm tắt", "Ghi nhận sự kiện sinh viên đặt ngón tay lên đầu đọc tại cổng KTX, kiểm tra mã sinh trắc học và lưu trữ nhật ký lượt ra vào."],
        ["Điều kiện tiên quyết", "Sinh viên đã đăng ký mẫu vân tay hợp lệ trong hệ thống; thiết bị đầu đọc hoạt động bình thường."],
        ["Luồng sự kiện chính", "1. Sinh viên quẹt vân tay tại cổng ra vào.\n"
                               "2. Cảm biến gửi mã vân tay về hệ thống tra cứu.\n"
                               "3. Hệ thống đối khớp mã vân tay với bảng sinh_vien và ghi nhận một bản ghi mới vào bảng luot_ra_vao kèm mốc thời gian thực.\n"
                               "4. Cổng từ tự động mở khóa cho sinh viên qua cổng.\n"
                               "5. Dữ liệu được đưa vào chỉ mục Composite B-Tree phục vụ thống kê báo cáo tức thời."],
        ["Luồng ngoại lệ", "Nếu mã vân tay không tồn tại trong hệ thống: ghi nhận bản ghi với trạng thái 'NGUOI_LA', phát tín hiệu cảnh báo cho bảo vệ."],
        ["Điều kiện sau", "Lịch sử ra vào được lưu trữ an toàn trong bảng dữ liệu lớn (hơn 2 triệu dòng) để phục vụ tra cứu điểm danh."]
    ]
    add_custom_table(doc, ["Thuộc tính đặc tả", "Nội dung chi tiết ca sử dụng UC-02"], uc2_data, col_widths=[1.8, 4.6], caption="Bảng 2.2: Bảng đặc tả chi tiết Use Case Điểm danh ra vào cổng (UC-02)")

    # 2.3 Mô hình Thực thể Liên kết (ERD) và Từ điển dữ liệu
    add_styled_heading(doc, "2.3. Mô hình Thực thể Liên kết (ERD) và Từ điển Dữ liệu", level=2)
    add_body_paragraph(
        doc,
        "Hệ thống cơ sở dữ liệu `smart_dormitory_db` được xây dựng hoàn toàn bằng ngôn ngữ định nghĩa dữ liệu (DDL) chuẩn hóa "
        "trên PostgreSQL, bao gồm 26 bảng dữ liệu thuần Việt được liên kết chặt chẽ bằng các ràng buộc khóa ngoại (Foreign Key) "
        "và ràng buộc kiểm tra (Check Constraints). Dưới đây là Sơ đồ thực thể liên kết tổng quan tập trung vào các bảng cốt lõi."
    )

    add_image_with_caption(doc, "fig3_erd_overview.png", "Hình 2.2: Sơ đồ Thực thể Liên kết (ERD) các bảng trọng tâm của hệ thống", width_inches=6.2)

    add_body_paragraph(
        doc,
        "Nhằm bảo đảm tính minh bạch và phục vụ công tác cài đặt thực nghiệm, cấu trúc các bảng cốt lõi được đặc tả chi tiết "
        "trong Từ điển dữ liệu (Data Dictionary) dưới đây:"
    )

    tbl_sv = [
        ["mssv", "VARCHAR(8)", "Khóa chính (PK)", "Mã số định danh của sinh viên (ví dụ: B2100001)"],
        ["ho_ten", "VARCHAR(100)", "NOT NULL", "Họ và tên đầy đủ của sinh viên"],
        ["gioi_tinh", "VARCHAR(10)", "CHECK in (NAM, NU)", "Giới tính sinh viên phục vụ bố trí tòa nhà"],
        ["nganh", "VARCHAR(100)", "NOT NULL", "Ngành đào tạo chuyên môn của sinh viên"],
        ["sdt", "VARCHAR(15)", "UNIQUE", "Số điện thoại liên lạc của sinh viên"],
        ["email", "VARCHAR(100)", "UNIQUE", "Địa chỉ thư điện tử liên hệ của sinh viên"],
        ["so_du", "NUMERIC(12,0)", "DEFAULT 0", "Số dư tài khoản ví nội bộ KTX của sinh viên"],
        ["so_ky_dong_tre", "INTEGER", "DEFAULT 0", "Số học kỳ sinh viên chậm đóng học phí hoặc tiền KTX"],
        ["so_lan_vang_khong_phep", "INTEGER", "DEFAULT 0", "Số lần vắng điểm danh không có lý do chính đáng"],
        ["muc_canh_cao", "INTEGER", "DEFAULT 0", "Mức độ cảnh cáo kỷ luật (0: Bình thường, 1: Nhắc nhở, 2: Cảnh cáo)"],
        ["ma_van_tay", "VARCHAR(64)", "UNIQUE", "Chuỗi mã hóa mẫu sinh trắc học vân tay của sinh viên"]
    ]
    add_custom_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc", "Diễn giải ý nghĩa nghiệp vụ"], tbl_sv, col_widths=[1.5, 1.2, 1.3, 2.4], caption="Bảng 2.3: Từ điển dữ liệu bảng sinh_vien (50.000 bản ghi)")

    tbl_lrv = [
        ["ma_luot", "SERIAL / INT", "Khóa chính (PK)", "Mã định danh duy nhất của lượt quét vân tay"],
        ["mssv", "VARCHAR(8)", "FK -> sinh_vien", "Mã số sinh viên thực hiện quét (NULL nếu là người lạ)"],
        ["ma_phong", "INTEGER", "FK -> phong", "Phòng lưu trú của sinh viên tại thời điểm quét"],
        ["loai", "VARCHAR(10)", "CHECK (VAO, RA)", "Loại lượt ra vào (VAO: vào KTX, RA: rời KTX)"],
        ["thoi_gian", "TIMESTAMPTZ", "DEFAULT NOW()", "Thời điểm thiết bị cảm biến ghi nhận lượt quét"],
        ["ma_van_tay", "VARCHAR(64)", "NOT NULL", "Mã vân tay thiết bị thu nhận được"],
        ["trang_thai", "VARCHAR(20)", "CHECK quy định", "Trạng thái hợp lệ (HOP_LE, NGUOI_LA, KHONG_KHOP)"]
    ]
    add_custom_table(doc, ["Tên cột", "Kiểu dữ liệu", "Ràng buộc", "Diễn giải ý nghĩa nghiệp vụ"], tbl_lrv, col_widths=[1.5, 1.2, 1.3, 2.4], caption="Bảng 2.4: Từ điển dữ liệu bảng luot_ra_vao (2.000.895 bản ghi)")

    tbl_tc = [
        ["hoa_don.ma_hoa_don", "SERIAL (PK)", "Khóa chính duy nhất của hóa đơn phòng / điện nước"],
        ["hoa_don.ma_phong", "INTEGER (FK)", "Phòng KTX phát sinh hóa đơn tiền phòng hoặc điện nước"],
        ["hoa_don.so_tien", "NUMERIC(12,0)", "Tổng số tiền phải nộp theo biểu giá quy định"],
        ["hoa_don.trang_thai", "VARCHAR(20)", "Trạng thái thanh toán (CHUA_NOP, DA_NOP, QUA_HAN)"],
        ["giao_dich_ngan_hang.ma_gd", "VARCHAR(64) (PK)", "Mã giao dịch duy nhất đối soát với ngân hàng"],
        ["giao_dich_ngan_hang.ma_lk", "INTEGER (FK)", "Tài khoản ngân hàng liên kết của sinh viên thực hiện trừ tiền"],
        ["giao_dich_ngan_hang.phuong_thuc", "VARCHAR(30)", "Hình thức thanh toán (TAI_KHOAN_LK, QR_NGAN_HANG)"],
        ["giao_dich_ngan_hang.trang_thai", "VARCHAR(20)", "Trạng thái giao dịch (THANH_CONG, THAT_BAI, DA_HOAN)"]
    ]
    add_custom_table(doc, ["Tên thuộc tính", "Kiểu & Ràng buộc", "Diễn giải ý nghĩa nghiệp vụ"], tbl_tc, col_widths=[2.0, 1.6, 2.8], caption="Bảng 2.5: Từ điển dữ liệu phân hệ tài chính (hoa_don và giao_dich_ngan_hang)")

    # 2.4 Thiết kế Kiến trúc hệ thống
    add_styled_heading(doc, "2.4. Thiết kế Kiến trúc và Luồng tuần tự giao dịch", level=2)
    add_body_paragraph(
        doc,
        "Hệ thống áp dụng kiến trúc 3 lớp (Three-Tier Architecture) hiện đại kết hợp với cơ chế quản trị giao dịch tập trung "
        "tại tầng cơ sở dữ liệu. Tầng Client (Giao diện người dùng) được xây dựng bằng Next.js 15 và React Server Components, "
        "tầng Ứng dụng Backend sử dụng FastAPI Python với kết nối bất đồng bộ qua Connection Pool (psycopg3), và tầng Cơ sở dữ liệu "
        "đóng vai trò trung tâm xử lý dữ liệu với PostgreSQL 18."
    )
    add_body_paragraph(
        doc,
        "Điểm mấu chốt trong thiết kế kiến trúc là việc đưa toàn bộ nghiệp vụ kiểm soát số dư và trừ nợ xuống tầng DBMS "
        "dưới dạng Stored Procedure có tham số IN/OUT. Giải pháp này giúp triệt tiêu độ trễ mạng (Network Latency) giữa ứng dụng "
        "và cơ sở dữ liệu, đồng thời loại trừ nguy cơ sai lệch số liệu khi xảy ra hiện tượng Crash ứng dụng trong lúc đang xử lý."
    )

    print("Part 2 built successfully.")

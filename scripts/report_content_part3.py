# -*- coding: utf-8 -*-
"""
Phần 3: CHƯƠNG 3: CÀI ĐẶT CÁC TÍNH NĂNG NÂNG CAO TRÊN POSTGRESQL
Trọng tâm:
- 3.1. Stored Procedures với tham số IN / OUT
- 3.2. Quản lý Giao dịch và Bảo đảm tính toàn vẹn ACID (Trừ tài khoản SV / Tăng quỹ KTX)
- 3.3. Cơ chế Trigger bẫy lỗi và Ghi vết kiểm toán OLD / NEW vào nhat_ky_du_lieu
- 3.4. Phân quyền bảo mật CSDL theo nguyên tắc đặc quyền tối thiểu (Least Privilege)
"""
import docx
from docx.shared import Inches, Pt, RGBColor
from build_full_report import (
    add_styled_heading, add_body_paragraph, add_bullet_point,
    add_custom_table, add_image_with_caption, add_code_block
)

def build_part3(doc):
    add_styled_heading(doc, "CHƯƠNG 3: CÀI ĐẶT CÁC TÍNH NĂNG NÂNG CAO TRÊN POSTGRESQL", level=1, page_break=True)

    # 3.1 Thủ tục lưu trữ
    add_styled_heading(doc, "3.1. Thủ tục lưu trữ (Stored Procedures) với tham số IN / OUT", level=2)
    add_body_paragraph(
        doc,
        "Một trong những yêu cầu bắt buộc của môn học Nguyên lý Hệ quản trị Cơ sở dữ liệu là việc cài đặt "
        "các thủ tục lưu trữ (Stored Procedure) ngay trong nhân cơ sở dữ liệu để đóng gói logic nghiệp vụ phức tạp, "
        "tận dụng khả năng tối ưu hóa thực thi của hệ quản trị và giảm thiểu lưu lượng truyền tải trên đường truyền mạng. "
        "Trong hệ thống, nhóm sinh viên cài đặt thủ tục chính `pr_thanh_toan_ngan_hang` nhận các tham số đầu vào (IN) "
        "và trả về trực tiếp các tham số đầu ra (OUT) cho ứng dụng gọi."
    )
    add_body_paragraph(
        doc,
        "Đặc tả tham số của thủ tục `pr_thanh_toan_ngan_hang`:",
        bold_prefix=""
    )
    add_bullet_point(doc, "Tham số đầu vào (IN): ", "p_ma_hoa_don (Mã hóa đơn cần nộp), p_mssv (Mã số sinh viên thanh toán), p_ma_lk (Mã tài khoản ngân hàng liên kết).")
    add_bullet_point(doc, "Tham số đầu ra (OUT): ", "p_so_du_truoc (Số dư tài khoản trước giao dịch), p_so_du_sau (Số dư tài khoản sau khi trừ tiền), p_quy_ktx_moi (Tổng số dư quỹ KTX sau khi nhận tiền), p_ma_gd (Mã giao dịch sinh tự động để làm biên lai).")

    add_body_paragraph(doc, "Đoạn mã định nghĩa Stored Procedure chuẩn hóa trên PostgreSQL:")
    code_sp = """CREATE OR REPLACE PROCEDURE pr_thanh_toan_ngan_hang(
    IN  p_ma_hoa_don   INTEGER,
    IN  p_mssv         VARCHAR(8),
    IN  p_ma_lk        INTEGER,
    OUT p_so_du_truoc  NUMERIC(12, 0),
    OUT p_so_du_sau    NUMERIC(12, 0),
    OUT p_quy_ktx_moi  NUMERIC(12, 0),
    OUT p_ma_gd        VARCHAR(64)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_so_tien_hd NUMERIC(12, 0);
    v_trang_thai VARCHAR(20);
BEGIN
    -- 1. Khóa bi quan dòng hóa đơn và kiểm tra trạng thái
    SELECT so_tien, trang_thai INTO v_so_tien_hd, v_trang_thai
    FROM hoa_don WHERE ma_hoa_don = p_ma_hoa_don FOR UPDATE;

    IF v_trang_thai = 'DA_NOP' THEN
        RAISE EXCEPTION 'Hóa đơn mã % đã được thanh toán trước đó!', p_ma_hoa_don;
    END IF;

    -- 2. Khóa dòng tài khoản ngân hàng liên kết của sinh viên
    SELECT so_du_sandbox INTO p_so_du_truoc
    FROM tai_khoan_ngan_hang_sv
    WHERE ma_lk = p_ma_lk AND mssv = p_mssv FOR UPDATE;

    IF p_so_du_truoc < v_so_tien_hd THEN
        RAISE EXCEPTION 'Số dư tài khoản không đủ! Cần % VNĐ nhưng chỉ có % VNĐ',
            v_so_tien_hd, p_so_du_truoc;
    END IF;

    -- 3. Thực hiện trừ tiền tài khoản sinh viên
    p_so_du_sau := p_so_du_truoc - v_so_tien_hd;
    UPDATE tai_khoan_ngan_hang_sv
    SET so_du_sandbox = p_so_du_sau, ngay_cap_nhat = NOW()
    WHERE ma_lk = p_ma_lk;

    -- 4. Tăng số dư quỹ KTX trong bảng cấu hình
    UPDATE cau_hinh
    SET gia_tri = (gia_tri::NUMERIC + v_so_tien_hd)::TEXT
    WHERE khoa = 'quy_thu_ktx'
    RETURNING gia_tri::NUMERIC INTO p_quy_ktx_moi;

    -- 5. Cập nhật trạng thái hóa đơn sang DA_NOP
    UPDATE hoa_don
    SET trang_thai = 'DA_NOP', so_tien_da_tra = v_so_tien_hd, ngay_thanh_toan = NOW()
    WHERE ma_hoa_don = p_ma_hoa_don;

    -- 6. Tạo mã giao dịch duy nhất ghi nhận vào bảng giao_dich_ngan_hang
    p_ma_gd := 'TX-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || LPAD(p_ma_hoa_don::TEXT, 6, '0');
    INSERT INTO giao_dich_ngan_hang(ma_gd, ma_hoa_don, ma_lk, mssv, so_tien, phuong_thuc, trang_thai)
    VALUES (p_ma_gd, p_ma_hoa_don, p_ma_lk, p_mssv, v_so_tien_hd, 'TAI_KHOAN_LK', 'THANH_CONG');
END;
$$;"""
    add_code_block(doc, code_sp)

    # 3.2 Giao dịch và Bảo đảm tính toàn vẹn ACID
    add_styled_heading(doc, "3.2. Quản lý Giao dịch và Bảo đảm tính toàn vẹn ACID", level=2)
    add_body_paragraph(
        doc,
        "Một vấn đề sống còn trong các hệ thống thông tin tài chính là bảo đảm tính toàn vẹn dữ liệu khi thực hiện "
        "đồng thời các thao tác cập nhật trên nhiều thực thể khác nhau. Trong bài toán nộp tiền ký túc xá, quy trình thanh toán "
        "bản chất là một bài toán giao dịch hai phía (Two-Sided Transaction):",
        bold_prefix="Bản chất bài toán: "
    )
    add_bullet_point(doc, "Phía 1: ", "Khấu trừ số tiền nghĩa vụ khỏi Tài khoản ngân hàng của sinh viên (Số dư tài khoản giảm).")
    add_bullet_point(doc, "Phía 2: ", "Ghi nhận số tiền thu được vào Quỹ Ký túc xá và cập nhật trạng thái hóa đơn sang 'DA_NOP' (Số dư quỹ tăng).")

    add_body_paragraph(
        doc,
        "Nếu hệ thống không được bọc trong một Giao dịch (Transaction) hoàn chỉnh thỏa mãn các thuộc tính ACID, "
        "thì khi phát sinh sự cố mạng, mất điện đột ngột hoặc ngoại lệ phần mềm nằm ở giữa hai bước trên, một thảm họa dữ liệu "
        "chắc chắn sẽ xảy ra: Tài khoản sinh viên đã bị trừ tiền thành công nhưng quỹ ký túc xá chưa được cộng, hóa đơn "
        "vẫn báo chưa nộp (gây mất tiền oan cho sinh viên); hoặc ngược lại, hóa đơn đã được xác nhận hoàn tất nhưng tài khoản "
        "chưa bị trừ tiền (gây thất thoát công nợ nhà trường).",
        bold_prefix="Nguy cơ khi không có giao dịch ACID: "
    )

    add_image_with_caption(doc, "fig2_sequence_acid_payment.png", "Hình 3.1: Sơ đồ Tuần tự Luồng Giao dịch Thanh toán Ngân hàng ACID với khóa bi quan", width_inches=6.2)

    add_body_paragraph(
        doc,
        "Bốn thuộc tính ACID được PostgreSQL bảo đảm nghiêm ngặt trong hệ thống như sau:",
        bold_prefix=""
    )
    add_bullet_point(doc, "Atomicity (Tính nguyên tử): ", "Tất cả các thao tác (trừ tài khoản, tăng quỹ, đổi trạng thái hóa đơn, sinh biên lai) đều được thực thi trọn vẹn (All) hoặc không có thao tác nào được lưu lại (Nothing). Nếu bất kỳ thao tác nào gặp lỗi, lệnh ROLLBACK sẽ hoàn tác toàn bộ trạng thái về thời điểm trước khi bắt đầu.")
    add_bullet_point(doc, "Consistency (Tính nhất quán): ", "Cơ sở dữ liệu chuyển dịch từ một trạng thái hợp lệ này sang một trạng thái hợp lệ khác. Tổng lượng tiền giảm đi ở tài khoản sinh viên luôn đúng bằng lượng tiền tăng lên ở quỹ KTX.")
    add_bullet_point(doc, "Isolation (Tính cô lập): ", "Sử dụng mức cô lập READ COMMITTED kết hợp cơ chế khóa bi quan SELECT ... FOR UPDATE trên hàng dữ liệu của hóa đơn và tài khoản, ngăn chặn triệt để tình trạng hai tiến trình thanh toán đồng thời cho cùng một khoản nợ (chống Double-Spending).")
    add_bullet_point(doc, "Durability (Tính bền vững): ", "Sau khi lệnh COMMIT được xác nhận, nhật ký ghi trước (Write-Ahead Logging - WAL) của PostgreSQL bảo đảm dữ liệu giao dịch được ghi xuống ổ đĩa vĩnh viễn, không bị mất mát ngay cả khi máy chủ sập nguồn.")

    # 3.3 Cơ chế Trigger bẫy lỗi và Ghi vết kiểm toán OLD / NEW
    add_styled_heading(doc, "3.3. Cơ chế Trigger bẫy lỗi và Ghi vết kiểm toán OLD / NEW", level=2)
    add_body_paragraph(
        doc,
        "Trigger (Bộ kích hoạt) là một cơ chế quan trọng của RDBMS cho phép tự động phản ứng lại các sự kiện DML (INSERT, UPDATE, DELETE). "
        "Trong đề tài này, nhóm sinh viên cài đặt hai nhóm Trigger chính:"
    )

    add_styled_heading(doc, "3.3.1. Trigger ghi vết kiểm toán tự động lưu giá trị cũ (OLD) và mới (NEW)", level=3)
    add_body_paragraph(
        doc,
        "Để đáp ứng yêu cầu thanh tra tài chính và giám sát can thiệp trái phép (tương tự như nhật ký ghi nhận sửa điểm thi), "
        "bảng `nhat_ky_du_lieu` được thiết kế để tự động ghi lại toàn bộ trạng thái dữ liệu trước và sau khi thay đổi "
        "dưới định dạng JSONB linh hoạt."
    )
    code_trg_audit = """CREATE OR REPLACE FUNCTION fn_ghi_nhat_ky_du_lieu()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        INSERT INTO nhat_ky_du_lieu(bang_tac_dong, hanh_dong, khoa_chinh, gia_tri_cu, gia_tri_moi, nguoi_thuc_hien)
        VALUES (
            TG_TABLE_NAME, 'UPDATE',
            COALESCE(NEW.ma_hoa_don::TEXT, NEW.mssv, NEW.ma_lk::TEXT),
            to_jsonb(OLD),
            to_jsonb(NEW),
            current_user
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO nhat_ky_du_lieu(bang_tac_dong, hanh_dong, khoa_chinh, gia_tri_cu, gia_tri_moi, nguoi_thuc_hien)
        VALUES (
            TG_TABLE_NAME, 'DELETE',
            COALESCE(OLD.ma_hoa_don::TEXT, OLD.mssv, OLD.ma_lk::TEXT),
            to_jsonb(OLD),
            NULL,
            current_user
        );
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_hoa_don
AFTER UPDATE OR DELETE ON hoa_don
FOR EACH ROW EXECUTE FUNCTION fn_ghi_nhat_ky_du_lieu();"""
    add_code_block(doc, code_trg_audit)

    add_styled_heading(doc, "3.3.2. Trigger bẫy lỗi nghiệp vụ (Business Rule Enforcement)", level=3)
    add_body_paragraph(
        doc,
        "Nhằm ngăn chặn hành vi sửa đổi dữ liệu sau khi đã quyết toán sổ sách hoặc xóa sinh viên có quan hệ ràng buộc, "
        "nhóm cài đặt các Trigger bẫy lỗi kích hoạt mức BEFORE để chủ động chặn đứng tác vụ trước khi ghi vào bảng:"
    )
    add_bullet_point(doc, "Trigger bẫy chặn can thiệp hóa đơn đã nộp (trg_chan_sua_xoa_hoa_don_da_nop): ", "Bẫy lỗi ném ngoại lệ khi có bất kỳ câu lệnh UPDATE số tiền hoặc DELETE đối với các hóa đơn đã có trạng thái 'DA_NOP'.")
    add_bullet_point(doc, "Trigger bảo vệ hồ sơ sinh viên (trg_chan_xoa_sinh_vien): ", "Chặn đứng thao tác DELETE trên bảng sinh_vien nếu sinh viên đó đang có hợp đồng lưu trú còn hiệu lực hoặc còn nợ tiền hóa đơn chưa thanh toán.")
    add_bullet_point(doc, "Trigger chống gian lận chỉ số công tơ điện nước: ", "Bẫy lỗi chặn không cho phép nhập chỉ số mới nhỏ hơn chỉ số cũ (chi_so_moi < chi_so_cu), loại trừ nguy cơ cố tình ghi lùi số điện nước.")

    code_trg_block = """CREATE OR REPLACE FUNCTION fn_chan_sua_xoa_hoa_don_da_nop()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.trang_thai = 'DA_NOP' THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'LỖI NGHIỆP VỤ: Không được phép XÓA hóa đơn mã % vì đã nộp tiền hoàn tất!', OLD.ma_hoa_don;
        ELSIF TG_OP = 'UPDATE' AND (NEW.so_tien <> OLD.so_tien OR NEW.trang_thai <> OLD.trang_thai) THEN
            RAISE EXCEPTION 'LỖI NGHIỆP VỤ: Không được phép SỬA số tiền hoặc trạng thái của hóa đơn mã % đã nộp!', OLD.ma_hoa_don;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chan_sua_xoa_hoa_don_da_nop
BEFORE UPDATE OR DELETE ON hoa_don
FOR EACH ROW EXECUTE FUNCTION fn_chan_sua_xoa_hoa_don_da_nop();"""
    add_code_block(doc, code_trg_block)

    # 3.4 Phân quyền bảo mật CSDL theo đặc quyền tối thiểu (Least Privilege)
    add_styled_heading(doc, "3.4. Phân quyền và Bảo mật cơ sở dữ liệu theo nguyên tắc đặc quyền tối thiểu", level=2)
    add_body_paragraph(
        doc,
        "Một lỗ hổng phổ biến trong các ứng dụng cơ sở dữ liệu là việc ứng dụng web kết nối trực tiếp vào DBMS "
        "bằng tài khoản Superuser (`postgres`). Điều này tiềm ẩn rủi ro nghiêm trọng: nếu ứng dụng bị tấn công SQL Injection, "
        "kẻ xấu có thể thực thi các câu lệnh DDL nguy hiểm như `DROP TABLE hoa_don;` hoặc tạo các đối tượng độc hại."
    )
    add_body_paragraph(
        doc,
        "Để tuân thủ nguyên tắc Đặc quyền tối thiểu (Principle of Least Privilege - PoLP), hệ thống tạo ra một Role riêng biệt "
        "`ktx_app_user` chỉ cấp phát đúng các quyền thao tác dữ liệu (DML: SELECT, INSERT, UPDATE, DELETE) trên các bảng cần thiết, "
        "cấp quyền thực thi (EXECUTE) trên các Stored Procedure, và thu hồi triệt để toàn bộ quyền thay đổi cấu trúc lược đồ (DDL) "
        "trên schema `public`."
    )

    rbac_data = [
        ["Tài khoản / Vai trò", "Loại tài khoản", "Quyền hạn DML (Dữ liệu)", "Quyền hạn DDL (Lược đồ)"],
        ["postgres", "Superuser hệ thống", "Toàn quyền (ALL PRIVILEGES)", "Toàn quyền (CREATE, ALTER, DROP DATABASE/SCHEMA)"],
        ["ktx_admin_role", "Role phân quyền", "SELECT, INSERT, UPDATE, DELETE trên 26 bảng", "Không có quyền DDL"],
        ["ktx_app_user", "Tài khoản ứng dụng web", "Thừa kế ktx_admin_role + EXECUTE Function/Procedure", "Bị chặn tuyệt đối (Permission Denied khi CREATE/DROP TABLE)"]
    ]
    add_custom_table(doc, ["Tài khoản / Role", "Loại", "Quyền DML", "Quyền DDL"], rbac_data, col_widths=[1.5, 1.4, 2.0, 1.5], caption="Bảng 3.1: Ma trận phân quyền kiểm soát truy cập (RBAC) trên PostgreSQL")

    print("Part 3 built successfully.")

-- =============================================================================
-- HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ TRƯỜNG ĐẠI HỌC CẦN THƠ (CTU)
-- File 03: Các Trigger đảm bảo toàn vẹn dữ liệu & nghiệp vụ tự động (Mục 7.1 & 7.3)
-- =============================================================================

-- 1. Trigger kiểm tra sức chứa, giới tính và trạng thái phòng khi thêm/sửa lưu trú
CREATE OR REPLACE FUNCTION fn_trg_kiem_tra_luu_tru()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_phong RECORD;
    v_sv_gioi_tinh VARCHAR(10);
    v_so_nguoi_hien_tai INTEGER;
BEGIN
    -- Chỉ kiểm tra nếu sinh viên đang lưu trú (ngay_ra IS NULL)
    IF NEW.ngay_ra IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Khóa dòng phòng để chống tranh chấp đồng thời (race condition khi 2 quản lý cùng xếp phòng)
    SELECT ma_phong, ten_phong, suc_chua, gioi_tinh, tinh_trang
    INTO v_phong
    FROM phong
    WHERE ma_phong = NEW.ma_phong
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Phòng mã % không tồn tại.', NEW.ma_phong
            USING ERRCODE = 'P0001';
    END IF;

    IF v_phong.tinh_trang = 'BAO_TRI' THEN
        RAISE EXCEPTION 'Phòng % hiện đang bảo trì, không thể xếp sinh viên vào.', v_phong.ten_phong
            USING ERRCODE = 'P0001';
    END IF;

    -- Kiểm tra giới tính sinh viên khớp với giới tính phòng
    SELECT gioi_tinh INTO v_sv_gioi_tinh
    FROM sinh_vien
    WHERE mssv = NEW.mssv;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy sinh viên có MSSV %.', NEW.mssv
            USING ERRCODE = 'P0001';
    END IF;

    IF v_sv_gioi_tinh <> v_phong.gioi_tinh THEN
        RAISE EXCEPTION 'Không thể xếp sinh viên % (giới tính %) vào phòng % dành cho %.',
            NEW.mssv, v_sv_gioi_tinh, v_phong.ten_phong, v_phong.gioi_tinh
            USING ERRCODE = 'P0001';
    END IF;

    -- Đếm số người đang ở trong phòng ở kỳ này (loại trừ chính SV đang cập nhật)
    SELECT COUNT(*)::INTEGER
    INTO v_so_nguoi_hien_tai
    FROM luu_tru
    WHERE ma_phong = NEW.ma_phong
      AND ma_ky = NEW.ma_ky
      AND ngay_ra IS NULL
      AND mssv <> NEW.mssv;

    IF v_so_nguoi_hien_tai >= v_phong.suc_chua THEN
        RAISE EXCEPTION 'Phòng % đã đầy (%/% người), không thể xếp thêm sinh viên %.',
            v_phong.ten_phong, v_so_nguoi_hien_tai, v_phong.suc_chua, NEW.mssv
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kiem_tra_luu_tru
BEFORE INSERT OR UPDATE OF ma_phong, ma_ky, ngay_ra ON luu_tru
FOR EACH ROW
EXECUTE FUNCTION fn_trg_kiem_tra_luu_tru();

-- 2. Trigger tự động cập nhật trạng thái phòng (TRONG / CON_CHO / DAY) khi LUU_TRU thay đổi
CREATE OR REPLACE FUNCTION fn_dong_bo_trang_thai_mot_phong(p_ma_phong INTEGER, p_ma_ky VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_ky_ht VARCHAR(20);
    v_suc_chua INTEGER;
    v_tinh_trang VARCHAR(20);
    v_so_nguoi INTEGER;
    v_moi VARCHAR(20);
BEGIN
    IF p_ma_phong IS NULL THEN
        RETURN;
    END IF;

    v_ky_ht := fn_ky_hoc_hien_hanh();
    IF v_ky_ht IS NOT NULL AND p_ma_ky <> v_ky_ht THEN
        RETURN;
    END IF;

    SELECT suc_chua, tinh_trang INTO v_suc_chua, v_tinh_trang
    FROM phong
    WHERE ma_phong = p_ma_phong
    FOR UPDATE;

    IF NOT FOUND OR v_tinh_trang = 'BAO_TRI' THEN
        RETURN;
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_so_nguoi
    FROM luu_tru
    WHERE ma_phong = p_ma_phong
      AND ma_ky = p_ma_ky
      AND ngay_ra IS NULL;

    IF v_so_nguoi = 0 THEN
        v_moi := 'TRONG';
    ELSIF v_so_nguoi >= v_suc_chua THEN
        v_moi := 'DAY';
    ELSE
        v_moi := 'CON_CHO';
    END IF;

    IF v_moi <> v_tinh_trang THEN
        UPDATE phong SET tinh_trang = v_moi WHERE ma_phong = p_ma_phong;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_trg_cap_nhat_trang_thai_phong()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM fn_dong_bo_trang_thai_mot_phong(NEW.ma_phong, NEW.ma_ky);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM fn_dong_bo_trang_thai_mot_phong(OLD.ma_phong, OLD.ma_ky);
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.ma_phong <> NEW.ma_phong OR OLD.ma_ky <> NEW.ma_ky THEN
            PERFORM fn_dong_bo_trang_thai_mot_phong(OLD.ma_phong, OLD.ma_ky);
        END IF;
        PERFORM fn_dong_bo_trang_thai_mot_phong(NEW.ma_phong, NEW.ma_ky);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_cap_nhat_trang_thai_phong
AFTER INSERT OR UPDATE OR DELETE ON luu_tru
FOR EACH ROW
EXECUTE FUNCTION fn_trg_cap_nhat_trang_thai_phong();

-- 2b. Trigger bảo vệ khi chỉnh sửa cấu trúc phòng (không giảm sức chứa dưới số người đang ở)
CREATE OR REPLACE FUNCTION fn_trg_kiem_tra_sua_phong()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_ky_ht VARCHAR(20);
    v_so_nguoi INTEGER;
    v_khac_gt INTEGER;
BEGIN
    v_ky_ht := fn_ky_hoc_hien_hanh();
    IF v_ky_ht IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_so_nguoi
    FROM luu_tru
    WHERE ma_phong = NEW.ma_phong
      AND ma_ky = v_ky_ht
      AND ngay_ra IS NULL;

    IF NEW.suc_chua < v_so_nguoi THEN
        RAISE EXCEPTION 'Không thể giảm sức chứa phòng % xuống % vì hiện đang có % sinh viên lưu trú.',
            NEW.ten_phong, NEW.suc_chua, v_so_nguoi
            USING ERRCODE = 'P0001';
    END IF;

    IF NEW.gioi_tinh <> OLD.gioi_tinh AND v_so_nguoi > 0 THEN
        SELECT COUNT(*)::INTEGER INTO v_khac_gt
        FROM luu_tru lt
        JOIN sinh_vien sv ON sv.mssv = lt.mssv
        WHERE lt.ma_phong = NEW.ma_phong
          AND lt.ma_ky = v_ky_ht
          AND lt.ngay_ra IS NULL
          AND sv.gioi_tinh <> NEW.gioi_tinh;
        IF v_khac_gt > 0 THEN
            RAISE EXCEPTION 'Không thể đổi giới tính phòng % khi đang có sinh viên khác giới lưu trú.',
                NEW.ten_phong
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Tự đồng bộ trạng thái nếu chuyển từ BAO_TRI về bình thường hoặc đổi sức chứa
    IF NEW.tinh_trang <> 'BAO_TRI' THEN
        IF v_so_nguoi = 0 THEN
            NEW.tinh_trang := 'TRONG';
        ELSIF v_so_nguoi >= NEW.suc_chua THEN
            NEW.tinh_trang := 'DAY';
        ELSE
            NEW.tinh_trang := 'CON_CHO';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kiem_tra_sua_phong
BEFORE UPDATE OF suc_chua, gioi_tinh, tinh_trang ON phong
FOR EACH ROW
EXECUTE FUNCTION fn_trg_kiem_tra_sua_phong();

-- 3. Trigger kiểm tra người đại diện hợp đồng phải đang ở chính phòng đó trong kỳ
CREATE OR REPLACE FUNCTION fn_trg_kiem_tra_hop_dong()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_ton_tai BOOLEAN;
BEGIN
    IF NEW.trang_thai = 'HIEU_LUC' THEN
        SELECT EXISTS (
            SELECT 1
            FROM luu_tru
            WHERE mssv = NEW.mssv_dai_dien
              AND ma_phong = NEW.ma_phong
              AND ma_ky = NEW.ma_ky
              AND ngay_ra IS NULL
        ) INTO v_ton_tai;

        IF NOT v_ton_tai THEN
            RAISE EXCEPTION 'Sinh viên đại diện % không thuộc danh sách lưu trú hiện tại của phòng mã % trong kỳ %.',
                NEW.mssv_dai_dien, NEW.ma_phong, NEW.ma_ky
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kiem_tra_hop_dong
BEFORE INSERT OR UPDATE ON hop_dong
FOR EACH ROW
EXECUTE FUNCTION fn_trg_kiem_tra_hop_dong();

-- 4. Trigger chặn sửa đổi/xóa hóa đơn đã thanh toán (Mục 7.3)
CREATE OR REPLACE FUNCTION fn_trg_chan_sua_xoa_hoa_don_da_nop()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.trang_thai = 'DA_NOP' THEN
            RAISE EXCEPTION 'Không được phép xóa hóa đơn #% vì đã được thanh toán.', OLD.ma_hoa_don
                USING ERRCODE = 'P0001';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.trang_thai = 'DA_NOP' AND (
            NEW.ma_phong <> OLD.ma_phong
            OR NEW.ma_ky <> OLD.ma_ky
            OR NEW.thang <> OLD.thang
            OR NEW.loai <> OLD.loai
            OR NEW.tien_dien <> OLD.tien_dien
            OR NEW.tien_nuoc <> OLD.tien_nuoc
            OR NEW.so_tien <> OLD.so_tien
            OR NEW.trang_thai <> OLD.trang_thai
        ) THEN
            RAISE EXCEPTION 'Không được phép chỉnh sửa số tiền hoặc trạng thái của hóa đơn #% đã thanh toán.',
                OLD.ma_hoa_don
                USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chan_sua_xoa_hoa_don_da_nop
BEFORE UPDATE OR DELETE ON hoa_don
FOR EACH ROW
EXECUTE FUNCTION fn_trg_chan_sua_xoa_hoa_don_da_nop();

-- 5. Trigger tự động ghi thông báo khi trạng thái yêu cầu bảo trì thay đổi (Mục 4.6 & 7.3)
CREATE OR REPLACE FUNCTION fn_trg_thong_bao_bao_tri()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_nhan_trang_thai TEXT;
    v_ten_phong VARCHAR(20);
    v_ky_ht VARCHAR(20);
    v_tieu_de VARCHAR(200);
    v_noi_dung TEXT;
BEGIN
    IF OLD.trang_thai IS NOT DISTINCT FROM NEW.trang_thai THEN
        RETURN NEW;
    END IF;

    v_nhan_trang_thai := CASE NEW.trang_thai
        WHEN 'MOI' THEN 'Mới tiếp nhận'
        WHEN 'DA_TIEP_NHAN' THEN 'Đã tiếp nhận'
        WHEN 'DANG_XU_LY' THEN 'Đang xử lý'
        WHEN 'HOAN_TAT' THEN 'Hoàn tất'
        ELSE NEW.trang_thai
    END;

    v_ky_ht := fn_ky_hoc_hien_hanh();

    IF NEW.ma_phong IS NOT NULL THEN
        SELECT ten_phong INTO v_ten_phong FROM phong WHERE ma_phong = NEW.ma_phong;
        v_tieu_de := format('Cập nhật bảo trì phòng %s: %s', v_ten_phong, v_nhan_trang_thai);
        v_noi_dung := format('Yêu cầu bảo trì #%s (%s) tại phòng %s đã chuyển sang trạng thái "%s".',
            NEW.ma_yc, NEW.mo_ta, v_ten_phong, v_nhan_trang_thai);

        IF NEW.ngay_sua IS NOT NULL THEN
            v_noi_dung := v_noi_dung || format(' Ngày sửa dự kiến: %s.', to_char(NEW.ngay_sua, 'DD/MM/YYYY'));
        END IF;
        IF NEW.sdt_nguoi_sua IS NOT NULL AND trim(NEW.sdt_nguoi_sua) <> '' THEN
            v_noi_dung := v_noi_dung || format(' SĐT người sửa: %s.', trim(NEW.sdt_nguoi_sua));
        END IF;
        IF NEW.ghi_chu_xu_ly IS NOT NULL AND trim(NEW.ghi_chu_xu_ly) <> '' THEN
            v_noi_dung := v_noi_dung || format(' Ghi chú: %s.', trim(NEW.ghi_chu_xu_ly));
        END IF;

        -- Gửi đến tất cả sinh viên đang ở phòng đó
        INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
        SELECT lt.mssv, NEW.ma_phong, NEW.ma_khu, 'BAO_TRI', v_tieu_de, v_noi_dung
        FROM luu_tru lt
        WHERE lt.ma_phong = NEW.ma_phong
          AND lt.ma_ky = v_ky_ht
          AND lt.ngay_ra IS NULL;
    ELSIF NEW.ma_khu IS NOT NULL THEN
        v_tieu_de := format('Cập nhật bảo trì Khu %s: %s', NEW.ma_khu, v_nhan_trang_thai);
        v_noi_dung := format('Yêu cầu bảo trì #%s (%s) tại Khu %s đã chuyển sang trạng thái "%s".',
            NEW.ma_yc, NEW.mo_ta, NEW.ma_khu, v_nhan_trang_thai);

        IF NEW.ngay_sua IS NOT NULL THEN
            v_noi_dung := v_noi_dung || format(' Ngày sửa dự kiến: %s.', to_char(NEW.ngay_sua, 'DD/MM/YYYY'));
        END IF;
        IF NEW.sdt_nguoi_sua IS NOT NULL AND trim(NEW.sdt_nguoi_sua) <> '' THEN
            v_noi_dung := v_noi_dung || format(' SĐT người sửa: %s.', trim(NEW.sdt_nguoi_sua));
        END IF;
        IF NEW.ghi_chu_xu_ly IS NOT NULL AND trim(NEW.ghi_chu_xu_ly) <> '' THEN
            v_noi_dung := v_noi_dung || format(' Ghi chú: %s.', trim(NEW.ghi_chu_xu_ly));
        END IF;

        INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
        SELECT lt.mssv, lt.ma_phong, NEW.ma_khu, 'BAO_TRI', v_tieu_de, v_noi_dung
        FROM luu_tru lt
        JOIN phong p ON p.ma_phong = lt.ma_phong
        WHERE p.ma_khu = NEW.ma_khu
          AND lt.ma_ky = v_ky_ht
          AND lt.ngay_ra IS NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_thong_bao_bao_tri
AFTER UPDATE OF trang_thai ON yeu_cau_bao_tri
FOR EACH ROW
EXECUTE FUNCTION fn_trg_thong_bao_bao_tri();

-- 6. Trigger Audit Log ghi nhận giá trị CŨ (OLD) và MỚI (NEW) vào bảng nhat_ky_du_lieu
CREATE OR REPLACE FUNCTION fn_trg_audit_du_lieu()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_pk TEXT;
    v_cu JSONB := NULL;
    v_moi JSONB := NULL;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_moi := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_cu := to_jsonb(OLD);
        v_moi := to_jsonb(NEW);
    ELSE
        v_cu := to_jsonb(OLD);
    END IF;

    v_pk := CASE TG_TABLE_NAME
        WHEN 'hoa_don' THEN COALESCE((COALESCE(v_moi, v_cu))->>'ma_hoa_don', '')
        WHEN 'don_gia' THEN COALESCE((COALESCE(v_moi, v_cu))->>'ma_dg', '')
        WHEN 'sinh_vien' THEN COALESCE((COALESCE(v_moi, v_cu))->>'mssv', '')
        ELSE ''
    END;

    INSERT INTO nhat_ky_du_lieu (bang_tac_dong, hanh_dong, khoa_chinh, gia_tri_cu, gia_tri_moi)
    VALUES (TG_TABLE_NAME, TG_OP, v_pk, v_cu, v_moi);

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_hoa_don
AFTER INSERT OR UPDATE OR DELETE ON hoa_don
FOR EACH ROW
EXECUTE FUNCTION fn_trg_audit_du_lieu();

CREATE TRIGGER trg_audit_don_gia
AFTER INSERT OR UPDATE OR DELETE ON don_gia
FOR EACH ROW
EXECUTE FUNCTION fn_trg_audit_du_lieu();

CREATE TRIGGER trg_audit_tai_khoan_ngan_hang_sv
AFTER INSERT OR UPDATE OF so_du_sandbox OR DELETE ON tai_khoan_ngan_hang_sv
FOR EACH ROW
EXECUTE FUNCTION fn_trg_audit_du_lieu();

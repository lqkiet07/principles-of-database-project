--
-- PostgreSQL database dump
--

\restrict e0yzmmXyWdtBGyAfjPFjjE6GVcJrlVEoB3BLXMtp1mfps2RdOHFqkM9UmSwKjcP

-- Dumped from database version 18.7
-- Dumped by pg_dump version 18.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: fn_de_xuat_gop_phong(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_de_xuat_gop_phong(p_ma_ky character varying DEFAULT NULL::character varying) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_ky            VARCHAR(20);
    v_solo          RECORD;
    v_target        RECORD;
    v_de_xuat       JSONB := '[]'::JSONB;
    v_used_sources  INTEGER[] := ARRAY[]::INTEGER[];
    v_target_added  JSONB := '{}'::JSONB;
    v_extra         INTEGER;
BEGIN
    v_ky := COALESCE(p_ma_ky, fn_ky_hoc_hien_hanh());

    FOR v_solo IN
        SELECT
            v.ma_phong,
            v.ten_phong,
            v.ma_khu,
            v.gioi_tinh,
            v.suc_chua,
            v.co_nau_an,
            lt.mssv,
            sv.ho_ten
        FROM v_phong_chi_tiet v
        JOIN luu_tru lt ON lt.ma_phong = v.ma_phong AND lt.ma_ky = v_ky AND lt.ngay_ra IS NULL
        JOIN sinh_vien sv ON sv.mssv = lt.mssv
        WHERE v.so_nguoi_o = 1
          AND v.trang_thai_phong <> 'BAO_TRI'
        ORDER BY v.ma_khu, v.ten_phong
    LOOP
        -- Không chuyển phòng đã được dùng làm phòng đích cho người khác
        IF v_target_added ? v_solo.ma_phong::TEXT THEN
            CONTINUE;
        END IF;

        -- Tìm phòng đích cùng khu, giới tính, sức chứa, nấu ăn còn chỗ nhưng chưa đầy
        -- Ưu tiên phòng đã có >= 2 người, sau đó mới tới phòng 1 người khác
        SELECT
            v.ma_phong,
            v.ten_phong,
            v.so_nguoi_o,
            v.suc_chua
        INTO v_target
        FROM v_phong_chi_tiet v
        WHERE v.ma_phong <> v_solo.ma_phong
          AND v.ma_khu = v_solo.ma_khu
          AND v.gioi_tinh = v_solo.gioi_tinh
          AND v.suc_chua = v_solo.suc_chua
          AND v.co_nau_an = v_solo.co_nau_an
          AND v.trang_thai_phong = 'CON_CHO'
          AND NOT (v.ma_phong = ANY(v_used_sources))
          AND (v.so_nguoi_o + COALESCE((v_target_added->>(v.ma_phong::TEXT))::INTEGER, 0)) < v.suc_chua
        ORDER BY
            (v.so_nguoi_o + COALESCE((v_target_added->>(v.ma_phong::TEXT))::INTEGER, 0)) DESC,
            v.ten_phong ASC
        LIMIT 1;

        IF FOUND THEN
            v_used_sources := array_append(v_used_sources, v_solo.ma_phong);
            v_extra := COALESCE((v_target_added->>(v_target.ma_phong::TEXT))::INTEGER, 0) + 1;
            v_target_added := jsonb_set(v_target_added, ARRAY[v_target.ma_phong::TEXT], to_jsonb(v_extra));

            v_de_xuat := v_de_xuat || jsonb_build_object(
                'mssv', v_solo.mssv,
                'ho_ten', v_solo.ho_ten,
                'ma_phong_cu', v_solo.ma_phong,
                'ten_phong_cu', v_solo.ten_phong,
                'ma_phong_moi', v_target.ma_phong,
                'ten_phong_moi', v_target.ten_phong,
                'ma_khu', v_solo.ma_khu,
                'gioi_tinh', v_solo.gioi_tinh,
                'suc_chua', v_solo.suc_chua,
                'co_nau_an', v_solo.co_nau_an,
                'so_nguoi_phong_moi_hien_tai', v_target.so_nguoi_o + v_extra - 1,
                'so_nguoi_phong_moi_sau_gop', v_target.so_nguoi_o + v_extra
            );
        END IF;
    END LOOP;

    RETURN v_de_xuat;
END;
$$;


--
-- Name: fn_dong_bo_trang_thai_mot_phong(integer, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_dong_bo_trang_thai_mot_phong(p_ma_phong integer, p_ma_ky character varying) RETURNS void
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


--
-- Name: fn_ky_hoc_hien_hanh(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_ky_hoc_hien_hanh() RETURNS character varying
    LANGUAGE sql STABLE
    AS $$
    SELECT COALESCE(
        (SELECT ma_ky FROM ky_hoc WHERE dang_hien_hanh = TRUE LIMIT 1),
        (SELECT gia_tri FROM cau_hinh WHERE khoa = 'ky_hoc_hien_tai' LIMIT 1)
    );
$$;


--
-- Name: fn_sinh_vien_chua_ve(date, time without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sinh_vien_chua_ve(p_ngay date DEFAULT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date, p_moc_gio time without time zone DEFAULT '23:59:59'::time without time zone) RETURNS TABLE(mssv character varying, ho_ten character varying, ten_phong character varying, ma_khu character varying, sdt character varying, gio_ra_cuoi timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    WITH ky_ht AS (
        SELECT fn_ky_hoc_hien_hanh() AS ma_ky
    ),
    gioi_han AS (
        SELECT ((p_ngay::TIMESTAMP + p_moc_gio) AT TIME ZONE 'Asia/Ho_Chi_Minh') AS moc_thoi_gian
    ),
    luot_trong_ngay AS (
        SELECT
            l.mssv,
            MAX(l.thoi_gian) FILTER (WHERE l.loai = 'RA') AS gio_ra_cuoi,
            MAX(l.thoi_gian) FILTER (WHERE l.loai = 'VAO') AS gio_vao_cuoi
        FROM luot_ra_vao l
        CROSS JOIN gioi_han gh
        WHERE (l.thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE = p_ngay
          AND l.thoi_gian <= gh.moc_thoi_gian
        GROUP BY l.mssv
    )
    SELECT
        sv.mssv,
        sv.ho_ten,
        p.ten_phong,
        p.ma_khu,
        sv.sdt,
        ln.gio_ra_cuoi
    FROM luot_trong_ngay ln
    JOIN sinh_vien sv ON sv.mssv = ln.mssv
    LEFT JOIN luu_tru lt
        ON lt.mssv = sv.mssv
       AND lt.ma_ky = (SELECT ma_ky FROM ky_ht)
       AND lt.ngay_ra IS NULL
    LEFT JOIN phong p ON p.ma_phong = lt.ma_phong
    WHERE ln.gio_ra_cuoi IS NOT NULL
      AND (ln.gio_vao_cuoi IS NULL OR ln.gio_vao_cuoi < ln.gio_ra_cuoi)
    ORDER BY ln.gio_ra_cuoi ASC;
$$;


--
-- Name: fn_trg_cap_nhat_trang_thai_phong(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_trg_cap_nhat_trang_thai_phong() RETURNS trigger
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


--
-- Name: fn_trg_chan_sua_xoa_hoa_don_da_nop(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_trg_chan_sua_xoa_hoa_don_da_nop() RETURNS trigger
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


--
-- Name: fn_trg_kiem_tra_hop_dong(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_trg_kiem_tra_hop_dong() RETURNS trigger
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


--
-- Name: fn_trg_kiem_tra_luu_tru(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_trg_kiem_tra_luu_tru() RETURNS trigger
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


--
-- Name: fn_trg_kiem_tra_sua_phong(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_trg_kiem_tra_sua_phong() RETURNS trigger
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


--
-- Name: fn_trg_thong_bao_bao_tri(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_trg_thong_bao_bao_tri() RETURNS trigger
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


--
-- Name: sp_duyet_doi_phong(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_duyet_doi_phong(p_ma_yc integer, p_phong_moi integer) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_yc            RECORD;
    v_ten_cu        VARCHAR(20);
    v_ten_moi       VARCHAR(20);
    v_khu_moi       VARCHAR(10);
    v_dai_dien_moi  VARCHAR(8);
    v_min_id        INTEGER;
    v_max_id        INTEGER;
BEGIN
    SELECT * INTO v_yc
    FROM yeu_cau_doi_phong
    WHERE ma_yc = p_ma_yc
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy yêu cầu đổi phòng #%.', p_ma_yc USING ERRCODE = 'P0001';
    END IF;

    IF v_yc.trang_thai <> 'CHO_XU_LY' THEN
        RAISE EXCEPTION 'Yêu cầu đổi phòng #% đã được xử lý trước đó.', p_ma_yc USING ERRCODE = 'P0001';
    END IF;

    IF p_phong_moi = v_yc.phong_hien_tai THEN
        RAISE EXCEPTION 'Phòng mới phải khác phòng hiện tại.' USING ERRCODE = 'P0001';
    END IF;

    -- Khóa 2 phòng theo thứ tự tăng dần để tránh deadlock
    v_min_id := LEAST(v_yc.phong_hien_tai, p_phong_moi);
    v_max_id := GREATEST(v_yc.phong_hien_tai, p_phong_moi);
    PERFORM 1 FROM phong WHERE ma_phong = v_min_id FOR UPDATE;
    PERFORM 1 FROM phong WHERE ma_phong = v_max_id FOR UPDATE;

    SELECT ten_phong INTO v_ten_cu FROM phong WHERE ma_phong = v_yc.phong_hien_tai;
    SELECT ten_phong, ma_khu INTO v_ten_moi, v_khu_moi FROM phong WHERE ma_phong = p_phong_moi;

    IF v_ten_moi IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy phòng mới mã %.', p_phong_moi USING ERRCODE = 'P0001';
    END IF;

    -- Nếu sinh viên đang là đại diện hợp đồng của phòng cũ -> chuyển đại diện cho bạn cùng phòng hoặc chấm dứt nếu phòng trống
    IF EXISTS (
        SELECT 1 FROM hop_dong
        WHERE ma_phong = v_yc.phong_hien_tai
          AND ma_ky = v_yc.ma_ky
          AND mssv_dai_dien = v_yc.mssv
          AND trang_thai = 'HIEU_LUC'
    ) THEN
        SELECT mssv INTO v_dai_dien_moi
        FROM luu_tru
        WHERE ma_phong = v_yc.phong_hien_tai
          AND ma_ky = v_yc.ma_ky
          AND ngay_ra IS NULL
          AND mssv <> v_yc.mssv
        ORDER BY ngay_vao ASC, mssv ASC
        LIMIT 1;

        IF v_dai_dien_moi IS NOT NULL THEN
            UPDATE hop_dong
            SET mssv_dai_dien = v_dai_dien_moi
            WHERE ma_phong = v_yc.phong_hien_tai
              AND ma_ky = v_yc.ma_ky
              AND trang_thai = 'HIEU_LUC';

            INSERT INTO thong_bao (mssv, ma_phong, loai, tieu_de, noi_dung)
            VALUES (
                v_dai_dien_moi,
                v_yc.phong_hien_tai,
                'HOP_DONG',
                format('Cập nhật sinh viên đại diện phòng %s', v_ten_cu),
                format('Do sinh viên %s đã chuyển phòng, bạn được chỉ định làm sinh viên đại diện mới của phòng %s.',
                    v_yc.mssv, v_ten_cu)
            );
        ELSE
            UPDATE hop_dong
            SET trang_thai = 'CHAM_DUT'
            WHERE ma_phong = v_yc.phong_hien_tai
              AND ma_ky = v_yc.ma_ky
              AND trang_thai = 'HIEU_LUC';
        END IF;
    END IF;

    -- Cập nhật lưu trú (trigger sẽ kiểm tra giới tính, sức chứa, bảo trì và đồng bộ trạng thái 2 phòng)
    UPDATE luu_tru
    SET ma_phong = p_phong_moi
    WHERE mssv = v_yc.mssv
      AND ma_ky = v_yc.ma_ky
      AND ngay_ra IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy bản ghi lưu trú hiện hành của sinh viên %.', v_yc.mssv
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE yeu_cau_doi_phong
    SET phong_moi = p_phong_moi,
        trang_thai = 'DA_DUYET',
        ngay_xu_ly = NOW()
    WHERE ma_yc = p_ma_yc;

    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    VALUES (
        v_yc.mssv,
        p_phong_moi,
        v_khu_moi,
        'DOI_PHONG',
        format('Yêu cầu đổi phòng đã được duyệt: chuyển sang phòng %s', v_ten_moi),
        format('Yêu cầu đổi phòng #%s của bạn đã được chấp thuận. Bạn được chuyển từ phòng %s sang phòng %s.',
            p_ma_yc, v_ten_cu, v_ten_moi)
    );

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'ma_yc', p_ma_yc,
        'mssv', v_yc.mssv,
        'ten_phong_cu', v_ten_cu,
        'ten_phong_moi', v_ten_moi
    );
END;
$$;


--
-- Name: sp_gop_phong_cuoi_ky(jsonb, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_gop_phong_cuoi_ky(p_de_xuat jsonb, p_ma_ky character varying DEFAULT NULL::character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ky            VARCHAR(20);
    v_item          JSONB;
    v_mssv          VARCHAR(8);
    v_phong_cu      INTEGER;
    v_phong_moi     INTEGER;
    v_ten_cu        VARCHAR(20);
    v_ten_moi       VARCHAR(20);
    v_khu_moi       VARCHAR(10);
    v_so_nguoi_cu   INTEGER;
    v_count         INTEGER := 0;
    v_min_id        INTEGER;
    v_max_id        INTEGER;
BEGIN
    v_ky := COALESCE(p_ma_ky, fn_ky_hoc_hien_hanh());
    IF p_de_xuat IS NULL OR jsonb_array_length(p_de_xuat) = 0 THEN
        RAISE EXCEPTION 'Danh sách gộp phòng trống.' USING ERRCODE = 'P0001';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_de_xuat) LOOP
        v_mssv := upper(trim(v_item->>'mssv'));
        v_phong_cu := (v_item->>'ma_phong_cu')::INTEGER;
        v_phong_moi := (v_item->>'ma_phong_moi')::INTEGER;

        IF v_phong_cu = v_phong_moi THEN
            RAISE EXCEPTION 'Phòng cũ và phòng mới của sinh viên % không được trùng nhau.', v_mssv
                USING ERRCODE = 'P0001';
        END IF;

        -- Khóa 2 phòng theo thứ tự tăng dần mã phòng để chống deadlock
        v_min_id := LEAST(v_phong_cu, v_phong_moi);
        v_max_id := GREATEST(v_phong_cu, v_phong_moi);
        PERFORM 1 FROM phong WHERE ma_phong = v_min_id FOR UPDATE;
        PERFORM 1 FROM phong WHERE ma_phong = v_max_id FOR UPDATE;

        -- Kiểm tra sinh viên thực sự đang ở một mình tại phòng cũ
        SELECT COUNT(*)::INTEGER INTO v_so_nguoi_cu
        FROM luu_tru
        WHERE ma_phong = v_phong_cu AND ma_ky = v_ky AND ngay_ra IS NULL;

        IF v_so_nguoi_cu <> 1 THEN
            RAISE EXCEPTION 'Phòng mã % không còn ở trạng thái 1 sinh viên (hiện có % người).',
                v_phong_cu, v_so_nguoi_cu USING ERRCODE = 'P0001';
        END IF;

        SELECT ten_phong INTO v_ten_cu FROM phong WHERE ma_phong = v_phong_cu;
        SELECT ten_phong, ma_khu INTO v_ten_moi, v_khu_moi FROM phong WHERE ma_phong = v_phong_moi;

        -- Chấm dứt hợp đồng cũ của phòng trống
        UPDATE hop_dong
        SET trang_thai = 'CHAM_DUT'
        WHERE ma_phong = v_phong_cu
          AND ma_ky = v_ky
          AND trang_thai = 'HIEU_LUC';

        -- Chuyển lưu trú (trigger tự kiểm tra sức chứa, giới tính và cập nhật trạng thái 2 phòng)
        UPDATE luu_tru
        SET ma_phong = v_phong_moi
        WHERE mssv = v_mssv
          AND ma_ky = v_ky
          AND ma_phong = v_phong_cu
          AND ngay_ra IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Sinh viên % không còn lưu trú tại phòng %.', v_mssv, v_ten_cu
                USING ERRCODE = 'P0001';
        END IF;

        INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
        VALUES (
            v_mssv,
            v_phong_moi,
            v_khu_moi,
            'DOI_PHONG',
            format('Thông báo gộp phòng: chuyển từ %s sang %s', v_ten_cu, v_ten_moi),
            format('Ban quản lý KTX đã thực hiện gộp phòng cuối kỳ: bạn được chuyển từ phòng %s sang phòng %s.',
                v_ten_cu, v_ten_moi)
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'so_phong_da_gop', v_count
    );
END;
$$;


--
-- Name: sp_nhap_chi_so_va_tao_hoa_don(integer, character varying, integer, integer, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_nhap_chi_so_va_tao_hoa_don(p_ma_phong integer, p_thang character varying, p_dien_cuoi integer, p_nuoc_cuoi integer, p_ma_ky character varying DEFAULT NULL::character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ky          VARCHAR(20);
    v_ten_phong   VARCHAR(20);
    v_dien_dau    INTEGER := 0;
    v_nuoc_dau    INTEGER := 0;
    v_gia_dien    NUMERIC(12, 0);
    v_gia_nuoc    NUMERIC(12, 0);
    v_luong_dien  INTEGER;
    v_luong_nuoc  INTEGER;
    v_tien_dien   NUMERIC(12, 0);
    v_tien_nuoc   NUMERIC(12, 0);
    v_tong_tien   NUMERIC(12, 0);
    v_han_nop     DATE;
    v_ma_hoa_don  INTEGER;
    v_da_nop      BOOLEAN;
BEGIN
    v_ky := COALESCE(p_ma_ky, fn_ky_hoc_hien_hanh());

    SELECT ten_phong INTO v_ten_phong
    FROM phong
    WHERE ma_phong = p_ma_phong
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy phòng mã %.', p_ma_phong USING ERRCODE = 'P0001';
    END IF;

    -- Chặn ghi đè nếu hóa đơn tháng này đã thanh toán
    SELECT EXISTS (
        SELECT 1 FROM hoa_don
        WHERE ma_phong = p_ma_phong
          AND thang = p_thang
          AND loai = 'DIEN_NUOC'
          AND trang_thai = 'DA_NOP'
    ) INTO v_da_nop;

    IF v_da_nop THEN
        RAISE EXCEPTION 'Hóa đơn điện nước phòng % tháng % đã được thanh toán, không thể sửa chỉ số.',
            v_ten_phong, p_thang USING ERRCODE = 'P0001';
    END IF;

    -- Lấy chỉ số đầu từ chỉ số cuối của kỳ trước gần nhất
    SELECT chi_so_dien_cuoi, chi_so_nuoc_cuoi
    INTO v_dien_dau, v_nuoc_dau
    FROM chi_so
    WHERE ma_phong = p_ma_phong
      AND thang < p_thang
    ORDER BY thang DESC
    LIMIT 1;

    IF NOT FOUND THEN
        v_dien_dau := 0;
        v_nuoc_dau := 0;
    END IF;

    IF p_dien_cuoi < v_dien_dau THEN
        RAISE EXCEPTION 'Phòng %: Chỉ số điện cuối (%) nhỏ hơn chỉ số điện đầu (%).',
            v_ten_phong, p_dien_cuoi, v_dien_dau USING ERRCODE = 'P0001';
    END IF;

    IF p_nuoc_cuoi < v_nuoc_dau THEN
        RAISE EXCEPTION 'Phòng %: Chỉ số nước cuối (%) nhỏ hơn chỉ số nước đầu (%).',
            v_ten_phong, p_nuoc_cuoi, v_nuoc_dau USING ERRCODE = 'P0001';
    END IF;

    -- Lấy đơn giá điện/nước hiện hành theo mốc thời gian mới nhất
    SELECT don_gia INTO v_gia_dien
    FROM don_gia WHERE loai = 'DIEN'
    ORDER BY ap_dung_tu DESC, ma_dg DESC LIMIT 1;

    SELECT don_gia INTO v_gia_nuoc
    FROM don_gia WHERE loai = 'NUOC'
    ORDER BY ap_dung_tu DESC, ma_dg DESC LIMIT 1;

    IF v_gia_dien IS NULL OR v_gia_nuoc IS NULL THEN
        RAISE EXCEPTION 'Chưa thiết lập đơn giá điện hoặc đơn giá nước.' USING ERRCODE = 'P0001';
    END IF;

    -- Lấy hạn nộp điện nước chung từ cấu hình
    SELECT COALESCE(
        (SELECT gia_tri::DATE FROM cau_hinh WHERE khoa = 'han_nop_dien_nuoc' LIMIT 1),
        (CURRENT_DATE + INTERVAL '15 days')::DATE
    ) INTO v_han_nop;

    v_luong_dien := p_dien_cuoi - v_dien_dau;
    v_luong_nuoc := p_nuoc_cuoi - v_nuoc_dau;
    v_tien_dien  := v_luong_dien * v_gia_dien;
    v_tien_nuoc  := v_luong_nuoc * v_gia_nuoc;
    v_tong_tien  := v_tien_dien + v_tien_nuoc;

    -- Lưu/Cập nhật CHI_SO
    INSERT INTO chi_so (ma_phong, thang, chi_so_dien_dau, chi_so_dien_cuoi, chi_so_nuoc_dau, chi_so_nuoc_cuoi, ngay_ghi)
    VALUES (p_ma_phong, p_thang, v_dien_dau, p_dien_cuoi, v_nuoc_dau, p_nuoc_cuoi, NOW())
    ON CONFLICT (ma_phong, thang)
    DO UPDATE SET
        chi_so_dien_dau  = EXCLUDED.chi_so_dien_dau,
        chi_so_dien_cuoi = EXCLUDED.chi_so_dien_cuoi,
        chi_so_nuoc_dau  = EXCLUDED.chi_so_nuoc_dau,
        chi_so_nuoc_cuoi = EXCLUDED.chi_so_nuoc_cuoi,
        ngay_ghi         = NOW();

    -- Lưu/Cập nhật HOA_DON
    INSERT INTO hoa_don (ma_phong, ma_ky, thang, loai, tien_dien, tien_nuoc, so_tien, han_nop, trang_thai)
    VALUES (p_ma_phong, v_ky, p_thang, 'DIEN_NUOC', v_tien_dien, v_tien_nuoc, v_tong_tien, v_han_nop, 'CHUA_NOP')
    ON CONFLICT (ma_phong, ma_ky, thang, loai)
    DO UPDATE SET
        tien_dien = EXCLUDED.tien_dien,
        tien_nuoc = EXCLUDED.tien_nuoc,
        so_tien   = EXCLUDED.so_tien,
        han_nop   = EXCLUDED.han_nop
    RETURNING ma_hoa_don INTO v_ma_hoa_don;

    RETURN jsonb_build_object(
        'ma_hoa_don', v_ma_hoa_don,
        'ma_phong', p_ma_phong,
        'ten_phong', v_ten_phong,
        'thang', p_thang,
        'chi_so_dien_dau', v_dien_dau,
        'chi_so_dien_cuoi', p_dien_cuoi,
        'luong_dien', v_luong_dien,
        'chi_so_nuoc_dau', v_nuoc_dau,
        'chi_so_nuoc_cuoi', p_nuoc_cuoi,
        'luong_nuoc', v_luong_nuoc,
        'tien_dien', v_tien_dien,
        'tien_nuoc', v_tien_nuoc,
        'so_tien', v_tong_tien,
        'han_nop', v_han_nop
    );
END;
$$;


--
-- Name: sp_tao_hoa_don_ktx_ky(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_tao_hoa_don_ktx_ky(p_ma_ky character varying DEFAULT NULL::character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ky       VARCHAR(20);
    v_han_nop  DATE;
    v_inserted INTEGER := 0;
BEGIN
    v_ky := COALESCE(p_ma_ky, fn_ky_hoc_hien_hanh());
    SELECT COALESCE(
        (SELECT gia_tri::DATE FROM cau_hinh WHERE khoa = 'han_nop_ktx' LIMIT 1),
        (CURRENT_DATE + INTERVAL '30 days')::DATE
    ) INTO v_han_nop;

    INSERT INTO hoa_don (ma_phong, ma_ky, thang, loai, tien_dien, tien_nuoc, so_tien, han_nop, trang_thai)
    SELECT DISTINCT p.ma_phong, v_ky, 'KY', 'KTX', 0, 0, p.gia_phong, v_han_nop, 'CHUA_NOP'
    FROM phong p
    JOIN luu_tru lt ON lt.ma_phong = p.ma_phong AND lt.ma_ky = v_ky AND lt.ngay_ra IS NULL
    ON CONFLICT (ma_phong, ma_ky, thang, loai) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$;


--
-- Name: sp_thanh_toan_hoa_don(integer, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_thanh_toan_hoa_don(p_ma_hoa_don integer, p_mssv character varying, p_ma_giao_dich character varying DEFAULT NULL::character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_hd          RECORD;
    v_dai_dien    VARCHAR(8);
    v_ten_phong   VARCHAR(20);
    v_ma_khu      VARCHAR(10);
    v_ma_gd       VARCHAR(64);
    v_ma_tt       INTEGER;
    v_loai_label  TEXT;
BEGIN
    -- Khóa dòng hóa đơn để chống 2 request thanh toán cùng lúc (SELECT ... FOR UPDATE)
    SELECT * INTO v_hd
    FROM hoa_don
    WHERE ma_hoa_don = p_ma_hoa_don
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hóa đơn mã #%.', p_ma_hoa_don USING ERRCODE = 'P0001';
    END IF;

    IF v_hd.trang_thai = 'DA_NOP' THEN
        RAISE EXCEPTION 'Hóa đơn #% đã được thanh toán trước đó, không thể thanh toán lại.', p_ma_hoa_don
            USING ERRCODE = 'P0001';
    END IF;

    -- Kiểm tra người nộp phải là sinh viên đại diện của phòng theo hợp đồng hiệu lực
    SELECT mssv_dai_dien INTO v_dai_dien
    FROM hop_dong
    WHERE ma_phong = v_hd.ma_phong
      AND ma_ky = v_hd.ma_ky
      AND trang_thai = 'HIEU_LUC'
    LIMIT 1;

    IF v_dai_dien IS NULL THEN
        RAISE EXCEPTION 'Phòng chưa có hợp đồng nội trú hiệu lực để xác định sinh viên đại diện thanh toán. Vui lòng liên hệ Ban quản lý.'
            USING ERRCODE = 'P0001';
    END IF;

    IF upper(trim(p_mssv)) <> v_dai_dien THEN
        RAISE EXCEPTION 'Chỉ sinh viên đại diện phòng (%) mới có quyền thanh toán hóa đơn của phòng.', v_dai_dien
            USING ERRCODE = 'P0001';
    END IF;

    SELECT ten_phong, ma_khu INTO v_ten_phong, v_ma_khu
    FROM phong WHERE ma_phong = v_hd.ma_phong;

    v_ma_gd := COALESCE(
        NULLIF(trim(p_ma_giao_dich), ''),
        'QR-CTU-' || p_ma_hoa_don || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    );

    INSERT INTO thanh_toan (ma_hoa_don, mssv_nguoi_nop, so_tien, ma_giao_dich)
    VALUES (p_ma_hoa_don, v_dai_dien, v_hd.so_tien, v_ma_gd)
    RETURNING ma_tt INTO v_ma_tt;

    UPDATE hoa_don
    SET trang_thai = 'DA_NOP'
    WHERE ma_hoa_don = p_ma_hoa_don;

    v_loai_label := CASE WHEN v_hd.loai = 'KTX'
        THEN format('Tiền KTX kỳ %s', v_hd.ma_ky)
        ELSE format('Tiền điện nước tháng %s', v_hd.thang)
    END;

    -- Gửi thông báo xác nhận thanh toán cho toàn bộ sinh viên trong phòng
    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    SELECT
        lt.mssv,
        v_hd.ma_phong,
        v_ma_khu,
        'HOA_DON',
        format('Đã thanh toán %s - Phòng %s', v_loai_label, v_ten_phong),
        format('Sinh viên đại diện (%s) đã hoàn tất thanh toán %s với số tiền %s ₫ (Mã GD: %s).',
            v_dai_dien, v_loai_label, to_char(v_hd.so_tien, 'FM999,999,999'), v_ma_gd)
    FROM luu_tru lt
    WHERE lt.ma_phong = v_hd.ma_phong
      AND lt.ma_ky = v_hd.ma_ky
      AND lt.ngay_ra IS NULL;

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'ma_tt', v_ma_tt,
        'ma_hoa_don', p_ma_hoa_don,
        'ma_giao_dich', v_ma_gd,
        'so_tien', v_hd.so_tien,
        'trang_thai', 'DA_NOP'
    );
END;
$$;


--
-- Name: sp_xep_phong_tu_dong(character varying[], integer, character varying, boolean, boolean, boolean, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sp_xep_phong_tu_dong(p_mssv_list character varying[], p_suc_chua integer, p_ma_khu character varying DEFAULT NULL::character varying, p_co_nau_an boolean DEFAULT NULL::boolean, p_cho_phep_chua_day boolean DEFAULT false, p_chi_xem_truoc boolean DEFAULT false, p_ma_ky character varying DEFAULT NULL::character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ky            VARCHAR(20);
    v_mssv_clean    VARCHAR[];
    v_khong_ton_tai VARCHAR[];
    v_da_co_phong   VARCHAR[];
    v_gioi_tinh     VARCHAR(10);
    v_sv_gt         VARCHAR[];
    v_sv_idx        INTEGER;
    v_sv_total      INTEGER;
    v_room          RECORD;
    v_take          INTEGER;
    v_assigned      VARCHAR[];
    v_ke_hoach      JSONB := '[]'::JSONB;
    v_canh_bao      JSONB := '[]'::JSONB;
    v_loi           JSONB := '[]'::JSONB;
    v_item          JSONB;
    v_m             VARCHAR(8);
    v_so_cho_thieu  INTEGER;
BEGIN
    v_ky := COALESCE(p_ma_ky, fn_ky_hoc_hien_hanh());
    IF v_ky IS NULL THEN
        RAISE EXCEPTION 'Chưa thiết lập kỳ học hiện hành.' USING ERRCODE = 'P0001';
    END IF;

    IF p_suc_chua NOT IN (4, 6, 8) THEN
        RAISE EXCEPTION 'Loại phòng phải là 4, 6 hoặc 8 người.' USING ERRCODE = 'P0001';
    END IF;

    -- Loại trùng và chuẩn hóa MSSV
    SELECT ARRAY(
        SELECT DISTINCT upper(trim(x))
        FROM unnest(p_mssv_list) AS x
        WHERE trim(x) <> ''
        ORDER BY 1
    ) INTO v_mssv_clean;

    IF array_length(v_mssv_clean, 1) IS NULL THEN
        RAISE EXCEPTION 'Danh sách MSSV không được để trống.' USING ERRCODE = 'P0001';
    END IF;

    -- Kiểm tra MSSV không tồn tại
    SELECT ARRAY(
        SELECT m
        FROM unnest(v_mssv_clean) AS m
        LEFT JOIN sinh_vien sv ON sv.mssv = m
        WHERE sv.mssv IS NULL
    ) INTO v_khong_ton_tai;

    IF array_length(v_khong_ton_tai, 1) > 0 THEN
        v_loi := v_loi || jsonb_build_object(
            'loai', 'KHONG_TON_TAI',
            'thong_bao', 'Các MSSV không tồn tại trong hệ thống: ' || array_to_string(v_khong_ton_tai, ', '),
            'danh_sach', to_jsonb(v_khong_ton_tai)
        );
    END IF;

    -- Kiểm tra sinh viên đã có phòng trong kỳ
    SELECT ARRAY(
        SELECT lt.mssv
        FROM luu_tru lt
        WHERE lt.ma_ky = v_ky
          AND lt.ngay_ra IS NULL
          AND lt.mssv = ANY(v_mssv_clean)
    ) INTO v_da_co_phong;

    IF array_length(v_da_co_phong, 1) > 0 THEN
        v_loi := v_loi || jsonb_build_object(
            'loai', 'DA_CO_PHONG',
            'thong_bao', 'Các sinh viên đã có phòng trong kỳ ' || v_ky || ': ' || array_to_string(v_da_co_phong, ', '),
            'danh_sach', to_jsonb(v_da_co_phong)
        );
    END IF;

    -- Nếu có lỗi đầu vào
    IF jsonb_array_length(v_loi) > 0 THEN
        IF p_chi_xem_truoc THEN
            RETURN jsonb_build_object(
                'hop_le', FALSE,
                'ma_ky', v_ky,
                'loi', v_loi,
                'canh_bao_thieu_cho', v_canh_bao,
                'ke_hoach', v_ke_hoach
            );
        ELSE
            RAISE EXCEPTION '%', (v_loi->0->>'thong_bao') USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Phân nhóm theo giới tính (NAM, NU) và xếp theo thứ tự ưu tiên:
    -- (1) Lấp đầy phòng còn chỗ trước (ưu tiên phòng gần đầy nhất), (2) Cùng giới tính,
    -- (3) Cùng khu/loại nấu ăn nếu chọn, (4) Phòng trống mới.
    FOREACH v_gioi_tinh IN ARRAY ARRAY['NAM', 'NU'] LOOP
        SELECT ARRAY(
            SELECT sv.mssv
            FROM sinh_vien sv
            WHERE sv.mssv = ANY(v_mssv_clean)
              AND sv.gioi_tinh = v_gioi_tinh
            ORDER BY sv.mssv
        ) INTO v_sv_gt;

        v_sv_total := COALESCE(array_length(v_sv_gt, 1), 0);
        IF v_sv_total = 0 THEN
            CONTINUE;
        END IF;

        v_sv_idx := 1;

        FOR v_room IN
            SELECT
                p.ma_phong,
                p.ten_phong,
                p.ma_khu,
                p.suc_chua,
                p.co_nau_an,
                p.gioi_tinh,
                (
                    SELECT COUNT(*)::INTEGER
                    FROM luu_tru lt
                    WHERE lt.ma_phong = p.ma_phong
                      AND lt.ma_ky = v_ky
                      AND lt.ngay_ra IS NULL
                ) AS dang_o
            FROM phong p
            WHERE p.gioi_tinh = v_gioi_tinh
              AND p.suc_chua = p_suc_chua
              AND p.tinh_trang <> 'BAO_TRI'
              AND (p_ma_khu IS NULL OR p.ma_khu = p_ma_khu)
              AND (p_co_nau_an IS NULL OR p.co_nau_an = p_co_nau_an)
            ORDER BY
                -- Ưu tiên lấp đầy phòng đang có người trước
                CASE WHEN (
                    SELECT COUNT(*) FROM luu_tru lt
                    WHERE lt.ma_phong = p.ma_phong AND lt.ma_ky = v_ky AND lt.ngay_ra IS NULL
                ) > 0 THEN 0 ELSE 1 END ASC,
                -- Phòng nhiều người hơn (sắp đầy) ưu tiên trước
                (
                    SELECT COUNT(*) FROM luu_tru lt
                    WHERE lt.ma_phong = p.ma_phong AND lt.ma_ky = v_ky AND lt.ngay_ra IS NULL
                ) DESC,
                p.ma_khu ASC,
                p.ten_phong ASC
            FOR UPDATE OF p
        LOOP
            EXIT WHEN v_sv_idx > v_sv_total;

            IF v_room.dang_o >= v_room.suc_chua THEN
                CONTINUE;
            END IF;

            v_take := LEAST(v_room.suc_chua - v_room.dang_o, v_sv_total - v_sv_idx + 1);
            v_assigned := v_sv_gt[v_sv_idx : (v_sv_idx + v_take - 1)];
            v_sv_idx := v_sv_idx + v_take;

            v_so_cho_thieu := v_room.suc_chua - (v_room.dang_o + v_take);

            IF v_so_cho_thieu > 0 THEN
                v_canh_bao := v_canh_bao || jsonb_build_object(
                    'ma_phong', v_room.ma_phong,
                    'ten_phong', v_room.ten_phong,
                    'gioi_tinh', v_gioi_tinh,
                    'suc_chua', v_room.suc_chua,
                    'so_nguoi_sau_xep', v_room.dang_o + v_take,
                    'so_cho_con_thieu', v_so_cho_thieu,
                    'thong_bao', format(
                        'Phòng %s (%s) sau khi xếp có %s/%s sinh viên — còn thiếu %s người để đủ phòng.',
                        v_room.ten_phong,
                        CASE WHEN v_gioi_tinh = 'NAM' THEN 'Nam' ELSE 'Nữ' END,
                        v_room.dang_o + v_take,
                        v_room.suc_chua,
                        v_so_cho_thieu
                    )
                );
            END IF;

            v_ke_hoach := v_ke_hoach || jsonb_build_object(
                'ma_phong', v_room.ma_phong,
                'ten_phong', v_room.ten_phong,
                'ma_khu', v_room.ma_khu,
                'gioi_tinh', v_room.gioi_tinh,
                'suc_chua', v_room.suc_chua,
                'co_nau_an', v_room.co_nau_an,
                'dang_o_truoc', v_room.dang_o,
                'so_nguoi_sau_xep', v_room.dang_o + v_take,
                'du_phong', (v_so_cho_thieu = 0),
                'sinh_vien', (
                    SELECT jsonb_agg(jsonb_build_object(
                        'mssv', sv.mssv,
                        'ho_ten', sv.ho_ten,
                        'gioi_tinh', sv.gioi_tinh,
                        'nganh', sv.nganh
                    ) ORDER BY sv.mssv)
                    FROM sinh_vien sv
                    WHERE sv.mssv = ANY(v_assigned)
                )
            );
        END LOOP;

        IF v_sv_idx <= v_sv_total THEN
            v_loi := v_loi || jsonb_build_object(
                'loai', 'KHONG_DU_PHONG',
                'gioi_tinh', v_gioi_tinh,
                'thong_bao', format(
                    'Không còn đủ phòng %s người phù hợp cho %s sinh viên %s chưa được xếp.',
                    p_suc_chua,
                    v_sv_total - v_sv_idx + 1,
                    CASE WHEN v_gioi_tinh = 'NAM' THEN 'Nam' ELSE 'Nữ' END
                )
            );
        END IF;
    END LOOP;

    IF jsonb_array_length(v_loi) > 0 THEN
        IF p_chi_xem_truoc THEN
            RETURN jsonb_build_object(
                'hop_le', FALSE,
                'ma_ky', v_ky,
                'loi', v_loi,
                'canh_bao_thieu_cho', v_canh_bao,
                'ke_hoach', v_ke_hoach
            );
        ELSE
            RAISE EXCEPTION '%', (v_loi->0->>'thong_bao') USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Chế độ xem trước
    IF p_chi_xem_truoc THEN
        RETURN jsonb_build_object(
            'hop_le', TRUE,
            'du_tat_ca_phong', (jsonb_array_length(v_canh_bao) = 0),
            'ma_ky', v_ky,
            'tong_sinh_vien', array_length(v_mssv_clean, 1),
            'loi', '[]'::JSONB,
            'canh_bao_thieu_cho', v_canh_bao,
            'ke_hoach', v_ke_hoach
        );
    END IF;

    -- Chế độ xác nhận: nếu có phòng chưa đủ và quản lý chưa chọn cho phép xếp chưa đầy -> ROLLBACK
    IF jsonb_array_length(v_canh_bao) > 0 AND NOT p_cho_phep_chua_day THEN
        RAISE EXCEPTION '%', (v_canh_bao->0->>'thong_bao') USING ERRCODE = 'P0001';
    END IF;

    -- Thực thi nguyên tử chèn LUU_TRU và THONG_BAO
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_ke_hoach) LOOP
        FOR v_m IN
            SELECT elem->>'mssv'
            FROM jsonb_array_elements(v_item->'sinh_vien') AS elem
        LOOP
            INSERT INTO luu_tru (mssv, ma_phong, ma_ky, ngay_vao)
            VALUES (v_m, (v_item->>'ma_phong')::INTEGER, v_ky, CURRENT_DATE);

            INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
            VALUES (
                v_m,
                (v_item->>'ma_phong')::INTEGER,
                v_item->>'ma_khu',
                'HE_THONG',
                format('Thông báo xếp phòng %s', v_item->>'ten_phong'),
                format('Bạn đã được xếp vào phòng %s (Khu %s, loại %s người) cho kỳ %s.',
                    v_item->>'ten_phong', v_item->>'ma_khu', v_item->>'suc_chua', v_ky)
            );
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'ma_ky', v_ky,
        'tong_sinh_vien', array_length(v_mssv_clean, 1),
        'ke_hoach', v_ke_hoach
    );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cau_hinh; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cau_hinh (
    khoa character varying(100) NOT NULL,
    gia_tri text NOT NULL,
    mo_ta text
);


--
-- Name: chi_so; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chi_so (
    ma_phong integer NOT NULL,
    thang character varying(7) NOT NULL,
    chi_so_dien_dau integer NOT NULL,
    chi_so_dien_cuoi integer NOT NULL,
    chi_so_nuoc_dau integer NOT NULL,
    chi_so_nuoc_cuoi integer NOT NULL,
    ngay_ghi timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chi_so_check CHECK ((chi_so_dien_cuoi >= chi_so_dien_dau)),
    CONSTRAINT chi_so_check1 CHECK ((chi_so_nuoc_cuoi >= chi_so_nuoc_dau)),
    CONSTRAINT chi_so_chi_so_dien_dau_check CHECK ((chi_so_dien_dau >= 0)),
    CONSTRAINT chi_so_chi_so_nuoc_dau_check CHECK ((chi_so_nuoc_dau >= 0)),
    CONSTRAINT chi_so_thang_check CHECK (((thang)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text))
);


--
-- Name: don_gia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.don_gia (
    ma_dg integer NOT NULL,
    loai character varying(10) NOT NULL,
    don_gia numeric(12,0) NOT NULL,
    ap_dung_tu timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT don_gia_don_gia_check CHECK ((don_gia >= (0)::numeric)),
    CONSTRAINT don_gia_loai_check CHECK (((loai)::text = ANY ((ARRAY['DIEN'::character varying, 'NUOC'::character varying])::text[])))
);


--
-- Name: don_gia_ma_dg_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.don_gia_ma_dg_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: don_gia_ma_dg_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.don_gia_ma_dg_seq OWNED BY public.don_gia.ma_dg;


--
-- Name: hoa_don; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hoa_don (
    ma_hoa_don integer NOT NULL,
    ma_phong integer NOT NULL,
    ma_ky character varying(20) NOT NULL,
    thang character varying(7) DEFAULT 'KY'::character varying NOT NULL,
    loai character varying(15) NOT NULL,
    tien_dien numeric(12,0) DEFAULT 0 NOT NULL,
    tien_nuoc numeric(12,0) DEFAULT 0 NOT NULL,
    so_tien numeric(12,0) NOT NULL,
    han_nop date NOT NULL,
    trang_thai character varying(20) DEFAULT 'CHUA_NOP'::character varying NOT NULL,
    da_gui_thong_bao boolean DEFAULT false NOT NULL,
    ngay_tao timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_hoa_don_thang_format CHECK (((((loai)::text = 'KTX'::text) AND ((thang)::text = 'KY'::text)) OR (((loai)::text = 'DIEN_NUOC'::text) AND ((thang)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)))),
    CONSTRAINT hoa_don_loai_check CHECK (((loai)::text = ANY ((ARRAY['KTX'::character varying, 'DIEN_NUOC'::character varying])::text[]))),
    CONSTRAINT hoa_don_so_tien_check CHECK ((so_tien >= (0)::numeric)),
    CONSTRAINT hoa_don_tien_dien_check CHECK ((tien_dien >= (0)::numeric)),
    CONSTRAINT hoa_don_tien_nuoc_check CHECK ((tien_nuoc >= (0)::numeric)),
    CONSTRAINT hoa_don_trang_thai_check CHECK (((trang_thai)::text = ANY ((ARRAY['CHUA_NOP'::character varying, 'DA_NOP'::character varying])::text[])))
);


--
-- Name: hoa_don_ma_hoa_don_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hoa_don_ma_hoa_don_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hoa_don_ma_hoa_don_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hoa_don_ma_hoa_don_seq OWNED BY public.hoa_don.ma_hoa_don;


--
-- Name: hop_dong; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hop_dong (
    ma_hd integer NOT NULL,
    ma_phong integer NOT NULL,
    ma_ky character varying(20) NOT NULL,
    mssv_dai_dien character varying(8) NOT NULL,
    ngay_ky date DEFAULT CURRENT_DATE NOT NULL,
    trang_thai character varying(20) DEFAULT 'HIEU_LUC'::character varying NOT NULL,
    CONSTRAINT hop_dong_trang_thai_check CHECK (((trang_thai)::text = ANY ((ARRAY['HIEU_LUC'::character varying, 'HET_HAN'::character varying, 'CHAM_DUT'::character varying])::text[])))
);


--
-- Name: hop_dong_ma_hd_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hop_dong_ma_hd_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hop_dong_ma_hd_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hop_dong_ma_hd_seq OWNED BY public.hop_dong.ma_hd;


--
-- Name: khu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.khu (
    ma_khu character varying(10) NOT NULL,
    ten_khu character varying(100) NOT NULL
);


--
-- Name: ky_hoc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ky_hoc (
    ma_ky character varying(20) NOT NULL,
    ten_ky character varying(100) NOT NULL,
    ngay_bat_dau date NOT NULL,
    ngay_ket_thuc date NOT NULL,
    dang_hien_hanh boolean DEFAULT false NOT NULL,
    CONSTRAINT ky_hoc_check CHECK ((ngay_ket_thuc > ngay_bat_dau))
);


--
-- Name: luot_ra_vao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.luot_ra_vao (
    ma_luot bigint NOT NULL,
    mssv character varying(8) NOT NULL,
    loai character varying(10) NOT NULL,
    thoi_gian timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT luot_ra_vao_loai_check CHECK (((loai)::text = ANY ((ARRAY['RA'::character varying, 'VAO'::character varying])::text[])))
);


--
-- Name: luot_ra_vao_ma_luot_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.luot_ra_vao_ma_luot_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: luot_ra_vao_ma_luot_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.luot_ra_vao_ma_luot_seq OWNED BY public.luot_ra_vao.ma_luot;


--
-- Name: luu_tru; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.luu_tru (
    mssv character varying(8) NOT NULL,
    ma_phong integer NOT NULL,
    ma_ky character varying(20) NOT NULL,
    ngay_vao date DEFAULT CURRENT_DATE NOT NULL,
    ngay_ra date,
    CONSTRAINT luu_tru_check CHECK (((ngay_ra IS NULL) OR (ngay_ra >= ngay_vao)))
);


--
-- Name: phong; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phong (
    ma_phong integer NOT NULL,
    ten_phong character varying(20) NOT NULL,
    ma_khu character varying(10) NOT NULL,
    suc_chua integer NOT NULL,
    co_nau_an boolean DEFAULT false NOT NULL,
    gioi_tinh character varying(10) NOT NULL,
    gia_phong numeric(12,0) NOT NULL,
    tinh_trang character varying(20) DEFAULT 'TRONG'::character varying NOT NULL,
    CONSTRAINT phong_gia_phong_check CHECK ((gia_phong >= (0)::numeric)),
    CONSTRAINT phong_gioi_tinh_check CHECK (((gioi_tinh)::text = ANY ((ARRAY['NAM'::character varying, 'NU'::character varying])::text[]))),
    CONSTRAINT phong_suc_chua_check CHECK ((suc_chua = ANY (ARRAY[4, 6, 8]))),
    CONSTRAINT phong_tinh_trang_check CHECK (((tinh_trang)::text = ANY ((ARRAY['TRONG'::character varying, 'CON_CHO'::character varying, 'DAY'::character varying, 'BAO_TRI'::character varying])::text[])))
);


--
-- Name: phong_ma_phong_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.phong_ma_phong_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: phong_ma_phong_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.phong_ma_phong_seq OWNED BY public.phong.ma_phong;


--
-- Name: sinh_vien; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sinh_vien (
    mssv character varying(8) NOT NULL,
    ho_ten character varying(120) NOT NULL,
    gioi_tinh character varying(10) NOT NULL,
    nganh character varying(120) NOT NULL,
    sdt character varying(15) NOT NULL,
    email character varying(120) NOT NULL,
    CONSTRAINT sinh_vien_email_check CHECK (((email)::text ~* '^[A-Z][0-9]{7}@student\.ctu\.edu\.vn$'::text)),
    CONSTRAINT sinh_vien_gioi_tinh_check CHECK (((gioi_tinh)::text = ANY ((ARRAY['NAM'::character varying, 'NU'::character varying])::text[]))),
    CONSTRAINT sinh_vien_ho_ten_check CHECK ((length(TRIM(BOTH FROM ho_ten)) >= 2)),
    CONSTRAINT sinh_vien_mssv_check CHECK (((mssv)::text ~ '^[A-Z][0-9]{7}$'::text)),
    CONSTRAINT sinh_vien_nganh_check CHECK ((length(TRIM(BOTH FROM nganh)) >= 2)),
    CONSTRAINT sinh_vien_sdt_check CHECK (((sdt)::text ~ '^0[0-9]{9,10}$'::text))
);


--
-- Name: tai_khoan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tai_khoan (
    ma_tk integer NOT NULL,
    ten_dang_nhap character varying(50) NOT NULL,
    mat_khau_bam text NOT NULL,
    vai_tro character varying(20) NOT NULL,
    mssv character varying(8),
    ho_ten_hien_thi character varying(120) NOT NULL,
    trang_thai character varying(20) DEFAULT 'HOAT_DONG'::character varying NOT NULL,
    phai_doi_mat_khau boolean DEFAULT false NOT NULL,
    ngay_tao timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tai_khoan_check CHECK (((((vai_tro)::text = 'SINH_VIEN'::text) AND (mssv IS NOT NULL)) OR (((vai_tro)::text = 'QUAN_LY'::text) AND (mssv IS NULL)))),
    CONSTRAINT tai_khoan_trang_thai_check CHECK (((trang_thai)::text = ANY ((ARRAY['HOAT_DONG'::character varying, 'KHOA'::character varying])::text[]))),
    CONSTRAINT tai_khoan_vai_tro_check CHECK (((vai_tro)::text = ANY ((ARRAY['QUAN_LY'::character varying, 'SINH_VIEN'::character varying])::text[])))
);


--
-- Name: tai_khoan_ma_tk_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tai_khoan_ma_tk_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tai_khoan_ma_tk_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tai_khoan_ma_tk_seq OWNED BY public.tai_khoan.ma_tk;


--
-- Name: thanh_toan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thanh_toan (
    ma_tt integer NOT NULL,
    ma_hoa_don integer NOT NULL,
    mssv_nguoi_nop character varying(8) NOT NULL,
    so_tien numeric(12,0) NOT NULL,
    thoi_gian timestamp with time zone DEFAULT now() NOT NULL,
    ma_giao_dich character varying(64) NOT NULL,
    CONSTRAINT thanh_toan_so_tien_check CHECK ((so_tien >= (0)::numeric))
);


--
-- Name: thanh_toan_ma_tt_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.thanh_toan_ma_tt_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: thanh_toan_ma_tt_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.thanh_toan_ma_tt_seq OWNED BY public.thanh_toan.ma_tt;


--
-- Name: thong_bao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thong_bao (
    ma_tb integer NOT NULL,
    mssv character varying(8),
    ma_phong integer,
    ma_khu character varying(10),
    loai character varying(30) DEFAULT 'HE_THONG'::character varying NOT NULL,
    tieu_de character varying(200) NOT NULL,
    noi_dung text NOT NULL,
    thoi_gian timestamp with time zone DEFAULT now() NOT NULL,
    da_doc boolean DEFAULT false NOT NULL,
    CONSTRAINT thong_bao_loai_check CHECK (((loai)::text = ANY ((ARRAY['HOA_DON'::character varying, 'DOI_PHONG'::character varying, 'BAO_TRI'::character varying, 'HOP_DONG'::character varying, 'HE_THONG'::character varying])::text[])))
);


--
-- Name: thong_bao_ma_tb_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.thong_bao_ma_tb_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: thong_bao_ma_tb_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.thong_bao_ma_tb_seq OWNED BY public.thong_bao.ma_tb;


--
-- Name: v_bao_cao_dien_nuoc; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_bao_cao_dien_nuoc AS
 SELECT hd.ma_hoa_don,
    hd.ma_phong,
    p.ten_phong,
    p.ma_khu,
    k.ten_khu,
    hd.ma_ky,
    hd.thang,
    cs.chi_so_dien_dau,
    cs.chi_so_dien_cuoi,
    (cs.chi_so_dien_cuoi - cs.chi_so_dien_dau) AS luong_dien,
    cs.chi_so_nuoc_dau,
    cs.chi_so_nuoc_cuoi,
    (cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau) AS luong_nuoc,
    hd.tien_dien,
    hd.tien_nuoc,
    hd.so_tien,
    hd.han_nop,
    hd.trang_thai,
    hd.da_gui_thong_bao,
    hd.ngay_tao,
    tt.thoi_gian AS ngay_thanh_toan,
    tt.mssv_nguoi_nop,
    tt.ma_giao_dich
   FROM ((((public.hoa_don hd
     JOIN public.phong p ON ((p.ma_phong = hd.ma_phong)))
     JOIN public.khu k ON (((k.ma_khu)::text = (p.ma_khu)::text)))
     LEFT JOIN public.chi_so cs ON (((cs.ma_phong = hd.ma_phong) AND ((cs.thang)::text = (hd.thang)::text))))
     LEFT JOIN public.thanh_toan tt ON ((tt.ma_hoa_don = hd.ma_hoa_don)))
  WHERE ((hd.loai)::text = 'DIEN_NUOC'::text);


--
-- Name: v_luot_vao_7_ngay; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_luot_vao_7_ngay AS
 WITH ngay_series AS (
         SELECT (generate_series((((((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date - '6 days'::interval))::date)::timestamp with time zone, (((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date)::timestamp with time zone, '1 day'::interval))::date AS ngay
        )
 SELECT ns.ngay,
    to_char((ns.ngay)::timestamp with time zone, 'DD/MM'::text) AS nhan_ngay,
    (count(l.ma_luot))::integer AS so_luot_vao
   FROM (ngay_series ns
     LEFT JOIN public.luot_ra_vao l ON ((((l.loai)::text = 'VAO'::text) AND (((l.thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date = ns.ngay))))
  GROUP BY ns.ngay
  ORDER BY ns.ngay;


--
-- Name: yeu_cau_bao_tri; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.yeu_cau_bao_tri (
    ma_yc integer NOT NULL,
    ma_phong integer,
    ma_khu character varying(10),
    mssv character varying(8),
    nhom_su_co character varying(30) NOT NULL,
    mo_ta text NOT NULL,
    anh_url text,
    trang_thai character varying(20) DEFAULT 'MOI'::character varying NOT NULL,
    thoi_gian timestamp with time zone DEFAULT now() NOT NULL,
    cap_nhat_luc timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT yeu_cau_bao_tri_check CHECK (((ma_phong IS NOT NULL) OR (ma_khu IS NOT NULL))),
    CONSTRAINT yeu_cau_bao_tri_mo_ta_check CHECK ((length(TRIM(BOTH FROM mo_ta)) >= 3)),
    CONSTRAINT yeu_cau_bao_tri_nhom_su_co_check CHECK (((nhom_su_co)::text = ANY ((ARRAY['DIEN'::character varying, 'NUOC'::character varying, 'NOI_THAT'::character varying, 'CONG_TRINH'::character varying, 'KHAC'::character varying])::text[]))),
    CONSTRAINT yeu_cau_bao_tri_trang_thai_check CHECK (((trang_thai)::text = ANY ((ARRAY['MOI'::character varying, 'DA_TIEP_NHAN'::character varying, 'DANG_XU_LY'::character varying, 'HOAN_TAT'::character varying])::text[])))
);


--
-- Name: v_phong_chi_tiet; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_phong_chi_tiet AS
 WITH ky_ht AS (
         SELECT public.fn_ky_hoc_hien_hanh() AS ma_ky
        ), dem_o AS (
         SELECT lt.ma_phong,
            (count(*))::integer AS so_nguoi_o
           FROM (public.luu_tru lt
             CROSS JOIN ky_ht)
          WHERE (((lt.ma_ky)::text = (ky_ht.ma_ky)::text) AND (lt.ngay_ra IS NULL))
          GROUP BY lt.ma_phong
        ), hd_ht AS (
         SELECT hd_1.ma_phong,
            hd_1.ma_hd,
            hd_1.mssv_dai_dien,
            sv.ho_ten AS ten_dai_dien,
            hd_1.ngay_ky,
            hd_1.trang_thai
           FROM ((public.hop_dong hd_1
             CROSS JOIN ky_ht)
             JOIN public.sinh_vien sv ON (((sv.mssv)::text = (hd_1.mssv_dai_dien)::text)))
          WHERE (((hd_1.ma_ky)::text = (ky_ht.ma_ky)::text) AND ((hd_1.trang_thai)::text = 'HIEU_LUC'::text))
        ), bt_mo AS (
         SELECT yeu_cau_bao_tri.ma_phong,
            (count(*))::integer AS so_yc_bao_tri
           FROM public.yeu_cau_bao_tri
          WHERE ((yeu_cau_bao_tri.ma_phong IS NOT NULL) AND ((yeu_cau_bao_tri.trang_thai)::text = ANY ((ARRAY['MOI'::character varying, 'DA_TIEP_NHAN'::character varying, 'DANG_XU_LY'::character varying])::text[])))
          GROUP BY yeu_cau_bao_tri.ma_phong
        )
 SELECT p.ma_phong,
    p.ten_phong,
    p.ma_khu,
    k.ten_khu,
    p.suc_chua,
    p.co_nau_an,
    p.gioi_tinh,
    p.gia_phong,
    COALESCE(d.so_nguoi_o, 0) AS so_nguoi_o,
    GREATEST((p.suc_chua - COALESCE(d.so_nguoi_o, 0)), 0) AS so_giuong_trong,
        CASE
            WHEN ((p.tinh_trang)::text = 'BAO_TRI'::text) THEN 'BAO_TRI'::text
            WHEN (COALESCE(d.so_nguoi_o, 0) = 0) THEN 'TRONG'::text
            WHEN (COALESCE(d.so_nguoi_o, 0) >= p.suc_chua) THEN 'DAY'::text
            ELSE 'CON_CHO'::text
        END AS trang_thai_phong,
    hd.ma_hd,
    hd.mssv_dai_dien,
    hd.ten_dai_dien,
    (hd.ma_hd IS NOT NULL) AS da_ky_hop_dong,
    COALESCE(bt.so_yc_bao_tri, 0) AS so_yc_bao_tri
   FROM ((((public.phong p
     JOIN public.khu k ON (((k.ma_khu)::text = (p.ma_khu)::text)))
     LEFT JOIN dem_o d ON ((d.ma_phong = p.ma_phong)))
     LEFT JOIN hd_ht hd ON ((hd.ma_phong = p.ma_phong)))
     LEFT JOIN bt_mo bt ON ((bt.ma_phong = p.ma_phong)));


--
-- Name: v_sinh_vien_chua_ve_hom_nay; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_sinh_vien_chua_ve_hom_nay AS
 SELECT mssv,
    ho_ten,
    ten_phong,
    ma_khu,
    sdt,
    gio_ra_cuoi
   FROM public.fn_sinh_vien_chua_ve(((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date, COALESCE((NULLIF(( SELECT cau_hinh.gia_tri
           FROM public.cau_hinh
          WHERE ((cau_hinh.khoa)::text = 'moc_gio_chua_ve'::text)
         LIMIT 1), '24:00'::text))::time without time zone, '23:59:59'::time without time zone)) fn_sinh_vien_chua_ve(mssv, ho_ten, ten_phong, ma_khu, sdt, gio_ra_cuoi);


--
-- Name: v_tong_quan_ktx; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_tong_quan_ktx AS
 WITH thang_ht AS (
         SELECT COALESCE(( SELECT max((chi_so.thang)::text) AS max
                   FROM public.chi_so), to_char((CURRENT_DATE)::timestamp with time zone, 'YYYY-MM'::text)) AS thang
        ), tk_phong AS (
         SELECT (count(*))::integer AS tong_so_phong,
            (COALESCE(sum(v_phong_chi_tiet.so_nguoi_o), (0)::bigint))::integer AS tong_sv_dang_o,
            (COALESCE(sum(
                CASE
                    WHEN (v_phong_chi_tiet.trang_thai_phong <> 'BAO_TRI'::text) THEN v_phong_chi_tiet.suc_chua
                    ELSE 0
                END), (0)::bigint))::integer AS tong_suc_chua_kha_dung,
            (COALESCE(sum(
                CASE
                    WHEN (v_phong_chi_tiet.trang_thai_phong <> 'BAO_TRI'::text) THEN v_phong_chi_tiet.so_giuong_trong
                    ELSE 0
                END), (0)::bigint))::integer AS so_giuong_trong
           FROM public.v_phong_chi_tiet
        ), tk_chi_so AS (
         SELECT (count(*))::integer AS so_phong_da_nhap_chi_so,
            COALESCE(sum((cs.chi_so_dien_cuoi - cs.chi_so_dien_dau)), (0)::bigint) AS tong_dien_tieu_thu,
            COALESCE(sum((cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau)), (0)::bigint) AS tong_nuoc_tieu_thu
           FROM (public.chi_so cs
             CROSS JOIN thang_ht thang_ht_1)
          WHERE ((cs.thang)::text = thang_ht_1.thang)
        ), tk_hd AS (
         SELECT (count(*))::integer AS so_phong_chua_nop_dien_nuoc
           FROM (public.hoa_don hd
             CROSS JOIN thang_ht thang_ht_1)
          WHERE (((hd.loai)::text = 'DIEN_NUOC'::text) AND ((hd.thang)::text = thang_ht_1.thang) AND ((hd.trang_thai)::text = 'CHUA_NOP'::text))
        ), tk_ra_vao AS (
         SELECT (count(*) FILTER (WHERE (((luot_ra_vao.loai)::text = 'VAO'::text) AND (((luot_ra_vao.thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date = ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date))))::integer AS luot_vao_hom_nay,
            (count(*) FILTER (WHERE (((luot_ra_vao.loai)::text = 'VAO'::text) AND (date_trunc('week'::text, (luot_ra_vao.thoi_gian AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)) = date_trunc('week'::text, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))))))::integer AS luot_vao_tuan_nay
           FROM public.luot_ra_vao
        )
 SELECT thang_ht.thang AS thang_hien_tai,
    tk_phong.tong_sv_dang_o,
    tk_phong.tong_suc_chua_kha_dung,
    tk_phong.so_giuong_trong,
    tk_phong.tong_so_phong,
    tk_chi_so.so_phong_da_nhap_chi_so,
    tk_chi_so.tong_dien_tieu_thu,
    tk_chi_so.tong_nuoc_tieu_thu,
    tk_hd.so_phong_chua_nop_dien_nuoc,
    tk_ra_vao.luot_vao_hom_nay,
    tk_ra_vao.luot_vao_tuan_nay
   FROM thang_ht,
    tk_phong,
    tk_chi_so,
    tk_hd,
    tk_ra_vao;


--
-- Name: yeu_cau_bao_tri_ma_yc_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.yeu_cau_bao_tri_ma_yc_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: yeu_cau_bao_tri_ma_yc_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.yeu_cau_bao_tri_ma_yc_seq OWNED BY public.yeu_cau_bao_tri.ma_yc;


--
-- Name: yeu_cau_doi_phong; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.yeu_cau_doi_phong (
    ma_yc integer NOT NULL,
    mssv character varying(8) NOT NULL,
    ma_ky character varying(20) NOT NULL,
    phong_hien_tai integer NOT NULL,
    phong_moi integer,
    nguyen_vong_khu character varying(10),
    nguyen_vong_loai integer,
    ly_do text NOT NULL,
    trang_thai character varying(20) DEFAULT 'CHO_XU_LY'::character varying NOT NULL,
    ly_do_tu_choi text,
    thoi_gian timestamp with time zone DEFAULT now() NOT NULL,
    ngay_xu_ly timestamp with time zone,
    CONSTRAINT yeu_cau_doi_phong_check CHECK (((phong_moi IS NULL) OR (phong_moi <> phong_hien_tai))),
    CONSTRAINT yeu_cau_doi_phong_check1 CHECK ((((trang_thai)::text <> 'TU_CHOI'::text) OR ((ly_do_tu_choi IS NOT NULL) AND (length(TRIM(BOTH FROM ly_do_tu_choi)) >= 2)))),
    CONSTRAINT yeu_cau_doi_phong_ly_do_check CHECK ((length(TRIM(BOTH FROM ly_do)) >= 5)),
    CONSTRAINT yeu_cau_doi_phong_nguyen_vong_loai_check CHECK (((nguyen_vong_loai IS NULL) OR (nguyen_vong_loai = ANY (ARRAY[4, 6, 8])))),
    CONSTRAINT yeu_cau_doi_phong_trang_thai_check CHECK (((trang_thai)::text = ANY ((ARRAY['CHO_XU_LY'::character varying, 'DA_DUYET'::character varying, 'TU_CHOI'::character varying])::text[])))
);


--
-- Name: yeu_cau_doi_phong_ma_yc_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.yeu_cau_doi_phong_ma_yc_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: yeu_cau_doi_phong_ma_yc_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.yeu_cau_doi_phong_ma_yc_seq OWNED BY public.yeu_cau_doi_phong.ma_yc;


--
-- Name: don_gia ma_dg; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.don_gia ALTER COLUMN ma_dg SET DEFAULT nextval('public.don_gia_ma_dg_seq'::regclass);


--
-- Name: hoa_don ma_hoa_don; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hoa_don ALTER COLUMN ma_hoa_don SET DEFAULT nextval('public.hoa_don_ma_hoa_don_seq'::regclass);


--
-- Name: hop_dong ma_hd; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hop_dong ALTER COLUMN ma_hd SET DEFAULT nextval('public.hop_dong_ma_hd_seq'::regclass);


--
-- Name: luot_ra_vao ma_luot; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.luot_ra_vao ALTER COLUMN ma_luot SET DEFAULT nextval('public.luot_ra_vao_ma_luot_seq'::regclass);


--
-- Name: phong ma_phong; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phong ALTER COLUMN ma_phong SET DEFAULT nextval('public.phong_ma_phong_seq'::regclass);


--
-- Name: tai_khoan ma_tk; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tai_khoan ALTER COLUMN ma_tk SET DEFAULT nextval('public.tai_khoan_ma_tk_seq'::regclass);


--
-- Name: thanh_toan ma_tt; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thanh_toan ALTER COLUMN ma_tt SET DEFAULT nextval('public.thanh_toan_ma_tt_seq'::regclass);


--
-- Name: thong_bao ma_tb; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thong_bao ALTER COLUMN ma_tb SET DEFAULT nextval('public.thong_bao_ma_tb_seq'::regclass);


--
-- Name: yeu_cau_bao_tri ma_yc; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_bao_tri ALTER COLUMN ma_yc SET DEFAULT nextval('public.yeu_cau_bao_tri_ma_yc_seq'::regclass);


--
-- Name: yeu_cau_doi_phong ma_yc; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_doi_phong ALTER COLUMN ma_yc SET DEFAULT nextval('public.yeu_cau_doi_phong_ma_yc_seq'::regclass);


--
-- Data for Name: cau_hinh; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cau_hinh (khoa, gia_tri, mo_ta) FROM stdin;
ky_hoc_hien_tai	HK1_2026_2027	Mã kỳ học hiện hành
han_nop_ktx	2026-12-09	Hạn đóng tiền phòng KTX chung
han_nop_dien_nuoc	2026-12-01	Hạn đóng tiền điện nước chung
moc_gio_chua_ve	24:00	Mốc giờ xác định sinh viên chưa về trong ngày
che_do_bao_tri	false	Bật/tắt chế độ bảo trì hệ thống
\.


--
-- Data for Name: chi_so; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chi_so (ma_phong, thang, chi_so_dien_dau, chi_so_dien_cuoi, chi_so_nuoc_dau, chi_so_nuoc_cuoi, ngay_ghi) FROM stdin;
1	2026-08	1838	1888	241	249	2026-11-19 18:25:23.885551+07
2	2026-08	2270	2320	371	379	2026-11-19 18:25:23.885551+07
3	2026-08	1699	1749	365	373	2026-11-19 18:25:23.885551+07
4	2026-08	2306	2356	364	372	2026-11-19 18:25:23.885551+07
5	2026-08	1417	1467	218	226	2026-11-19 18:25:23.885551+07
6	2026-08	2252	2302	362	370	2026-11-19 18:25:23.885551+07
7	2026-08	3096	3146	256	264	2026-11-19 18:25:23.885551+07
8	2026-08	3342	3392	146	154	2026-11-19 18:25:23.885551+07
9	2026-08	3254	3304	335	343	2026-11-19 18:25:23.885551+07
10	2026-08	2973	3023	329	337	2026-11-19 18:25:23.885551+07
11	2026-08	2943	2993	208	216	2026-11-19 18:25:23.885551+07
12	2026-08	1982	2032	199	207	2026-11-19 18:25:23.885551+07
13	2026-08	1561	1611	227	235	2026-11-19 18:25:23.885551+07
14	2026-08	3421	3471	159	167	2026-11-19 18:25:23.885551+07
15	2026-08	3159	3209	209	217	2026-11-19 18:25:23.885551+07
16	2026-08	1623	1673	341	349	2026-11-19 18:25:23.885551+07
17	2026-08	2285	2335	389	397	2026-11-19 18:25:23.885551+07
18	2026-08	2666	2716	196	204	2026-11-19 18:25:23.885551+07
19	2026-08	2467	2517	319	327	2026-11-19 18:25:23.885551+07
20	2026-08	2294	2344	333	341	2026-11-19 18:25:23.885551+07
21	2026-08	2062	2112	239	247	2026-11-19 18:25:23.885551+07
25	2026-08	2374	2424	232	240	2026-11-19 18:25:23.885551+07
26	2026-08	1886	1936	248	256	2026-11-19 18:25:23.885551+07
27	2026-08	3428	3478	180	188	2026-11-19 18:25:23.885551+07
28	2026-08	3045	3095	121	129	2026-11-19 18:25:23.885551+07
29	2026-08	2154	2204	196	204	2026-11-19 18:25:23.885551+07
30	2026-08	1853	1903	174	182	2026-11-19 18:25:23.885551+07
31	2026-08	3222	3272	364	372	2026-11-19 18:25:23.885551+07
32	2026-08	3061	3111	265	273	2026-11-19 18:25:23.885551+07
33	2026-08	1773	1823	132	140	2026-11-19 18:25:23.885551+07
34	2026-08	2714	2764	318	326	2026-11-19 18:25:23.885551+07
35	2026-08	2999	3049	326	334	2026-11-19 18:25:23.885551+07
36	2026-08	2855	2905	255	263	2026-11-19 18:25:23.885551+07
37	2026-08	2843	2893	134	142	2026-11-19 18:25:23.885551+07
38	2026-08	3178	3228	313	321	2026-11-19 18:25:23.885551+07
39	2026-08	3202	3252	384	392	2026-11-19 18:25:23.885551+07
40	2026-08	3153	3203	214	222	2026-11-19 18:25:23.885551+07
41	2026-08	1880	1930	230	238	2026-11-19 18:25:23.885551+07
42	2026-08	2458	2508	213	221	2026-11-19 18:25:23.885551+07
43	2026-08	1763	1813	320	328	2026-11-19 18:25:23.885551+07
44	2026-08	1746	1796	263	271	2026-11-19 18:25:23.885551+07
1	2026-09	1888	2044	249	263	2026-11-19 18:25:23.885551+07
2	2026-09	2320	2520	379	397	2026-11-19 18:25:23.885551+07
3	2026-09	1749	1809	373	381	2026-11-19 18:25:23.885551+07
4	2026-09	2356	2500	372	390	2026-11-19 18:25:23.885551+07
5	2026-09	1467	1702	226	258	2026-11-19 18:25:23.885551+07
6	2026-09	2302	2508	370	390	2026-11-19 18:25:23.885551+07
7	2026-09	3146	3474	264	287	2026-11-19 18:25:23.885551+07
8	2026-09	3392	3610	154	174	2026-11-19 18:25:23.885551+07
9	2026-09	3304	3420	343	363	2026-11-19 18:25:23.885551+07
10	2026-09	3023	3119	337	349	2026-11-19 18:25:23.885551+07
11	2026-09	2993	3024	216	220	2026-11-19 18:25:23.885551+07
12	2026-09	2032	2202	207	239	2026-11-19 18:25:23.885551+07
13	2026-09	1611	1747	235	247	2026-11-19 18:25:23.885551+07
14	2026-09	3471	3627	167	185	2026-11-19 18:25:23.885551+07
15	2026-09	3209	3254	217	220	2026-11-19 18:25:23.885551+07
16	2026-09	1673	1849	349	387	2026-11-19 18:25:23.885551+07
17	2026-09	2335	2391	397	403	2026-11-19 18:25:23.885551+07
18	2026-09	2716	2888	204	220	2026-11-19 18:25:23.885551+07
19	2026-09	2517	2581	327	337	2026-11-19 18:25:23.885551+07
20	2026-09	2344	2569	341	361	2026-11-19 18:25:23.885551+07
21	2026-09	2112	2310	247	283	2026-11-19 18:25:23.885551+07
25	2026-09	2424	2596	240	262	2026-11-19 18:25:23.885551+07
26	2026-09	1936	2096	256	270	2026-11-19 18:25:23.885551+07
27	2026-09	3478	3534	188	196	2026-11-19 18:25:23.885551+07
28	2026-09	3095	3270	129	156	2026-11-19 18:25:23.885551+07
29	2026-09	2204	2379	204	231	2026-11-19 18:25:23.885551+07
30	2026-09	1903	2103	182	208	2026-11-19 18:25:23.885551+07
31	2026-09	3272	3544	372	392	2026-11-19 18:25:23.885551+07
32	2026-09	3111	3439	273	296	2026-11-19 18:25:23.885551+07
33	2026-09	1823	1931	140	156	2026-11-19 18:25:23.885551+07
34	2026-09	2764	2889	326	337	2026-11-19 18:25:23.885551+07
35	2026-09	3049	3163	334	346	2026-11-19 18:25:23.885551+07
36	2026-09	2905	3117	263	283	2026-11-19 18:25:23.885551+07
37	2026-09	2893	3088	142	157	2026-11-19 18:25:23.885551+07
38	2026-09	3228	3448	321	353	2026-11-19 18:25:23.885551+07
39	2026-09	3252	3292	392	396	2026-11-19 18:25:23.885551+07
40	2026-09	3203	3496	222	259	2026-11-19 18:25:23.885551+07
41	2026-09	1930	2012	238	248	2026-11-19 18:25:23.885551+07
42	2026-09	2508	2672	221	245	2026-11-19 18:25:23.885551+07
43	2026-09	1813	1927	328	346	2026-11-19 18:25:23.885551+07
44	2026-09	1796	1964	271	287	2026-11-19 18:25:23.885551+07
1	2026-10	2044	2180	263	285	2026-11-19 18:25:23.885551+07
2	2026-10	2520	2680	397	411	2026-11-19 18:25:23.885551+07
3	2026-10	1809	1874	381	387	2026-11-19 18:25:23.885551+07
4	2026-10	2500	2660	390	416	2026-11-19 18:25:23.885551+07
5	2026-10	1702	1867	258	290	2026-11-19 18:25:23.885551+07
6	2026-10	2508	2678	390	416	2026-11-19 18:25:23.885551+07
7	2026-10	3474	3690	287	310	2026-11-19 18:25:23.885551+07
8	2026-10	3610	3834	174	206	2026-11-19 18:25:23.885551+07
9	2026-10	3420	3596	363	379	2026-11-19 18:25:23.885551+07
10	2026-10	3119	3199	349	363	2026-11-19 18:25:23.885551+07
11	2026-10	3024	3062	220	225	2026-11-19 18:25:23.885551+07
12	2026-10	2202	2384	239	271	2026-11-19 18:25:23.885551+07
13	2026-10	1747	1867	247	271	2026-11-19 18:25:23.885551+07
14	2026-10	3627	3747	185	211	2026-11-19 18:25:23.885551+07
15	2026-10	3254	3280	220	224	2026-11-19 18:25:23.885551+07
16	2026-10	1849	2109	387	413	2026-11-19 18:25:23.885551+07
17	2026-10	2391	2445	403	409	2026-11-19 18:25:23.885551+07
18	2026-10	2888	3044	220	244	2026-11-19 18:25:23.885551+07
19	2026-10	2581	2635	337	345	2026-11-19 18:25:23.885551+07
20	2026-10	2569	2714	361	381	2026-11-19 18:25:23.885551+07
21	2026-10	2310	2502	283	301	2026-11-19 18:25:23.885551+07
25	2026-10	2596	2740	262	276	2026-11-19 18:25:23.885551+07
26	2026-10	2096	2252	270	288	2026-11-19 18:25:23.885551+07
27	2026-10	3534	3581	196	201	2026-11-19 18:25:23.885551+07
28	2026-10	3270	3490	156	173	2026-11-19 18:25:23.885551+07
29	2026-10	2379	2554	231	263	2026-11-19 18:25:23.885551+07
30	2026-10	2103	2279	208	228	2026-11-19 18:25:23.885551+07
31	2026-10	3544	3714	392	418	2026-11-19 18:25:23.885551+07
32	2026-10	3439	3725	296	333	2026-11-19 18:25:23.885551+07
33	2026-10	1931	2039	156	172	2026-11-19 18:25:23.885551+07
34	2026-10	2889	2993	337	357	2026-11-19 18:25:23.885551+07
35	2026-10	3163	3271	346	364	2026-11-19 18:25:23.885551+07
36	2026-10	3117	3407	283	321	2026-11-19 18:25:23.885551+07
37	2026-10	3088	3218	157	177	2026-11-19 18:25:23.885551+07
38	2026-10	3448	3663	353	380	2026-11-19 18:25:23.885551+07
39	2026-10	3292	3318	396	400	2026-11-19 18:25:23.885551+07
40	2026-10	3496	3768	259	303	2026-11-19 18:25:23.885551+07
41	2026-10	2012	2068	248	256	2026-11-19 18:25:23.885551+07
42	2026-10	2672	2780	245	257	2026-11-19 18:25:23.885551+07
43	2026-10	1927	2005	346	358	2026-11-19 18:25:23.885551+07
44	2026-10	1964	2120	287	303	2026-11-19 18:25:23.885551+07
1	2026-11	2180	2368	285	299	2026-11-19 18:25:23.885551+07
2	2026-11	2680	2864	411	425	2026-11-19 18:25:23.885551+07
3	2026-11	1874	1919	387	392	2026-11-19 18:25:23.885551+07
4	2026-11	2660	2832	416	442	2026-11-19 18:25:23.885551+07
5	2026-11	1867	2087	290	312	2026-11-19 18:25:23.885551+07
6	2026-11	2678	2938	416	436	2026-11-19 18:25:23.885551+07
7	2026-11	3690	3990	310	340	2026-11-19 18:25:23.885551+07
8	2026-11	3834	4076	206	238	2026-11-19 18:25:23.885551+07
9	2026-11	3596	3716	379	395	2026-11-19 18:25:23.885551+07
10	2026-11	3199	3279	363	371	2026-11-19 18:25:23.885551+07
11	2026-11	3062	3102	225	230	2026-11-19 18:25:23.885551+07
12	2026-11	2384	2596	271	291	2026-11-19 18:25:23.885551+07
13	2026-11	1867	2047	271	283	2026-11-19 18:25:23.885551+07
14	2026-11	3747	3891	211	233	2026-11-19 18:25:23.885551+07
15	2026-11	3280	3306	224	230	2026-11-19 18:25:23.885551+07
16	2026-11	2109	2393	413	433	2026-11-19 18:25:23.885551+07
17	2026-11	2445	2501	409	419	2026-11-19 18:25:23.885551+07
20	2026-11	2714	2934	381	396	2026-11-19 18:25:23.885551+07
21	2026-11	2502	2688	301	325	2026-11-19 18:25:23.885551+07
25	2026-11	2740	2884	276	302	2026-11-19 18:25:23.885551+07
26	2026-11	2252	2408	288	302	2026-11-19 18:25:23.885551+07
27	2026-11	3581	3626	201	207	2026-11-19 18:25:23.885551+07
28	2026-11	3490	3730	173	190	2026-11-19 18:25:23.885551+07
29	2026-11	2554	2709	263	295	2026-11-19 18:25:23.885551+07
30	2026-11	2279	2485	228	260	2026-11-19 18:25:23.885551+07
31	2026-11	3714	3908	418	450	2026-11-19 18:25:23.885551+07
32	2026-11	3725	4060	333	377	2026-11-19 18:25:23.885551+07
33	2026-11	2039	2183	172	192	2026-11-19 18:25:23.885551+07
34	2026-11	2993	3142	357	374	2026-11-19 18:25:23.885551+07
35	2026-11	3271	3364	364	379	2026-11-19 18:25:23.885551+07
36	2026-11	3407	3655	321	353	2026-11-19 18:25:23.885551+07
37	2026-11	3218	3418	177	197	2026-11-19 18:25:23.885551+07
38	2026-11	3663	3843	380	407	2026-11-19 18:25:23.885551+07
39	2026-11	3318	3350	400	406	2026-11-19 18:25:23.885551+07
40	2026-11	3768	4012	303	326	2026-11-19 18:25:23.885551+07
41	2026-11	2068	2148	256	262	2026-11-19 18:25:23.885551+07
\.


--
-- Data for Name: don_gia; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.don_gia (ma_dg, loai, don_gia, ap_dung_tu) FROM stdin;
1	DIEN	3200	2026-01-01 00:00:00+07
2	NUOC	14000	2026-01-01 00:00:00+07
3	DIEN	3500	2026-08-01 00:00:00+07
4	NUOC	15000	2026-08-01 00:00:00+07
\.


--
-- Data for Name: hoa_don; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.hoa_don (ma_hoa_don, ma_phong, ma_ky, thang, loai, tien_dien, tien_nuoc, so_tien, han_nop, trang_thai, da_gui_thong_bao, ngay_tao) FROM stdin;
1	1	HK1_2026_2027	KY	KTX	0	0	2800000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
2	2	HK1_2026_2027	KY	KTX	0	0	2800000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
3	3	HK1_2026_2027	KY	KTX	0	0	2800000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
4	4	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
5	5	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
9	9	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
10	10	HK1_2026_2027	KY	KTX	0	0	2800000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
12	12	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
13	13	HK1_2026_2027	KY	KTX	0	0	3000000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
14	14	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
16	16	HK1_2026_2027	KY	KTX	0	0	3600000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
17	17	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
19	19	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
21	21	HK1_2026_2027	KY	KTX	0	0	3000000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
22	25	HK1_2026_2027	KY	KTX	0	0	2800000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
23	26	HK1_2026_2027	KY	KTX	0	0	2800000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
25	28	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
28	31	HK1_2026_2027	KY	KTX	0	0	3600000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
33	36	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
36	39	HK1_2026_2027	KY	KTX	0	0	3200000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
37	40	HK1_2026_2027	KY	KTX	0	0	3600000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
38	41	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
39	42	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
40	43	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
6	6	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
7	7	HK1_2026_2027	KY	KTX	0	0	3600000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
8	8	HK1_2026_2027	KY	KTX	0	0	3600000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
11	11	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
15	15	HK1_2026_2027	KY	KTX	0	0	3200000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
18	18	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
20	20	HK1_2026_2027	KY	KTX	0	0	3000000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
24	27	HK1_2026_2027	KY	KTX	0	0	2800000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
26	29	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
27	30	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
29	32	HK1_2026_2027	KY	KTX	0	0	3600000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
30	33	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
31	34	HK1_2026_2027	KY	KTX	0	0	2800000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
32	35	HK1_2026_2027	KY	KTX	0	0	2400000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
34	37	HK1_2026_2027	KY	KTX	0	0	3000000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
35	38	HK1_2026_2027	KY	KTX	0	0	3400000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
41	44	HK1_2026_2027	KY	KTX	0	0	3000000	2026-12-09	DA_NOP	f	2026-11-19 18:25:23.885551+07
124	1	HK1_2026_2027	2026-11	DIEN_NUOC	658000	210000	868000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
125	2	HK1_2026_2027	2026-11	DIEN_NUOC	644000	210000	854000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
126	3	HK1_2026_2027	2026-11	DIEN_NUOC	157500	75000	232500	2026-12-01	DA_NOP	f	2026-11-19 18:25:23.885551+07
127	4	HK1_2026_2027	2026-11	DIEN_NUOC	602000	390000	992000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
128	5	HK1_2026_2027	2026-11	DIEN_NUOC	770000	330000	1100000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
129	6	HK1_2026_2027	2026-11	DIEN_NUOC	910000	300000	1210000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
130	7	HK1_2026_2027	2026-11	DIEN_NUOC	1050000	450000	1500000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
131	8	HK1_2026_2027	2026-11	DIEN_NUOC	847000	480000	1327000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
132	9	HK1_2026_2027	2026-11	DIEN_NUOC	420000	240000	660000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
133	10	HK1_2026_2027	2026-11	DIEN_NUOC	280000	120000	400000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
134	11	HK1_2026_2027	2026-11	DIEN_NUOC	140000	75000	215000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
135	12	HK1_2026_2027	2026-11	DIEN_NUOC	742000	300000	1042000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
136	13	HK1_2026_2027	2026-11	DIEN_NUOC	630000	180000	810000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
137	14	HK1_2026_2027	2026-11	DIEN_NUOC	504000	330000	834000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
138	15	HK1_2026_2027	2026-11	DIEN_NUOC	91000	90000	181000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
139	16	HK1_2026_2027	2026-11	DIEN_NUOC	994000	300000	1294000	2026-12-01	DA_NOP	f	2026-11-19 18:25:23.885551+07
140	17	HK1_2026_2027	2026-11	DIEN_NUOC	196000	150000	346000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
141	20	HK1_2026_2027	2026-11	DIEN_NUOC	770000	225000	995000	2026-12-01	DA_NOP	f	2026-11-19 18:25:23.885551+07
142	21	HK1_2026_2027	2026-11	DIEN_NUOC	651000	360000	1011000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
143	25	HK1_2026_2027	2026-11	DIEN_NUOC	504000	390000	894000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
144	26	HK1_2026_2027	2026-11	DIEN_NUOC	546000	210000	756000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
145	27	HK1_2026_2027	2026-11	DIEN_NUOC	157500	90000	247500	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
146	28	HK1_2026_2027	2026-11	DIEN_NUOC	840000	255000	1095000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
147	29	HK1_2026_2027	2026-11	DIEN_NUOC	542500	480000	1022500	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
148	30	HK1_2026_2027	2026-11	DIEN_NUOC	721000	480000	1201000	2026-12-01	DA_NOP	f	2026-11-19 18:25:23.885551+07
149	31	HK1_2026_2027	2026-11	DIEN_NUOC	679000	480000	1159000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
150	32	HK1_2026_2027	2026-11	DIEN_NUOC	1172500	660000	1832500	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
151	33	HK1_2026_2027	2026-11	DIEN_NUOC	504000	300000	804000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
152	34	HK1_2026_2027	2026-11	DIEN_NUOC	521500	255000	776500	2026-12-01	DA_NOP	f	2026-11-19 18:25:23.885551+07
153	35	HK1_2026_2027	2026-11	DIEN_NUOC	325500	225000	550500	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
154	36	HK1_2026_2027	2026-11	DIEN_NUOC	868000	480000	1348000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
155	37	HK1_2026_2027	2026-11	DIEN_NUOC	700000	300000	1000000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
156	38	HK1_2026_2027	2026-11	DIEN_NUOC	630000	405000	1035000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
157	39	HK1_2026_2027	2026-11	DIEN_NUOC	112000	90000	202000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
158	40	HK1_2026_2027	2026-11	DIEN_NUOC	854000	345000	1199000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
159	41	HK1_2026_2027	2026-11	DIEN_NUOC	280000	90000	370000	2026-12-01	CHUA_NOP	f	2026-11-19 18:25:23.885551+07
42	1	HK1_2026_2027	2026-09	DIEN_NUOC	546000	210000	756000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
43	2	HK1_2026_2027	2026-09	DIEN_NUOC	700000	270000	970000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
44	3	HK1_2026_2027	2026-09	DIEN_NUOC	210000	120000	330000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
45	4	HK1_2026_2027	2026-09	DIEN_NUOC	504000	270000	774000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
46	5	HK1_2026_2027	2026-09	DIEN_NUOC	822500	480000	1302500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
47	6	HK1_2026_2027	2026-09	DIEN_NUOC	721000	300000	1021000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
48	7	HK1_2026_2027	2026-09	DIEN_NUOC	1148000	345000	1493000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
49	8	HK1_2026_2027	2026-09	DIEN_NUOC	763000	300000	1063000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
50	9	HK1_2026_2027	2026-09	DIEN_NUOC	406000	300000	706000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
51	10	HK1_2026_2027	2026-09	DIEN_NUOC	336000	180000	516000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
52	11	HK1_2026_2027	2026-09	DIEN_NUOC	108500	60000	168500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
53	12	HK1_2026_2027	2026-09	DIEN_NUOC	595000	480000	1075000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
54	13	HK1_2026_2027	2026-09	DIEN_NUOC	476000	180000	656000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
55	14	HK1_2026_2027	2026-09	DIEN_NUOC	546000	270000	816000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
56	15	HK1_2026_2027	2026-09	DIEN_NUOC	157500	45000	202500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
57	16	HK1_2026_2027	2026-09	DIEN_NUOC	616000	570000	1186000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
58	17	HK1_2026_2027	2026-09	DIEN_NUOC	196000	90000	286000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
59	18	HK1_2026_2027	2026-09	DIEN_NUOC	602000	240000	842000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
60	19	HK1_2026_2027	2026-09	DIEN_NUOC	224000	150000	374000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
61	20	HK1_2026_2027	2026-09	DIEN_NUOC	787500	300000	1087500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
62	21	HK1_2026_2027	2026-09	DIEN_NUOC	693000	540000	1233000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
63	25	HK1_2026_2027	2026-09	DIEN_NUOC	602000	330000	932000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
64	26	HK1_2026_2027	2026-09	DIEN_NUOC	560000	210000	770000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
65	27	HK1_2026_2027	2026-09	DIEN_NUOC	196000	120000	316000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
66	28	HK1_2026_2027	2026-09	DIEN_NUOC	612500	405000	1017500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
67	29	HK1_2026_2027	2026-09	DIEN_NUOC	612500	405000	1017500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
68	30	HK1_2026_2027	2026-09	DIEN_NUOC	700000	390000	1090000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
69	31	HK1_2026_2027	2026-09	DIEN_NUOC	952000	300000	1252000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
70	32	HK1_2026_2027	2026-09	DIEN_NUOC	1148000	345000	1493000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
71	33	HK1_2026_2027	2026-09	DIEN_NUOC	378000	240000	618000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
72	34	HK1_2026_2027	2026-09	DIEN_NUOC	437500	165000	602500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
73	35	HK1_2026_2027	2026-09	DIEN_NUOC	399000	180000	579000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
74	36	HK1_2026_2027	2026-09	DIEN_NUOC	742000	300000	1042000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
75	37	HK1_2026_2027	2026-09	DIEN_NUOC	682500	225000	907500	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
76	38	HK1_2026_2027	2026-09	DIEN_NUOC	770000	480000	1250000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
77	39	HK1_2026_2027	2026-09	DIEN_NUOC	140000	60000	200000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
78	40	HK1_2026_2027	2026-09	DIEN_NUOC	1025500	555000	1580500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
79	41	HK1_2026_2027	2026-09	DIEN_NUOC	287000	150000	437000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
80	42	HK1_2026_2027	2026-09	DIEN_NUOC	574000	360000	934000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
81	43	HK1_2026_2027	2026-09	DIEN_NUOC	399000	270000	669000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
82	44	HK1_2026_2027	2026-09	DIEN_NUOC	588000	240000	828000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
83	1	HK1_2026_2027	2026-10	DIEN_NUOC	476000	330000	806000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
84	2	HK1_2026_2027	2026-10	DIEN_NUOC	560000	210000	770000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
85	3	HK1_2026_2027	2026-10	DIEN_NUOC	227500	90000	317500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
86	4	HK1_2026_2027	2026-10	DIEN_NUOC	560000	390000	950000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
87	5	HK1_2026_2027	2026-10	DIEN_NUOC	577500	480000	1057500	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
88	6	HK1_2026_2027	2026-10	DIEN_NUOC	595000	390000	985000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
89	7	HK1_2026_2027	2026-10	DIEN_NUOC	756000	345000	1101000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
90	8	HK1_2026_2027	2026-10	DIEN_NUOC	784000	480000	1264000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
91	9	HK1_2026_2027	2026-10	DIEN_NUOC	616000	240000	856000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
92	10	HK1_2026_2027	2026-10	DIEN_NUOC	280000	210000	490000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
93	11	HK1_2026_2027	2026-10	DIEN_NUOC	133000	75000	208000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
94	12	HK1_2026_2027	2026-10	DIEN_NUOC	637000	480000	1117000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
95	13	HK1_2026_2027	2026-10	DIEN_NUOC	420000	360000	780000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
96	14	HK1_2026_2027	2026-10	DIEN_NUOC	420000	390000	810000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
97	15	HK1_2026_2027	2026-10	DIEN_NUOC	91000	60000	151000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
98	16	HK1_2026_2027	2026-10	DIEN_NUOC	910000	390000	1300000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
99	17	HK1_2026_2027	2026-10	DIEN_NUOC	189000	90000	279000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
100	18	HK1_2026_2027	2026-10	DIEN_NUOC	546000	360000	906000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
101	19	HK1_2026_2027	2026-10	DIEN_NUOC	189000	120000	309000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
102	20	HK1_2026_2027	2026-10	DIEN_NUOC	507500	300000	807500	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
103	21	HK1_2026_2027	2026-10	DIEN_NUOC	672000	270000	942000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
104	25	HK1_2026_2027	2026-10	DIEN_NUOC	504000	210000	714000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
105	26	HK1_2026_2027	2026-10	DIEN_NUOC	546000	270000	816000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
106	27	HK1_2026_2027	2026-10	DIEN_NUOC	164500	75000	239500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
107	28	HK1_2026_2027	2026-10	DIEN_NUOC	770000	255000	1025000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
108	29	HK1_2026_2027	2026-10	DIEN_NUOC	612500	480000	1092500	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
109	30	HK1_2026_2027	2026-10	DIEN_NUOC	616000	300000	916000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
110	31	HK1_2026_2027	2026-10	DIEN_NUOC	595000	390000	985000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
111	32	HK1_2026_2027	2026-10	DIEN_NUOC	1001000	555000	1556000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
112	33	HK1_2026_2027	2026-10	DIEN_NUOC	378000	240000	618000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
113	34	HK1_2026_2027	2026-10	DIEN_NUOC	364000	300000	664000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
114	35	HK1_2026_2027	2026-10	DIEN_NUOC	378000	270000	648000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
115	36	HK1_2026_2027	2026-10	DIEN_NUOC	1015000	570000	1585000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
116	37	HK1_2026_2027	2026-10	DIEN_NUOC	455000	300000	755000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
117	38	HK1_2026_2027	2026-10	DIEN_NUOC	752500	405000	1157500	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
118	39	HK1_2026_2027	2026-10	DIEN_NUOC	91000	60000	151000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
119	40	HK1_2026_2027	2026-10	DIEN_NUOC	952000	660000	1612000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
120	41	HK1_2026_2027	2026-10	DIEN_NUOC	196000	120000	316000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
121	42	HK1_2026_2027	2026-10	DIEN_NUOC	378000	180000	558000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
122	43	HK1_2026_2027	2026-10	DIEN_NUOC	273000	180000	453000	2026-12-01	DA_NOP	t	2026-11-19 18:25:23.885551+07
123	44	HK1_2026_2027	2026-10	DIEN_NUOC	546000	240000	786000	2026-12-01	CHUA_NOP	t	2026-11-19 18:25:23.885551+07
\.


--
-- Data for Name: hop_dong; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.hop_dong (ma_hd, ma_phong, ma_ky, mssv_dai_dien, ngay_ky, trang_thai) FROM stdin;
1	1	HK1_2026_2027	B2100001	2026-08-23	HIEU_LUC
2	2	HK1_2026_2027	B2100009	2026-08-27	HIEU_LUC
3	3	HK1_2026_2027	B2100017	2026-08-20	HIEU_LUC
4	4	HK1_2026_2027	B2100019	2026-08-29	HIEU_LUC
5	5	HK1_2026_2027	B2100002	2026-08-20	HIEU_LUC
6	6	HK1_2026_2027	B2100012	2026-08-28	HIEU_LUC
7	7	HK1_2026_2027	B2100024	2026-08-20	HIEU_LUC
8	8	HK1_2026_2027	B2100038	2026-08-28	HIEU_LUC
9	9	HK1_2026_2027	B2100027	2026-08-27	HIEU_LUC
10	10	HK1_2026_2027	B2100035	2026-08-25	HIEU_LUC
11	11	HK1_2026_2027	B2100039	2026-08-29	HIEU_LUC
12	13	HK1_2026_2027	B2100050	2026-08-22	HIEU_LUC
13	14	HK1_2026_2027	B2200058	2026-08-29	HIEU_LUC
14	15	HK1_2026_2027	B2200066	2026-08-26	HIEU_LUC
15	16	HK1_2026_2027	B2200068	2026-08-29	HIEU_LUC
16	18	HK1_2026_2027	B2200057	2026-08-30	HIEU_LUC
17	19	HK1_2026_2027	B2200065	2026-08-27	HIEU_LUC
18	20	HK1_2026_2027	B2200069	2026-08-22	HIEU_LUC
19	21	HK1_2026_2027	B2200080	2026-08-25	HIEU_LUC
20	25	HK1_2026_2027	B2200092	2026-08-23	HIEU_LUC
21	26	HK1_2026_2027	B2200100	2026-08-30	HIEU_LUC
22	27	HK1_2026_2027	B2200108	2026-08-21	HIEU_LUC
23	28	HK1_2026_2027	B2200110	2026-08-30	HIEU_LUC
24	29	HK1_2026_2027	B2200079	2026-08-23	HIEU_LUC
25	30	HK1_2026_2027	B2200089	2026-08-27	HIEU_LUC
26	31	HK1_2026_2027	B2200101	2026-08-23	HIEU_LUC
27	32	HK1_2026_2027	B2300113	2026-08-22	HIEU_LUC
28	33	HK1_2026_2027	B2300120	2026-08-30	HIEU_LUC
29	34	HK1_2026_2027	B2300128	2026-08-29	HIEU_LUC
30	35	HK1_2026_2027	B2300134	2026-08-29	HIEU_LUC
31	37	HK1_2026_2027	B2300127	2026-08-22	HIEU_LUC
32	38	HK1_2026_2027	B2300137	2026-08-22	HIEU_LUC
33	39	HK1_2026_2027	B2300147	2026-08-24	HIEU_LUC
34	40	HK1_2026_2027	B2300149	2026-08-23	HIEU_LUC
35	43	HK1_2026_2027	B2300164	2026-08-24	HIEU_LUC
36	44	HK1_2026_2027	B2400170	2026-08-22	HIEU_LUC
\.


--
-- Data for Name: khu; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.khu (ma_khu, ten_khu) FROM stdin;
A	Khu A
B	Khu B
\.


--
-- Data for Name: ky_hoc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ky_hoc (ma_ky, ten_ky, ngay_bat_dau, ngay_ket_thuc, dang_hien_hanh) FROM stdin;
HK2_2025_2026	Học kỳ 2 (2025 - 2026)	2026-01-12	2026-06-30	f
HK1_2026_2027	Học kỳ 1 (2026 - 2027)	2026-08-17	2026-12-31	t
\.


--
-- Data for Name: luot_ra_vao; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.luot_ra_vao (ma_luot, mssv, loai, thoi_gian) FROM stdin;
1	B2400172	RA	2026-11-13 09:38:00+07
2	B2400172	VAO	2026-11-13 17:34:00+07
3	B2300160	RA	2026-11-13 06:52:00+07
4	B2300160	VAO	2026-11-13 13:18:00+07
5	B2100010	RA	2026-11-13 13:47:00+07
6	B2100010	VAO	2026-11-13 20:18:00+07
7	B2200065	RA	2026-11-13 09:57:00+07
8	B2200065	VAO	2026-11-13 18:23:00+07
9	B2100029	RA	2026-11-13 06:44:00+07
10	B2100029	VAO	2026-11-13 18:25:00+07
11	B2300137	RA	2026-11-13 09:08:00+07
12	B2300137	VAO	2026-11-13 19:24:00+07
13	B2300147	RA	2026-11-13 13:54:00+07
14	B2300147	VAO	2026-11-13 20:09:00+07
15	B2100039	RA	2026-11-13 09:49:00+07
16	B2100039	VAO	2026-11-13 12:53:00+07
17	B2200063	RA	2026-11-13 12:24:00+07
18	B2200063	VAO	2026-11-13 15:54:00+07
19	B2200110	RA	2026-11-13 06:46:00+07
20	B2200110	VAO	2026-11-13 12:33:00+07
21	B2100055	RA	2026-11-13 08:18:00+07
22	B2100055	VAO	2026-11-13 14:22:00+07
23	B2100022	RA	2026-11-13 09:06:00+07
24	B2100022	VAO	2026-11-13 21:37:00+07
25	B2200087	RA	2026-11-13 11:15:00+07
26	B2200087	VAO	2026-11-13 15:08:00+07
27	B2100019	RA	2026-11-13 06:26:00+07
28	B2100019	VAO	2026-11-13 20:02:00+07
29	B2300127	RA	2026-11-13 06:02:00+07
30	B2300127	VAO	2026-11-13 21:09:00+07
31	B2200068	RA	2026-11-13 07:37:00+07
32	B2200068	VAO	2026-11-13 16:15:00+07
33	B2100017	RA	2026-11-13 12:51:00+07
34	B2100017	VAO	2026-11-13 21:55:00+07
35	B2300113	RA	2026-11-13 11:12:00+07
36	B2300113	VAO	2026-11-13 21:26:00+07
37	B2300119	RA	2026-11-13 09:36:00+07
38	B2300119	VAO	2026-11-13 14:48:00+07
39	B2300129	RA	2026-11-13 13:59:00+07
40	B2300129	VAO	2026-11-13 21:18:00+07
41	B2200073	RA	2026-11-13 08:54:00+07
42	B2200073	VAO	2026-11-13 19:26:00+07
43	B2200094	RA	2026-11-13 08:12:00+07
44	B2200094	VAO	2026-11-13 19:56:00+07
45	B2300111	RA	2026-11-13 07:51:00+07
46	B2300111	VAO	2026-11-13 19:38:00+07
47	B2300153	RA	2026-11-13 08:46:00+07
48	B2300153	VAO	2026-11-13 16:30:00+07
49	B2200093	RA	2026-11-13 06:44:00+07
50	B2200093	VAO	2026-11-13 11:09:00+07
51	B2200097	RA	2026-11-13 10:14:00+07
52	B2200097	VAO	2026-11-13 21:20:00+07
53	B2200096	RA	2026-11-13 12:39:00+07
54	B2200096	VAO	2026-11-13 17:21:00+07
55	B2200095	RA	2026-11-13 10:13:00+07
56	B2200095	VAO	2026-11-13 12:39:00+07
57	B2100020	RA	2026-11-13 06:32:00+07
58	B2100020	VAO	2026-11-13 12:52:00+07
59	B2200075	RA	2026-11-13 13:08:00+07
60	B2200075	VAO	2026-11-13 15:20:00+07
61	B2100053	RA	2026-11-13 09:28:00+07
62	B2100053	VAO	2026-11-13 20:44:00+07
63	B2200059	RA	2026-11-13 11:26:00+07
64	B2200059	VAO	2026-11-13 19:30:00+07
65	B2100045	RA	2026-11-13 12:57:00+07
66	B2100045	VAO	2026-11-13 16:02:00+07
67	B2200060	RA	2026-11-13 11:45:00+07
68	B2200060	VAO	2026-11-13 20:34:00+07
69	B2300134	RA	2026-11-13 06:06:00+07
70	B2300134	VAO	2026-11-13 12:59:00+07
71	B2100002	RA	2026-11-13 10:47:00+07
72	B2100002	VAO	2026-11-13 17:33:00+07
73	B2200091	RA	2026-11-13 13:23:00+07
74	B2200091	VAO	2026-11-13 18:35:00+07
75	B2200083	RA	2026-11-13 06:33:00+07
76	B2200083	VAO	2026-11-13 18:31:00+07
77	B2200062	RA	2026-11-13 08:32:00+07
78	B2200062	VAO	2026-11-13 14:26:00+07
79	B2100041	RA	2026-11-13 06:31:00+07
80	B2100041	VAO	2026-11-13 13:56:00+07
81	B2100032	RA	2026-11-13 06:50:00+07
82	B2100032	VAO	2026-11-13 21:13:00+07
83	B2400168	RA	2026-11-13 07:10:00+07
84	B2400168	VAO	2026-11-13 20:09:00+07
85	B2100014	RA	2026-11-13 07:06:00+07
86	B2100014	VAO	2026-11-13 13:56:00+07
87	B2300130	RA	2026-11-13 11:35:00+07
88	B2300130	VAO	2026-11-13 19:35:00+07
89	B2100037	RA	2026-11-13 11:48:00+07
90	B2100037	VAO	2026-11-13 17:38:00+07
91	B2300162	RA	2026-11-13 13:51:00+07
92	B2300162	VAO	2026-11-13 16:09:00+07
93	B2400174	RA	2026-11-13 11:23:00+07
94	B2400174	VAO	2026-11-13 19:13:00+07
95	B2300159	RA	2026-11-13 06:52:00+07
96	B2300159	VAO	2026-11-13 21:22:00+07
97	B2200092	RA	2026-11-13 08:46:00+07
98	B2200092	VAO	2026-11-13 19:29:00+07
99	B2300122	RA	2026-11-13 12:37:00+07
100	B2300122	VAO	2026-11-13 15:20:00+07
101	B2300143	RA	2026-11-13 12:14:00+07
102	B2300143	VAO	2026-11-13 16:06:00+07
103	B2100023	RA	2026-11-13 10:13:00+07
104	B2100023	VAO	2026-11-13 14:50:00+07
105	B2300157	RA	2026-11-13 07:12:00+07
106	B2300157	VAO	2026-11-13 19:47:00+07
107	B2300123	RA	2026-11-13 06:13:00+07
108	B2300123	VAO	2026-11-13 18:13:00+07
109	B2100042	RA	2026-11-13 10:07:00+07
110	B2100042	VAO	2026-11-13 15:38:00+07
111	B2100028	RA	2026-11-13 08:04:00+07
112	B2100028	VAO	2026-11-13 21:47:00+07
113	B2300124	RA	2026-11-13 06:20:00+07
114	B2300124	VAO	2026-11-13 14:17:00+07
115	B2200074	RA	2026-11-13 08:15:00+07
116	B2200074	VAO	2026-11-13 17:41:00+07
117	B2300144	RA	2026-11-13 11:09:00+07
118	B2300144	VAO	2026-11-13 17:44:00+07
119	B2100030	RA	2026-11-13 06:32:00+07
120	B2100030	VAO	2026-11-13 19:29:00+07
121	B2200088	RA	2026-11-13 06:46:00+07
122	B2200088	VAO	2026-11-13 14:24:00+07
123	B2300140	RA	2026-11-13 11:00:00+07
124	B2300140	VAO	2026-11-13 21:17:00+07
125	B2300154	RA	2026-11-13 12:02:00+07
126	B2300154	VAO	2026-11-13 20:19:00+07
127	B2100034	RA	2026-11-13 13:11:00+07
128	B2100034	VAO	2026-11-13 18:58:00+07
129	B2200098	RA	2026-11-13 12:26:00+07
130	B2200098	VAO	2026-11-13 14:04:00+07
131	B2200101	RA	2026-11-14 11:07:00+07
132	B2200101	VAO	2026-11-14 18:26:00+07
133	B2300147	RA	2026-11-14 13:33:00+07
134	B2300147	VAO	2026-11-14 21:28:00+07
135	B2200075	RA	2026-11-14 06:30:00+07
136	B2200075	VAO	2026-11-14 15:51:00+07
137	B2100051	RA	2026-11-14 09:52:00+07
138	B2100051	VAO	2026-11-14 20:10:00+07
139	B2100047	RA	2026-11-14 06:02:00+07
140	B2100047	VAO	2026-11-14 20:42:00+07
141	B2200108	RA	2026-11-14 09:14:00+07
142	B2200108	VAO	2026-11-14 14:12:00+07
143	B2100016	RA	2026-11-14 10:12:00+07
144	B2100016	VAO	2026-11-14 21:57:00+07
145	B2100006	RA	2026-11-14 13:28:00+07
146	B2100006	VAO	2026-11-14 21:25:00+07
147	B2300148	RA	2026-11-14 07:20:00+07
148	B2300148	VAO	2026-11-14 12:08:00+07
149	B2300117	RA	2026-11-14 10:49:00+07
150	B2300117	VAO	2026-11-14 14:17:00+07
151	B2200069	RA	2026-11-14 07:53:00+07
152	B2200069	VAO	2026-11-14 11:33:00+07
153	B2300135	RA	2026-11-14 07:08:00+07
154	B2300135	VAO	2026-11-14 18:19:00+07
155	B2300156	RA	2026-11-14 12:49:00+07
156	B2300156	VAO	2026-11-14 14:54:00+07
157	B2200086	RA	2026-11-14 07:49:00+07
158	B2200086	VAO	2026-11-14 12:33:00+07
159	B2300155	RA	2026-11-14 06:05:00+07
160	B2300155	VAO	2026-11-14 13:07:00+07
161	B2300153	RA	2026-11-14 11:04:00+07
162	B2300153	VAO	2026-11-14 15:31:00+07
163	B2300151	RA	2026-11-14 06:55:00+07
164	B2300151	VAO	2026-11-14 20:33:00+07
165	B2200104	RA	2026-11-14 12:00:00+07
166	B2200104	VAO	2026-11-14 20:21:00+07
167	B2200059	RA	2026-11-14 09:48:00+07
168	B2200059	VAO	2026-11-14 16:03:00+07
169	B2200102	RA	2026-11-14 10:16:00+07
170	B2200102	VAO	2026-11-14 13:15:00+07
171	B2300146	RA	2026-11-14 07:36:00+07
172	B2300146	VAO	2026-11-14 17:29:00+07
173	B2200089	RA	2026-11-14 10:20:00+07
174	B2200089	VAO	2026-11-14 12:22:00+07
175	B2200098	RA	2026-11-14 12:27:00+07
176	B2200098	VAO	2026-11-14 21:56:00+07
177	B2300119	RA	2026-11-14 11:18:00+07
178	B2300119	VAO	2026-11-14 16:58:00+07
179	B2300112	RA	2026-11-14 08:10:00+07
180	B2300112	VAO	2026-11-14 20:17:00+07
181	B2100014	RA	2026-11-14 07:16:00+07
182	B2100014	VAO	2026-11-14 21:11:00+07
183	B2100019	RA	2026-11-14 09:03:00+07
184	B2100019	VAO	2026-11-14 20:19:00+07
185	B2300134	RA	2026-11-14 13:17:00+07
186	B2300134	VAO	2026-11-14 15:14:00+07
187	B2200063	RA	2026-11-14 08:01:00+07
188	B2200063	VAO	2026-11-14 16:10:00+07
189	B2300154	RA	2026-11-14 12:31:00+07
190	B2300154	VAO	2026-11-14 18:54:00+07
191	B2200084	RA	2026-11-14 08:58:00+07
192	B2200084	VAO	2026-11-14 17:28:00+07
193	B2100043	RA	2026-11-14 13:32:00+07
194	B2100043	VAO	2026-11-14 20:44:00+07
195	B2100018	RA	2026-11-14 11:37:00+07
196	B2100018	VAO	2026-11-14 21:18:00+07
197	B2100007	RA	2026-11-14 09:53:00+07
198	B2100007	VAO	2026-11-14 12:53:00+07
199	B2300142	RA	2026-11-14 07:22:00+07
200	B2300142	VAO	2026-11-14 14:44:00+07
201	B2300149	RA	2026-11-14 12:29:00+07
202	B2300149	VAO	2026-11-14 18:16:00+07
203	B2300122	RA	2026-11-14 13:34:00+07
204	B2300122	VAO	2026-11-14 20:20:00+07
205	B2300150	RA	2026-11-14 11:56:00+07
206	B2300150	VAO	2026-11-14 16:53:00+07
207	B2100042	RA	2026-11-14 13:26:00+07
208	B2100042	VAO	2026-11-14 21:33:00+07
209	B2300136	RA	2026-11-14 10:55:00+07
210	B2300136	VAO	2026-11-14 21:00:00+07
211	B2100048	RA	2026-11-14 13:06:00+07
212	B2100048	VAO	2026-11-14 19:35:00+07
213	B2200106	RA	2026-11-14 06:10:00+07
214	B2200106	VAO	2026-11-14 16:33:00+07
215	B2100003	RA	2026-11-14 09:47:00+07
216	B2100003	VAO	2026-11-14 19:27:00+07
217	B2300124	RA	2026-11-14 11:05:00+07
218	B2300124	VAO	2026-11-14 20:35:00+07
219	B2300128	RA	2026-11-14 11:35:00+07
220	B2300128	VAO	2026-11-14 14:01:00+07
221	B2200097	RA	2026-11-14 07:25:00+07
222	B2200097	VAO	2026-11-14 15:11:00+07
223	B2100032	RA	2026-11-14 06:39:00+07
224	B2100032	VAO	2026-11-14 14:48:00+07
225	B2100013	RA	2026-11-14 09:43:00+07
226	B2100013	VAO	2026-11-14 13:50:00+07
227	B2300132	RA	2026-11-14 06:47:00+07
228	B2300132	VAO	2026-11-14 11:11:00+07
229	B2300139	RA	2026-11-14 09:01:00+07
230	B2300139	VAO	2026-11-14 18:12:00+07
231	B2100031	RA	2026-11-14 08:20:00+07
232	B2100031	VAO	2026-11-14 18:44:00+07
233	B2100044	RA	2026-11-14 08:43:00+07
234	B2100044	VAO	2026-11-14 18:37:00+07
235	B2100039	RA	2026-11-14 06:04:00+07
236	B2100039	VAO	2026-11-14 14:38:00+07
237	B2200072	RA	2026-11-14 09:51:00+07
238	B2200072	VAO	2026-11-14 13:09:00+07
239	B2300133	RA	2026-11-14 13:53:00+07
240	B2300133	VAO	2026-11-14 15:14:00+07
241	B2100009	RA	2026-11-14 07:32:00+07
242	B2100009	VAO	2026-11-14 17:39:00+07
243	B2200082	RA	2026-11-14 09:43:00+07
244	B2200082	VAO	2026-11-14 17:29:00+07
245	B2200105	RA	2026-11-14 13:43:00+07
246	B2200105	VAO	2026-11-14 15:50:00+07
247	B2100037	RA	2026-11-14 12:24:00+07
248	B2100037	VAO	2026-11-14 18:48:00+07
249	B2100054	RA	2026-11-14 13:36:00+07
250	B2100054	VAO	2026-11-14 16:06:00+07
251	B2100050	RA	2026-11-14 09:58:00+07
252	B2100050	VAO	2026-11-14 15:02:00+07
253	B2300118	RA	2026-11-14 07:01:00+07
254	B2300118	VAO	2026-11-14 11:05:00+07
255	B2300145	RA	2026-11-14 11:02:00+07
256	B2300145	VAO	2026-11-14 15:54:00+07
257	B2100052	RA	2026-11-14 11:29:00+07
258	B2100052	VAO	2026-11-14 21:38:00+07
259	B2300141	RA	2026-11-14 09:12:00+07
260	B2300141	VAO	2026-11-14 16:32:00+07
261	B2200106	RA	2026-11-15 12:03:00+07
262	B2200106	VAO	2026-11-15 14:45:00+07
263	B2200085	RA	2026-11-15 12:54:00+07
264	B2200085	VAO	2026-11-15 15:10:00+07
265	B2100047	RA	2026-11-15 10:07:00+07
266	B2100047	VAO	2026-11-15 13:01:00+07
267	B2200083	RA	2026-11-15 07:14:00+07
268	B2200083	VAO	2026-11-15 13:10:00+07
269	B2400170	RA	2026-11-15 09:54:00+07
270	B2400170	VAO	2026-11-15 16:19:00+07
271	B2100030	RA	2026-11-15 10:32:00+07
272	B2100030	VAO	2026-11-15 13:56:00+07
273	B2300140	RA	2026-11-15 07:45:00+07
274	B2300140	VAO	2026-11-15 12:26:00+07
275	B2200077	RA	2026-11-15 06:52:00+07
276	B2200077	VAO	2026-11-15 11:07:00+07
277	B2300113	RA	2026-11-15 12:37:00+07
278	B2300113	VAO	2026-11-15 21:41:00+07
279	B2200108	RA	2026-11-15 09:27:00+07
280	B2200108	VAO	2026-11-15 12:43:00+07
281	B2200096	RA	2026-11-15 10:19:00+07
282	B2200096	VAO	2026-11-15 17:18:00+07
283	B2300131	RA	2026-11-15 09:06:00+07
284	B2300131	VAO	2026-11-15 16:52:00+07
285	B2200090	RA	2026-11-15 10:11:00+07
286	B2200090	VAO	2026-11-15 17:24:00+07
287	B2300132	RA	2026-11-15 09:27:00+07
288	B2300132	VAO	2026-11-15 15:17:00+07
289	B2100042	RA	2026-11-15 10:34:00+07
290	B2100042	VAO	2026-11-15 21:06:00+07
291	B2400168	RA	2026-11-15 11:08:00+07
292	B2400168	VAO	2026-11-15 14:56:00+07
293	B2200057	RA	2026-11-15 10:32:00+07
294	B2200057	VAO	2026-11-15 12:15:00+07
295	B2200074	RA	2026-11-15 11:31:00+07
296	B2200074	VAO	2026-11-15 21:58:00+07
297	B2100013	RA	2026-11-15 13:11:00+07
298	B2100013	VAO	2026-11-15 20:18:00+07
299	B2100027	RA	2026-11-15 08:35:00+07
300	B2100027	VAO	2026-11-15 18:12:00+07
301	B2100021	RA	2026-11-15 11:30:00+07
302	B2100021	VAO	2026-11-15 15:37:00+07
303	B2100051	RA	2026-11-15 08:25:00+07
304	B2100051	VAO	2026-11-15 11:28:00+07
305	B2100043	RA	2026-11-15 11:45:00+07
306	B2100043	VAO	2026-11-15 21:26:00+07
307	B2100022	RA	2026-11-15 09:48:00+07
308	B2100022	VAO	2026-11-15 13:09:00+07
309	B2300161	RA	2026-11-15 07:26:00+07
310	B2300161	VAO	2026-11-15 16:15:00+07
311	B2100001	RA	2026-11-15 12:12:00+07
312	B2100001	VAO	2026-11-15 18:25:00+07
313	B2100040	RA	2026-11-15 11:54:00+07
314	B2100040	VAO	2026-11-15 13:03:00+07
315	B2100006	RA	2026-11-15 10:11:00+07
316	B2100006	VAO	2026-11-15 15:48:00+07
317	B2300135	RA	2026-11-15 08:07:00+07
318	B2300135	VAO	2026-11-15 15:05:00+07
319	B2100017	RA	2026-11-15 12:36:00+07
320	B2100017	VAO	2026-11-15 14:17:00+07
321	B2400166	RA	2026-11-15 08:39:00+07
322	B2400166	VAO	2026-11-15 16:47:00+07
323	B2300154	RA	2026-11-15 07:59:00+07
324	B2300154	VAO	2026-11-15 13:29:00+07
325	B2100033	RA	2026-11-15 13:19:00+07
326	B2100033	VAO	2026-11-15 16:28:00+07
327	B2300116	RA	2026-11-15 06:47:00+07
328	B2300116	VAO	2026-11-15 12:53:00+07
329	B2200062	RA	2026-11-15 13:02:00+07
330	B2200062	VAO	2026-11-15 21:03:00+07
331	B2100023	RA	2026-11-15 08:15:00+07
332	B2100023	VAO	2026-11-15 21:31:00+07
333	B2200089	RA	2026-11-15 10:52:00+07
334	B2200089	VAO	2026-11-15 19:41:00+07
335	B2300123	RA	2026-11-15 07:01:00+07
336	B2300123	VAO	2026-11-15 15:27:00+07
337	B2300152	RA	2026-11-15 13:53:00+07
338	B2300152	VAO	2026-11-15 16:52:00+07
339	B2100010	RA	2026-11-15 08:40:00+07
340	B2100010	VAO	2026-11-15 14:41:00+07
341	B2300134	RA	2026-11-15 06:04:00+07
342	B2300134	VAO	2026-11-15 13:12:00+07
343	B2200076	RA	2026-11-15 10:59:00+07
344	B2200076	VAO	2026-11-15 15:42:00+07
345	B2100054	RA	2026-11-15 07:03:00+07
346	B2100054	VAO	2026-11-15 21:13:00+07
347	B2200082	RA	2026-11-15 09:14:00+07
348	B2200082	VAO	2026-11-15 11:07:00+07
349	B2100024	RA	2026-11-15 07:14:00+07
350	B2100024	VAO	2026-11-15 20:08:00+07
351	B2100016	RA	2026-11-15 13:53:00+07
352	B2100016	VAO	2026-11-15 20:22:00+07
353	B2300155	RA	2026-11-15 10:44:00+07
354	B2300155	VAO	2026-11-15 18:42:00+07
355	B2200105	RA	2026-11-15 07:58:00+07
356	B2200105	VAO	2026-11-15 21:16:00+07
357	B2200110	RA	2026-11-15 07:25:00+07
358	B2200110	VAO	2026-11-15 11:20:00+07
359	B2200099	RA	2026-11-15 11:10:00+07
360	B2200099	VAO	2026-11-15 13:25:00+07
361	B2300143	RA	2026-11-15 06:39:00+07
362	B2300143	VAO	2026-11-15 14:15:00+07
363	B2300128	RA	2026-11-15 10:16:00+07
364	B2300128	VAO	2026-11-15 15:28:00+07
365	B2200072	RA	2026-11-15 07:10:00+07
366	B2200072	VAO	2026-11-15 20:57:00+07
367	B2200097	RA	2026-11-15 11:03:00+07
368	B2200097	VAO	2026-11-15 16:40:00+07
369	B2100041	RA	2026-11-15 11:14:00+07
370	B2100041	VAO	2026-11-15 13:38:00+07
371	B2200061	RA	2026-11-15 11:39:00+07
372	B2200061	VAO	2026-11-15 14:00:00+07
373	B2200058	RA	2026-11-15 11:59:00+07
374	B2200058	VAO	2026-11-15 15:17:00+07
375	B2300151	RA	2026-11-15 09:52:00+07
376	B2300151	VAO	2026-11-15 20:25:00+07
377	B2200073	RA	2026-11-15 11:28:00+07
378	B2200073	VAO	2026-11-15 19:52:00+07
379	B2100007	RA	2026-11-15 12:20:00+07
380	B2100007	VAO	2026-11-15 14:42:00+07
381	B2300149	RA	2026-11-15 07:39:00+07
382	B2300149	VAO	2026-11-15 19:47:00+07
383	B2100052	RA	2026-11-15 10:17:00+07
384	B2100052	VAO	2026-11-15 13:02:00+07
385	B2200102	RA	2026-11-15 08:21:00+07
386	B2200102	VAO	2026-11-15 17:24:00+07
387	B2300156	RA	2026-11-15 08:59:00+07
388	B2300156	VAO	2026-11-15 18:34:00+07
389	B2100032	RA	2026-11-15 08:34:00+07
390	B2100032	VAO	2026-11-15 19:13:00+07
391	B2100020	RA	2026-11-16 13:07:00+07
392	B2100020	VAO	2026-11-16 17:30:00+07
393	B2200060	RA	2026-11-16 07:38:00+07
394	B2200060	VAO	2026-11-16 21:00:00+07
395	B2100010	RA	2026-11-16 13:31:00+07
396	B2100010	VAO	2026-11-16 20:12:00+07
397	B2300134	RA	2026-11-16 09:42:00+07
398	B2300134	VAO	2026-11-16 12:23:00+07
399	B2100028	RA	2026-11-16 13:30:00+07
400	B2100028	VAO	2026-11-16 18:54:00+07
401	B2200061	RA	2026-11-16 12:51:00+07
402	B2200061	VAO	2026-11-16 19:31:00+07
403	B2200102	RA	2026-11-16 08:54:00+07
404	B2200102	VAO	2026-11-16 21:11:00+07
405	B2300125	RA	2026-11-16 13:55:00+07
406	B2300125	VAO	2026-11-16 19:38:00+07
407	B2100014	RA	2026-11-16 10:55:00+07
408	B2100014	VAO	2026-11-16 13:10:00+07
409	B2100006	RA	2026-11-16 06:14:00+07
410	B2100006	VAO	2026-11-16 15:12:00+07
411	B2200080	RA	2026-11-16 06:03:00+07
412	B2200080	VAO	2026-11-16 11:23:00+07
413	B2200106	RA	2026-11-16 06:09:00+07
414	B2200106	VAO	2026-11-16 20:52:00+07
415	B2100045	RA	2026-11-16 07:08:00+07
416	B2100045	VAO	2026-11-16 13:52:00+07
417	B2300121	RA	2026-11-16 10:34:00+07
418	B2300121	VAO	2026-11-16 12:33:00+07
419	B2300128	RA	2026-11-16 06:25:00+07
420	B2300128	VAO	2026-11-16 11:05:00+07
421	B2300150	RA	2026-11-16 12:15:00+07
422	B2300150	VAO	2026-11-16 19:49:00+07
423	B2300146	RA	2026-11-16 13:26:00+07
424	B2300146	VAO	2026-11-16 15:55:00+07
425	B2200110	RA	2026-11-16 13:47:00+07
426	B2200110	VAO	2026-11-16 19:07:00+07
427	B2100048	RA	2026-11-16 10:46:00+07
428	B2100048	VAO	2026-11-16 19:45:00+07
429	B2100036	RA	2026-11-16 12:19:00+07
430	B2100036	VAO	2026-11-16 19:19:00+07
431	B2200067	RA	2026-11-16 09:39:00+07
432	B2200067	VAO	2026-11-16 18:30:00+07
433	B2200099	RA	2026-11-16 08:54:00+07
434	B2200099	VAO	2026-11-16 15:24:00+07
435	B2300116	RA	2026-11-16 12:46:00+07
436	B2300116	VAO	2026-11-16 17:28:00+07
437	B2300159	RA	2026-11-16 12:38:00+07
438	B2300159	VAO	2026-11-16 17:26:00+07
439	B2300156	RA	2026-11-16 11:21:00+07
440	B2300156	VAO	2026-11-16 20:19:00+07
441	B2300162	RA	2026-11-16 10:01:00+07
442	B2300162	VAO	2026-11-16 13:12:00+07
443	B2100001	RA	2026-11-16 10:32:00+07
444	B2100001	VAO	2026-11-16 16:19:00+07
445	B2200090	RA	2026-11-16 13:37:00+07
446	B2200090	VAO	2026-11-16 15:35:00+07
447	B2200085	RA	2026-11-16 08:17:00+07
448	B2200085	VAO	2026-11-16 13:12:00+07
449	B2100016	RA	2026-11-16 12:19:00+07
450	B2100016	VAO	2026-11-16 15:17:00+07
451	B2100039	RA	2026-11-16 08:45:00+07
452	B2100039	VAO	2026-11-16 17:14:00+07
453	B2300119	RA	2026-11-16 10:49:00+07
454	B2300119	VAO	2026-11-16 20:19:00+07
455	B2200066	RA	2026-11-16 11:19:00+07
456	B2200066	VAO	2026-11-16 16:29:00+07
457	B2100005	RA	2026-11-16 10:52:00+07
458	B2100005	VAO	2026-11-16 17:37:00+07
459	B2200096	RA	2026-11-16 13:00:00+07
460	B2200096	VAO	2026-11-16 17:43:00+07
461	B2300129	RA	2026-11-16 10:06:00+07
462	B2300129	VAO	2026-11-16 18:22:00+07
463	B2400170	RA	2026-11-16 11:22:00+07
464	B2400170	VAO	2026-11-16 20:26:00+07
465	B2300113	RA	2026-11-16 07:55:00+07
466	B2300113	VAO	2026-11-16 17:45:00+07
467	B2300136	RA	2026-11-16 11:09:00+07
468	B2300136	VAO	2026-11-16 20:30:00+07
469	B2300117	RA	2026-11-16 08:49:00+07
470	B2300117	VAO	2026-11-16 19:23:00+07
471	B2100033	RA	2026-11-16 06:49:00+07
472	B2100033	VAO	2026-11-16 16:01:00+07
473	B2200073	RA	2026-11-16 08:42:00+07
474	B2200073	VAO	2026-11-16 18:33:00+07
475	B2100008	RA	2026-11-16 06:26:00+07
476	B2100008	VAO	2026-11-16 18:47:00+07
477	B2300141	RA	2026-11-16 13:10:00+07
478	B2300141	VAO	2026-11-16 20:58:00+07
479	B2300152	RA	2026-11-16 07:01:00+07
480	B2300152	VAO	2026-11-16 12:57:00+07
481	B2100030	RA	2026-11-16 09:39:00+07
482	B2100030	VAO	2026-11-16 21:32:00+07
483	B2200097	RA	2026-11-16 13:30:00+07
484	B2200097	VAO	2026-11-16 15:49:00+07
485	B2300135	RA	2026-11-16 12:20:00+07
486	B2300135	VAO	2026-11-16 19:38:00+07
487	B2100035	RA	2026-11-16 13:53:00+07
488	B2100035	VAO	2026-11-16 21:53:00+07
489	B2100002	RA	2026-11-16 11:09:00+07
490	B2100002	VAO	2026-11-16 21:07:00+07
491	B2100011	RA	2026-11-16 12:46:00+07
492	B2100011	VAO	2026-11-16 15:54:00+07
493	B2100047	RA	2026-11-16 07:35:00+07
494	B2100047	VAO	2026-11-16 14:41:00+07
495	B2100049	RA	2026-11-16 12:43:00+07
496	B2100049	VAO	2026-11-16 21:17:00+07
497	B2300124	RA	2026-11-16 13:49:00+07
498	B2300124	VAO	2026-11-16 16:04:00+07
499	B2100009	RA	2026-11-16 08:25:00+07
500	B2100009	VAO	2026-11-16 19:36:00+07
501	B2200069	RA	2026-11-16 09:58:00+07
502	B2200069	VAO	2026-11-16 14:32:00+07
503	B2300143	RA	2026-11-16 12:56:00+07
504	B2300143	VAO	2026-11-16 16:49:00+07
505	B2100007	RA	2026-11-16 07:27:00+07
506	B2100007	VAO	2026-11-16 16:51:00+07
507	B2200059	RA	2026-11-16 10:03:00+07
508	B2200059	VAO	2026-11-16 16:08:00+07
509	B2100029	RA	2026-11-16 09:49:00+07
510	B2100029	VAO	2026-11-16 21:42:00+07
511	B2300123	RA	2026-11-16 09:48:00+07
512	B2300123	VAO	2026-11-16 15:22:00+07
513	B2100026	RA	2026-11-16 12:25:00+07
514	B2100026	VAO	2026-11-16 17:13:00+07
515	B2100018	RA	2026-11-16 07:49:00+07
516	B2100018	VAO	2026-11-16 13:11:00+07
517	B2200063	RA	2026-11-16 06:45:00+07
518	B2200063	VAO	2026-11-16 13:35:00+07
519	B2100042	RA	2026-11-16 06:33:00+07
520	B2100042	VAO	2026-11-16 14:10:00+07
521	B2100010	RA	2026-11-17 10:26:00+07
522	B2100010	VAO	2026-11-17 18:58:00+07
523	B2100037	RA	2026-11-17 13:13:00+07
524	B2100037	VAO	2026-11-17 18:32:00+07
525	B2100017	RA	2026-11-17 11:07:00+07
526	B2100017	VAO	2026-11-17 16:39:00+07
527	B2200059	RA	2026-11-17 08:50:00+07
528	B2200059	VAO	2026-11-17 18:00:00+07
529	B2100002	RA	2026-11-17 09:08:00+07
530	B2100002	VAO	2026-11-17 17:49:00+07
531	B2100041	RA	2026-11-17 11:21:00+07
532	B2100041	VAO	2026-11-17 16:38:00+07
533	B2200106	RA	2026-11-17 13:23:00+07
534	B2200106	VAO	2026-11-17 16:26:00+07
535	B2300138	RA	2026-11-17 10:27:00+07
536	B2300138	VAO	2026-11-17 21:51:00+07
537	B2200082	RA	2026-11-17 11:44:00+07
538	B2200082	VAO	2026-11-17 15:55:00+07
539	B2100019	RA	2026-11-17 10:24:00+07
540	B2100019	VAO	2026-11-17 19:08:00+07
541	B2200072	RA	2026-11-17 07:55:00+07
542	B2200072	VAO	2026-11-17 15:53:00+07
543	B2300128	RA	2026-11-17 10:51:00+07
544	B2300128	VAO	2026-11-17 14:33:00+07
545	B2200108	RA	2026-11-17 08:08:00+07
546	B2200108	VAO	2026-11-17 21:54:00+07
547	B2300111	RA	2026-11-17 11:32:00+07
548	B2300111	VAO	2026-11-17 18:55:00+07
549	B2300126	RA	2026-11-17 10:53:00+07
550	B2300126	VAO	2026-11-17 20:42:00+07
551	B2200079	RA	2026-11-17 09:15:00+07
552	B2200079	VAO	2026-11-17 17:42:00+07
553	B2300146	RA	2026-11-17 06:33:00+07
554	B2300146	VAO	2026-11-17 14:40:00+07
555	B2300137	RA	2026-11-17 10:32:00+07
556	B2300137	VAO	2026-11-17 14:55:00+07
557	B2100051	RA	2026-11-17 08:02:00+07
558	B2100051	VAO	2026-11-17 14:25:00+07
559	B2300123	RA	2026-11-17 08:43:00+07
560	B2300123	VAO	2026-11-17 15:52:00+07
561	B2100008	RA	2026-11-17 10:39:00+07
562	B2100008	VAO	2026-11-17 15:35:00+07
563	B2200071	RA	2026-11-17 12:05:00+07
564	B2200071	VAO	2026-11-17 19:33:00+07
565	B2200061	RA	2026-11-17 10:51:00+07
566	B2200061	VAO	2026-11-17 13:18:00+07
567	B2200069	RA	2026-11-17 09:38:00+07
568	B2200069	VAO	2026-11-17 11:51:00+07
569	B2300153	RA	2026-11-17 07:34:00+07
570	B2300153	VAO	2026-11-17 18:54:00+07
571	B2200088	RA	2026-11-17 12:17:00+07
572	B2200088	VAO	2026-11-17 16:24:00+07
573	B2100048	RA	2026-11-17 10:40:00+07
574	B2100048	VAO	2026-11-17 17:33:00+07
575	B2200075	RA	2026-11-17 11:55:00+07
576	B2200075	VAO	2026-11-17 13:09:00+07
577	B2100027	RA	2026-11-17 07:35:00+07
578	B2100027	VAO	2026-11-17 14:00:00+07
579	B2100001	RA	2026-11-17 08:13:00+07
580	B2100001	VAO	2026-11-17 17:51:00+07
581	B2300129	RA	2026-11-17 08:50:00+07
582	B2300129	VAO	2026-11-17 19:12:00+07
583	B2100005	RA	2026-11-17 08:22:00+07
584	B2100005	VAO	2026-11-17 15:35:00+07
585	B2400172	RA	2026-11-17 08:58:00+07
586	B2400172	VAO	2026-11-17 17:14:00+07
587	B2200096	RA	2026-11-17 07:34:00+07
588	B2200096	VAO	2026-11-17 20:44:00+07
589	B2300118	RA	2026-11-17 07:02:00+07
590	B2300118	VAO	2026-11-17 11:34:00+07
591	B2200100	RA	2026-11-17 12:31:00+07
592	B2200100	VAO	2026-11-17 18:50:00+07
593	B2100038	RA	2026-11-17 07:18:00+07
594	B2100038	VAO	2026-11-17 13:20:00+07
595	B2200085	RA	2026-11-17 11:13:00+07
596	B2200085	VAO	2026-11-17 18:54:00+07
597	B2100034	RA	2026-11-17 09:47:00+07
598	B2100034	VAO	2026-11-17 19:33:00+07
599	B2200087	RA	2026-11-17 09:11:00+07
600	B2200087	VAO	2026-11-17 21:24:00+07
601	B2200084	RA	2026-11-17 07:40:00+07
602	B2200084	VAO	2026-11-17 16:55:00+07
603	B2200092	RA	2026-11-17 08:22:00+07
604	B2200092	VAO	2026-11-17 14:20:00+07
605	B2100014	RA	2026-11-17 11:30:00+07
606	B2100014	VAO	2026-11-17 14:00:00+07
607	B2300140	RA	2026-11-17 11:13:00+07
608	B2300140	VAO	2026-11-17 19:04:00+07
609	B2100028	RA	2026-11-17 08:43:00+07
610	B2100028	VAO	2026-11-17 20:01:00+07
611	B2300115	RA	2026-11-17 07:30:00+07
612	B2300115	VAO	2026-11-17 15:28:00+07
613	B2300160	RA	2026-11-17 08:18:00+07
614	B2300160	VAO	2026-11-17 12:53:00+07
615	B2100030	RA	2026-11-17 10:08:00+07
616	B2100030	VAO	2026-11-17 13:34:00+07
617	B2300134	RA	2026-11-17 11:07:00+07
618	B2300134	VAO	2026-11-17 15:23:00+07
619	B2200070	RA	2026-11-17 12:59:00+07
620	B2200070	VAO	2026-11-17 18:30:00+07
621	B2300158	RA	2026-11-17 12:06:00+07
622	B2300158	VAO	2026-11-17 16:22:00+07
623	B2100045	RA	2026-11-17 10:58:00+07
624	B2100045	VAO	2026-11-17 13:56:00+07
625	B2200089	RA	2026-11-17 12:55:00+07
626	B2200089	VAO	2026-11-17 20:37:00+07
627	B2200080	RA	2026-11-17 09:01:00+07
628	B2200080	VAO	2026-11-17 19:50:00+07
629	B2400168	RA	2026-11-17 13:24:00+07
630	B2400168	VAO	2026-11-17 16:13:00+07
631	B2100053	RA	2026-11-17 10:40:00+07
632	B2100053	VAO	2026-11-17 21:55:00+07
633	B2100049	RA	2026-11-17 06:55:00+07
634	B2100049	VAO	2026-11-17 17:36:00+07
635	B2400166	RA	2026-11-17 13:30:00+07
636	B2400166	VAO	2026-11-17 20:07:00+07
637	B2300142	RA	2026-11-17 10:29:00+07
638	B2300142	VAO	2026-11-17 14:33:00+07
639	B2100009	RA	2026-11-17 06:58:00+07
640	B2100009	VAO	2026-11-17 17:01:00+07
641	B2100046	RA	2026-11-17 06:56:00+07
642	B2100046	VAO	2026-11-17 20:03:00+07
643	B2300150	RA	2026-11-17 11:20:00+07
644	B2300150	VAO	2026-11-17 15:18:00+07
645	B2200077	RA	2026-11-17 06:18:00+07
646	B2200077	VAO	2026-11-17 12:07:00+07
647	B2300130	RA	2026-11-17 08:16:00+07
648	B2300130	VAO	2026-11-17 11:53:00+07
649	B2200101	RA	2026-11-17 10:58:00+07
650	B2200101	VAO	2026-11-17 13:10:00+07
651	B2200091	RA	2026-11-18 12:05:00+07
652	B2200091	VAO	2026-11-18 18:17:00+07
653	B2100036	RA	2026-11-18 12:51:00+07
654	B2100036	VAO	2026-11-18 21:27:00+07
655	B2100008	RA	2026-11-18 06:08:00+07
656	B2100008	VAO	2026-11-18 14:21:00+07
657	B2400174	RA	2026-11-18 10:54:00+07
658	B2400174	VAO	2026-11-18 16:42:00+07
659	B2300130	RA	2026-11-18 08:02:00+07
660	B2300130	VAO	2026-11-18 12:25:00+07
661	B2100044	RA	2026-11-18 11:57:00+07
662	B2100044	VAO	2026-11-18 13:45:00+07
663	B2300156	RA	2026-11-18 06:26:00+07
664	B2300156	VAO	2026-11-18 15:00:00+07
665	B2300126	RA	2026-11-18 06:01:00+07
666	B2300126	VAO	2026-11-18 13:00:00+07
667	B2100003	RA	2026-11-18 07:08:00+07
668	B2100003	VAO	2026-11-18 21:26:00+07
669	B2200108	RA	2026-11-18 09:03:00+07
670	B2200108	VAO	2026-11-18 13:11:00+07
671	B2300138	RA	2026-11-18 11:47:00+07
672	B2300138	VAO	2026-11-18 15:38:00+07
673	B2100021	RA	2026-11-18 06:50:00+07
674	B2100021	VAO	2026-11-18 19:37:00+07
675	B2300124	RA	2026-11-18 12:05:00+07
676	B2300124	VAO	2026-11-18 15:59:00+07
677	B2300151	RA	2026-11-18 12:31:00+07
678	B2300151	VAO	2026-11-18 17:57:00+07
679	B2300149	RA	2026-11-18 12:01:00+07
680	B2300149	VAO	2026-11-18 21:08:00+07
681	B2200081	RA	2026-11-18 10:41:00+07
682	B2200081	VAO	2026-11-18 16:33:00+07
683	B2300162	RA	2026-11-18 07:56:00+07
684	B2300162	VAO	2026-11-18 14:43:00+07
685	B2200062	RA	2026-11-18 12:08:00+07
686	B2200062	VAO	2026-11-18 18:47:00+07
687	B2200092	RA	2026-11-18 10:11:00+07
688	B2200092	VAO	2026-11-18 16:23:00+07
689	B2300132	RA	2026-11-18 11:46:00+07
690	B2300132	VAO	2026-11-18 15:18:00+07
691	B2100024	RA	2026-11-18 07:39:00+07
692	B2100024	VAO	2026-11-18 14:46:00+07
693	B2200067	RA	2026-11-18 11:06:00+07
694	B2200067	VAO	2026-11-18 20:35:00+07
695	B2300147	RA	2026-11-18 08:39:00+07
696	B2300147	VAO	2026-11-18 21:20:00+07
697	B2200102	RA	2026-11-18 13:49:00+07
698	B2200102	VAO	2026-11-18 16:28:00+07
699	B2300113	RA	2026-11-18 06:24:00+07
700	B2300113	VAO	2026-11-18 14:28:00+07
701	B2200058	RA	2026-11-18 11:49:00+07
702	B2200058	VAO	2026-11-18 17:16:00+07
703	B2300122	RA	2026-11-18 08:07:00+07
704	B2300122	VAO	2026-11-18 15:30:00+07
705	B2100011	RA	2026-11-18 11:38:00+07
706	B2100011	VAO	2026-11-18 18:03:00+07
707	B2100033	RA	2026-11-18 09:10:00+07
708	B2100033	VAO	2026-11-18 18:30:00+07
709	B2200109	RA	2026-11-18 13:26:00+07
710	B2200109	VAO	2026-11-18 16:27:00+07
711	B2100040	RA	2026-11-18 12:12:00+07
712	B2100040	VAO	2026-11-18 21:00:00+07
713	B2100029	RA	2026-11-18 07:45:00+07
714	B2100029	VAO	2026-11-18 18:20:00+07
715	B2400170	RA	2026-11-18 13:40:00+07
716	B2400170	VAO	2026-11-18 16:53:00+07
717	B2300123	RA	2026-11-18 11:19:00+07
718	B2300123	VAO	2026-11-18 15:12:00+07
719	B2200094	RA	2026-11-18 13:38:00+07
720	B2200094	VAO	2026-11-18 20:01:00+07
721	B2200060	RA	2026-11-18 09:56:00+07
722	B2200060	VAO	2026-11-18 19:30:00+07
723	B2100026	RA	2026-11-18 12:33:00+07
724	B2100026	VAO	2026-11-18 19:58:00+07
725	B2200104	RA	2026-11-18 10:12:00+07
726	B2200104	VAO	2026-11-18 16:38:00+07
727	B2300120	RA	2026-11-18 06:54:00+07
728	B2300120	VAO	2026-11-18 11:47:00+07
729	B2300148	RA	2026-11-18 08:19:00+07
730	B2300148	VAO	2026-11-18 16:37:00+07
731	B2300117	RA	2026-11-18 06:46:00+07
732	B2300117	VAO	2026-11-18 12:55:00+07
733	B2300164	RA	2026-11-18 11:42:00+07
734	B2300164	VAO	2026-11-18 21:02:00+07
735	B2100045	RA	2026-11-18 13:02:00+07
736	B2100045	VAO	2026-11-18 18:24:00+07
737	B2100020	RA	2026-11-18 08:48:00+07
738	B2100020	VAO	2026-11-18 14:07:00+07
739	B2100039	RA	2026-11-18 10:41:00+07
740	B2100039	VAO	2026-11-18 13:59:00+07
741	B2200085	RA	2026-11-18 10:35:00+07
742	B2200085	VAO	2026-11-18 13:50:00+07
743	B2200061	RA	2026-11-18 11:59:00+07
744	B2200061	VAO	2026-11-18 13:18:00+07
745	B2100019	RA	2026-11-18 11:09:00+07
746	B2100019	VAO	2026-11-18 17:41:00+07
747	B2300118	RA	2026-11-18 08:05:00+07
748	B2300118	VAO	2026-11-18 12:17:00+07
749	B2100016	RA	2026-11-18 09:47:00+07
750	B2100016	VAO	2026-11-18 12:51:00+07
751	B2300142	RA	2026-11-18 10:40:00+07
752	B2300142	VAO	2026-11-18 18:50:00+07
753	B2400168	RA	2026-11-18 07:20:00+07
754	B2400168	VAO	2026-11-18 19:56:00+07
755	B2200077	RA	2026-11-18 12:38:00+07
756	B2200077	VAO	2026-11-18 16:13:00+07
757	B2200080	RA	2026-11-18 07:00:00+07
758	B2200080	VAO	2026-11-18 13:49:00+07
759	B2200063	RA	2026-11-18 10:56:00+07
760	B2200063	VAO	2026-11-18 14:43:00+07
761	B2100013	RA	2026-11-18 09:44:00+07
762	B2100013	VAO	2026-11-18 16:18:00+07
763	B2100009	RA	2026-11-18 08:44:00+07
764	B2100009	VAO	2026-11-18 20:01:00+07
765	B2200059	RA	2026-11-18 13:41:00+07
766	B2200059	VAO	2026-11-18 17:14:00+07
767	B2200110	RA	2026-11-18 08:38:00+07
768	B2200110	VAO	2026-11-18 11:43:00+07
769	B2300139	RA	2026-11-18 06:41:00+07
770	B2300139	VAO	2026-11-18 13:59:00+07
771	B2100018	RA	2026-11-18 10:51:00+07
772	B2100018	VAO	2026-11-18 14:24:00+07
773	B2200086	RA	2026-11-18 12:53:00+07
774	B2200086	VAO	2026-11-18 15:17:00+07
775	B2100025	RA	2026-11-18 10:23:00+07
776	B2100025	VAO	2026-11-18 18:33:00+07
777	B2300116	RA	2026-11-18 13:49:00+07
778	B2300116	VAO	2026-11-18 17:15:00+07
779	B2100049	RA	2026-11-18 06:41:00+07
780	B2100049	VAO	2026-11-18 21:43:00+07
781	B2200094	RA	2026-11-19 09:53:00+07
782	B2200094	VAO	2026-11-19 15:18:00+07
783	B2100042	RA	2026-11-19 06:47:00+07
784	B2100042	VAO	2026-11-19 08:51:00+07
785	B2300149	RA	2026-11-19 12:52:00+07
786	B2300149	VAO	2026-11-19 16:38:00+07
787	B2300133	RA	2026-11-19 12:51:00+07
788	B2300133	VAO	2026-11-19 13:23:00+07
789	B2100013	RA	2026-11-19 08:39:00+07
790	B2100013	VAO	2026-11-19 18:01:00+07
791	B2200092	RA	2026-11-19 14:59:00+07
792	B2200092	VAO	2026-11-19 16:56:00+07
793	B2400168	RA	2026-11-19 13:12:00+07
794	B2400168	VAO	2026-11-19 14:27:00+07
795	B2300113	RA	2026-11-19 09:42:00+07
796	B2300113	VAO	2026-11-19 15:00:00+07
797	B2200105	RA	2026-11-19 10:04:00+07
798	B2200105	VAO	2026-11-19 18:24:00+07
799	B2300151	RA	2026-11-19 10:03:00+07
800	B2300151	VAO	2026-11-19 11:23:00+07
801	B2100041	RA	2026-11-19 12:04:00+07
802	B2100041	VAO	2026-11-19 15:25:00+07
803	B2100029	RA	2026-11-19 08:12:00+07
804	B2100029	VAO	2026-11-19 18:11:00+07
805	B2300125	RA	2026-11-19 06:10:00+07
806	B2300125	VAO	2026-11-19 12:23:00+07
807	B2200059	RA	2026-11-19 14:27:00+07
808	B2200059	VAO	2026-11-19 17:26:00+07
809	B2100047	RA	2026-11-19 11:45:00+07
810	B2100047	VAO	2026-11-19 15:14:00+07
811	B2100026	RA	2026-11-19 06:28:00+07
812	B2100026	VAO	2026-11-19 18:22:00+07
813	B2200056	RA	2026-11-19 06:50:00+07
814	B2200056	VAO	2026-11-19 13:11:00+07
815	B2100051	RA	2026-11-19 06:58:00+07
816	B2100051	VAO	2026-11-19 13:54:00+07
817	B2200058	RA	2026-11-19 11:56:00+07
818	B2200058	VAO	2026-11-19 16:09:00+07
819	B2200074	RA	2026-11-19 06:41:00+07
820	B2200074	VAO	2026-11-19 12:17:00+07
821	B2300158	RA	2026-11-19 14:21:00+07
822	B2300158	VAO	2026-11-19 18:09:00+07
823	B2300155	RA	2026-11-19 12:07:00+07
824	B2300155	VAO	2026-11-19 15:50:00+07
825	B2300139	RA	2026-11-19 07:24:00+07
826	B2300139	VAO	2026-11-19 14:54:00+07
827	B2300137	RA	2026-11-19 11:47:00+07
828	B2300137	VAO	2026-11-19 14:49:00+07
829	B2300142	RA	2026-11-19 09:06:00+07
830	B2300142	VAO	2026-11-19 11:40:00+07
831	B2300122	RA	2026-11-19 13:44:00+07
832	B2300122	VAO	2026-11-19 14:24:00+07
833	B2200095	RA	2026-11-19 13:34:00+07
834	B2200095	VAO	2026-11-19 16:43:00+07
835	B2300119	RA	2026-11-19 13:22:00+07
836	B2300119	VAO	2026-11-19 15:26:00+07
837	B2100055	RA	2026-11-19 10:56:00+07
838	B2100055	VAO	2026-11-19 16:53:00+07
839	B2100019	RA	2026-11-19 10:19:00+07
840	B2100019	VAO	2026-11-19 14:48:00+07
841	B2300154	RA	2026-11-19 14:58:00+07
842	B2300154	VAO	2026-11-19 18:24:00+07
843	B2300152	RA	2026-11-19 06:30:00+07
844	B2300152	VAO	2026-11-19 13:29:00+07
845	B2100030	RA	2026-11-19 07:57:00+07
846	B2100030	VAO	2026-11-19 17:06:00+07
847	B2100048	RA	2026-11-19 13:04:00+07
848	B2100048	VAO	2026-11-19 18:19:00+07
849	B2300147	RA	2026-11-19 14:45:00+07
850	B2300147	VAO	2026-11-19 17:35:00+07
851	B2100009	RA	2026-11-19 08:24:00+07
852	B2100009	VAO	2026-11-19 11:18:00+07
853	B2200107	RA	2026-11-19 08:46:00+07
854	B2200107	VAO	2026-11-19 18:02:00+07
855	B2100024	RA	2026-11-19 07:54:00+07
856	B2100024	VAO	2026-11-19 10:45:00+07
857	B2200110	RA	2026-11-19 14:28:00+07
858	B2200110	VAO	2026-11-19 15:22:00+07
859	B2300141	RA	2026-11-19 09:47:00+07
860	B2300141	VAO	2026-11-19 14:00:00+07
861	B2100006	RA	2026-11-19 06:57:00+07
862	B2100006	VAO	2026-11-19 11:24:00+07
863	B2100023	RA	2026-11-19 13:21:00+07
864	B2100023	VAO	2026-11-19 17:32:00+07
865	B2100052	RA	2026-11-19 06:44:00+07
866	B2100052	VAO	2026-11-19 09:25:00+07
867	B2200079	RA	2026-11-19 11:25:00+07
868	B2200079	VAO	2026-11-19 12:21:00+07
869	B2200071	RA	2026-11-19 13:29:00+07
870	B2200071	VAO	2026-11-19 14:57:00+07
871	B2100054	RA	2026-11-19 11:39:00+07
872	B2100054	VAO	2026-11-19 14:03:00+07
873	B2300134	RA	2026-11-19 06:21:00+07
874	B2300134	VAO	2026-11-19 11:20:00+07
875	B2200100	RA	2026-11-19 07:51:00+07
876	B2200100	VAO	2026-11-19 13:38:00+07
877	B2300124	RA	2026-11-19 11:44:00+07
878	B2300124	VAO	2026-11-19 15:33:00+07
879	B2100001	RA	2026-11-19 12:04:00+07
880	B2100001	VAO	2026-11-19 16:04:00+07
881	B2100003	RA	2026-11-19 11:26:00+07
882	B2200064	RA	2026-11-19 11:19:00+07
883	B2100036	RA	2026-11-19 08:55:00+07
884	B2300159	RA	2026-11-19 15:57:00+07
885	B2300156	RA	2026-11-19 10:50:00+07
886	B2100039	RA	2026-11-19 08:26:00+07
887	B2300162	RA	2026-11-19 15:16:00+07
888	B2100027	RA	2026-11-19 13:13:00+07
889	B2200096	RA	2026-11-19 08:12:00+07
890	B2100016	RA	2026-11-19 08:04:00+07
\.


--
-- Data for Name: luu_tru; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.luu_tru (mssv, ma_phong, ma_ky, ngay_vao, ngay_ra) FROM stdin;
B2100001	1	HK1_2026_2027	2026-08-19	\N
B2100003	1	HK1_2026_2027	2026-08-23	\N
B2100005	1	HK1_2026_2027	2026-08-22	\N
B2100007	1	HK1_2026_2027	2026-08-21	\N
B2100009	2	HK1_2026_2027	2026-08-18	\N
B2100011	2	HK1_2026_2027	2026-08-20	\N
B2100013	2	HK1_2026_2027	2026-08-20	\N
B2100015	2	HK1_2026_2027	2026-08-24	\N
B2100017	3	HK1_2026_2027	2026-08-22	\N
B2100019	4	HK1_2026_2027	2026-08-23	\N
B2100021	4	HK1_2026_2027	2026-08-23	\N
B2100023	4	HK1_2026_2027	2026-08-20	\N
B2100025	4	HK1_2026_2027	2026-08-21	\N
B2100002	5	HK1_2026_2027	2026-08-24	\N
B2100004	5	HK1_2026_2027	2026-08-18	\N
B2100006	5	HK1_2026_2027	2026-08-24	\N
B2100008	5	HK1_2026_2027	2026-08-21	\N
B2100010	5	HK1_2026_2027	2026-08-22	\N
B2100012	6	HK1_2026_2027	2026-08-24	\N
B2100014	6	HK1_2026_2027	2026-08-17	\N
B2100016	6	HK1_2026_2027	2026-08-24	\N
B2100018	6	HK1_2026_2027	2026-08-19	\N
B2100020	6	HK1_2026_2027	2026-08-19	\N
B2100022	6	HK1_2026_2027	2026-08-18	\N
B2100024	7	HK1_2026_2027	2026-08-19	\N
B2100026	7	HK1_2026_2027	2026-08-18	\N
B2100028	7	HK1_2026_2027	2026-08-22	\N
B2100030	7	HK1_2026_2027	2026-08-20	\N
B2100032	7	HK1_2026_2027	2026-08-23	\N
B2100034	7	HK1_2026_2027	2026-08-19	\N
B2100036	7	HK1_2026_2027	2026-08-18	\N
B2100038	8	HK1_2026_2027	2026-08-17	\N
B2100040	8	HK1_2026_2027	2026-08-20	\N
B2100042	8	HK1_2026_2027	2026-08-19	\N
B2100044	8	HK1_2026_2027	2026-08-24	\N
B2100046	8	HK1_2026_2027	2026-08-22	\N
B2100048	8	HK1_2026_2027	2026-08-20	\N
B2100027	9	HK1_2026_2027	2026-08-22	\N
B2100029	9	HK1_2026_2027	2026-08-21	\N
B2100031	9	HK1_2026_2027	2026-08-21	\N
B2100033	9	HK1_2026_2027	2026-08-17	\N
B2100035	10	HK1_2026_2027	2026-08-23	\N
B2100037	10	HK1_2026_2027	2026-08-20	\N
B2100039	11	HK1_2026_2027	2026-08-20	\N
B2100041	12	HK1_2026_2027	2026-08-23	\N
B2100043	12	HK1_2026_2027	2026-08-20	\N
B2100045	12	HK1_2026_2027	2026-08-24	\N
B2100047	12	HK1_2026_2027	2026-08-22	\N
B2100049	12	HK1_2026_2027	2026-08-22	\N
B2100051	12	HK1_2026_2027	2026-08-21	\N
B2100050	13	HK1_2026_2027	2026-08-18	\N
B2100052	13	HK1_2026_2027	2026-08-23	\N
B2100054	13	HK1_2026_2027	2026-08-21	\N
B2200056	13	HK1_2026_2027	2026-08-23	\N
B2200058	14	HK1_2026_2027	2026-08-19	\N
B2200060	14	HK1_2026_2027	2026-08-18	\N
B2200062	14	HK1_2026_2027	2026-08-20	\N
B2200064	14	HK1_2026_2027	2026-08-17	\N
B2200066	15	HK1_2026_2027	2026-08-24	\N
B2200068	16	HK1_2026_2027	2026-08-18	\N
B2200070	16	HK1_2026_2027	2026-08-20	\N
B2200072	16	HK1_2026_2027	2026-08-21	\N
B2200074	16	HK1_2026_2027	2026-08-23	\N
B2200076	16	HK1_2026_2027	2026-08-21	\N
B2200078	16	HK1_2026_2027	2026-08-22	\N
B2100053	17	HK1_2026_2027	2026-08-19	\N
B2100055	17	HK1_2026_2027	2026-08-23	\N
B2200057	18	HK1_2026_2027	2026-08-19	\N
B2200059	18	HK1_2026_2027	2026-08-19	\N
B2200061	18	HK1_2026_2027	2026-08-17	\N
B2200063	18	HK1_2026_2027	2026-08-20	\N
B2200065	19	HK1_2026_2027	2026-08-21	\N
B2200067	19	HK1_2026_2027	2026-08-21	\N
B2200069	20	HK1_2026_2027	2026-08-18	\N
B2200071	20	HK1_2026_2027	2026-08-24	\N
B2200073	20	HK1_2026_2027	2026-08-20	\N
B2200075	20	HK1_2026_2027	2026-08-20	\N
B2200077	20	HK1_2026_2027	2026-08-22	\N
B2200080	21	HK1_2026_2027	2026-08-18	\N
B2200082	21	HK1_2026_2027	2026-08-18	\N
B2200084	21	HK1_2026_2027	2026-08-23	\N
B2200086	21	HK1_2026_2027	2026-08-21	\N
B2200088	21	HK1_2026_2027	2026-08-17	\N
B2200090	21	HK1_2026_2027	2026-08-20	\N
B2200092	25	HK1_2026_2027	2026-08-21	\N
B2200094	25	HK1_2026_2027	2026-08-18	\N
B2200096	25	HK1_2026_2027	2026-08-17	\N
B2200098	25	HK1_2026_2027	2026-08-20	\N
B2200100	26	HK1_2026_2027	2026-08-22	\N
B2200102	26	HK1_2026_2027	2026-08-23	\N
B2200104	26	HK1_2026_2027	2026-08-23	\N
B2200106	26	HK1_2026_2027	2026-08-18	\N
B2200108	27	HK1_2026_2027	2026-08-18	\N
B2200110	28	HK1_2026_2027	2026-08-18	\N
B2300112	28	HK1_2026_2027	2026-08-24	\N
B2300114	28	HK1_2026_2027	2026-08-23	\N
B2300116	28	HK1_2026_2027	2026-08-18	\N
B2300118	28	HK1_2026_2027	2026-08-19	\N
B2200079	29	HK1_2026_2027	2026-08-18	\N
B2200081	29	HK1_2026_2027	2026-08-24	\N
B2200083	29	HK1_2026_2027	2026-08-20	\N
B2200085	29	HK1_2026_2027	2026-08-20	\N
B2200087	29	HK1_2026_2027	2026-08-17	\N
B2200089	30	HK1_2026_2027	2026-08-17	\N
B2200091	30	HK1_2026_2027	2026-08-19	\N
B2200093	30	HK1_2026_2027	2026-08-23	\N
B2200095	30	HK1_2026_2027	2026-08-23	\N
B2200097	30	HK1_2026_2027	2026-08-20	\N
B2200099	30	HK1_2026_2027	2026-08-21	\N
B2200101	31	HK1_2026_2027	2026-08-17	\N
B2200103	31	HK1_2026_2027	2026-08-21	\N
B2200105	31	HK1_2026_2027	2026-08-18	\N
B2200107	31	HK1_2026_2027	2026-08-24	\N
B2200109	31	HK1_2026_2027	2026-08-18	\N
B2300111	31	HK1_2026_2027	2026-08-22	\N
B2300113	32	HK1_2026_2027	2026-08-24	\N
B2300115	32	HK1_2026_2027	2026-08-20	\N
B2300117	32	HK1_2026_2027	2026-08-24	\N
B2300119	32	HK1_2026_2027	2026-08-23	\N
B2300121	32	HK1_2026_2027	2026-08-21	\N
B2300123	32	HK1_2026_2027	2026-08-24	\N
B2300125	32	HK1_2026_2027	2026-08-18	\N
B2300120	33	HK1_2026_2027	2026-08-23	\N
B2300122	33	HK1_2026_2027	2026-08-23	\N
B2300124	33	HK1_2026_2027	2026-08-20	\N
B2300126	33	HK1_2026_2027	2026-08-22	\N
B2300128	34	HK1_2026_2027	2026-08-17	\N
B2300130	34	HK1_2026_2027	2026-08-20	\N
B2300132	34	HK1_2026_2027	2026-08-17	\N
B2300134	35	HK1_2026_2027	2026-08-18	\N
B2300136	35	HK1_2026_2027	2026-08-22	\N
B2300138	35	HK1_2026_2027	2026-08-24	\N
B2300140	36	HK1_2026_2027	2026-08-22	\N
B2300142	36	HK1_2026_2027	2026-08-20	\N
B2300144	36	HK1_2026_2027	2026-08-19	\N
B2300146	36	HK1_2026_2027	2026-08-22	\N
B2300148	36	HK1_2026_2027	2026-08-21	\N
B2300150	36	HK1_2026_2027	2026-08-17	\N
B2300127	37	HK1_2026_2027	2026-08-21	\N
B2300129	37	HK1_2026_2027	2026-08-17	\N
B2300131	37	HK1_2026_2027	2026-08-17	\N
B2300133	37	HK1_2026_2027	2026-08-21	\N
B2300135	37	HK1_2026_2027	2026-08-19	\N
B2300137	38	HK1_2026_2027	2026-08-22	\N
B2300139	38	HK1_2026_2027	2026-08-24	\N
B2300141	38	HK1_2026_2027	2026-08-17	\N
B2300143	38	HK1_2026_2027	2026-08-18	\N
B2300145	38	HK1_2026_2027	2026-08-22	\N
B2300147	39	HK1_2026_2027	2026-08-22	\N
B2300149	40	HK1_2026_2027	2026-08-19	\N
B2300151	40	HK1_2026_2027	2026-08-21	\N
B2300153	40	HK1_2026_2027	2026-08-17	\N
B2300155	40	HK1_2026_2027	2026-08-17	\N
B2300157	40	HK1_2026_2027	2026-08-19	\N
B2300159	40	HK1_2026_2027	2026-08-22	\N
B2300161	40	HK1_2026_2027	2026-08-17	\N
B2300152	41	HK1_2026_2027	2026-08-22	\N
B2300154	41	HK1_2026_2027	2026-08-21	\N
B2300156	42	HK1_2026_2027	2026-08-23	\N
B2300158	42	HK1_2026_2027	2026-08-19	\N
B2300160	42	HK1_2026_2027	2026-08-20	\N
B2300162	42	HK1_2026_2027	2026-08-18	\N
B2300164	43	HK1_2026_2027	2026-08-23	\N
B2400166	43	HK1_2026_2027	2026-08-24	\N
B2400168	43	HK1_2026_2027	2026-08-17	\N
B2400170	44	HK1_2026_2027	2026-08-17	\N
B2400172	44	HK1_2026_2027	2026-08-23	\N
B2400174	44	HK1_2026_2027	2026-08-18	\N
B2400176	44	HK1_2026_2027	2026-08-17	\N
\.


--
-- Data for Name: phong; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.phong (ma_phong, ten_phong, ma_khu, suc_chua, co_nau_an, gioi_tinh, gia_phong, tinh_trang) FROM stdin;
22	A306	A	6	f	NU	3000000	TRONG
23	A307	A	8	f	NU	3200000	TRONG
24	A308	A	8	f	NU	3200000	BAO_TRI
45	B305	B	6	f	NAM	3000000	TRONG
46	B306	B	6	f	NAM	3000000	TRONG
47	B307	B	8	f	NAM	3200000	TRONG
48	B308	B	8	f	NAM	3200000	BAO_TRI
1	A101	A	4	t	NAM	2800000	DAY
2	A102	A	4	t	NAM	2800000	DAY
3	A103	A	4	t	NAM	2800000	CON_CHO
4	A104	A	6	t	NAM	3400000	CON_CHO
5	A105	A	6	t	NU	3400000	CON_CHO
6	A106	A	6	t	NU	3400000	DAY
7	A107	A	8	t	NU	3600000	CON_CHO
8	A108	A	8	t	NU	3600000	CON_CHO
9	A201	A	4	f	NAM	2400000	DAY
10	A202	A	4	t	NAM	2800000	CON_CHO
11	A203	A	4	f	NAM	2400000	CON_CHO
12	A204	A	6	t	NAM	3400000	DAY
13	A205	A	6	f	NU	3000000	CON_CHO
14	A206	A	6	t	NU	3400000	CON_CHO
15	A207	A	8	f	NU	3200000	CON_CHO
16	A208	A	8	t	NU	3600000	CON_CHO
17	A301	A	4	f	NAM	2400000	CON_CHO
18	A302	A	4	f	NAM	2400000	DAY
19	A303	A	4	f	NAM	2400000	CON_CHO
20	A304	A	6	f	NAM	3000000	CON_CHO
21	A305	A	6	f	NU	3000000	DAY
25	B101	B	4	t	NU	2800000	DAY
26	B102	B	4	t	NU	2800000	DAY
27	B103	B	4	t	NU	2800000	CON_CHO
28	B104	B	6	t	NU	3400000	CON_CHO
29	B105	B	6	t	NAM	3400000	CON_CHO
30	B106	B	6	t	NAM	3400000	DAY
31	B107	B	8	t	NAM	3600000	CON_CHO
32	B108	B	8	t	NAM	3600000	CON_CHO
33	B201	B	4	f	NU	2400000	DAY
34	B202	B	4	t	NU	2800000	CON_CHO
35	B203	B	4	f	NU	2400000	CON_CHO
36	B204	B	6	t	NU	3400000	DAY
37	B205	B	6	f	NAM	3000000	CON_CHO
38	B206	B	6	t	NAM	3400000	CON_CHO
39	B207	B	8	f	NAM	3200000	CON_CHO
40	B208	B	8	t	NAM	3600000	CON_CHO
41	B301	B	4	f	NU	2400000	CON_CHO
42	B302	B	4	f	NU	2400000	DAY
43	B303	B	4	f	NU	2400000	CON_CHO
44	B304	B	6	f	NU	3000000	CON_CHO
\.


--
-- Data for Name: sinh_vien; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sinh_vien (mssv, ho_ten, gioi_tinh, nganh, sdt, email) FROM stdin;
B2100001	Nguyễn Văn An	NAM	Công nghệ thông tin	0358930497	b2100001@student.ctu.edu.vn
B2100002	Trần Thị Bích Ngọc	NU	Kỹ thuật phần mềm	0980490240	b2100002@student.ctu.edu.vn
B2100003	Lý Trung Quân	NAM	Tài chính - Ngân hàng	0388300337	b2100003@student.ctu.edu.vn
B2100004	Trần Thanh Nga	NU	Sư phạm Toán học	0910285339	b2100004@student.ctu.edu.vn
B2100005	Võ Hữu Thành	NAM	Nông học	0703840935	b2100005@student.ctu.edu.vn
B2100006	Nguyễn Ngọc Duyên	NU	Nông học	0946607941	b2100006@student.ctu.edu.vn
B2100007	Vũ Công Khoa	NAM	Kỹ thuật cơ khí	0356367270	b2100007@student.ctu.edu.vn
B2100008	Bùi Ngọc Tâm	NU	An toàn thông tin	0387249089	b2100008@student.ctu.edu.vn
B2100009	Ngô Anh Trí	NAM	Kỹ thuật cơ khí	0334777499	b2100009@student.ctu.edu.vn
B2100010	Bùi Phương Oanh	NU	Kỹ thuật điện	0963659985	b2100010@student.ctu.edu.vn
B2100011	Trần Văn Toàn	NAM	Tài chính - Ngân hàng	0974990028	b2100011@student.ctu.edu.vn
B2100012	Dương Thanh Dung	NU	Sư phạm Toán học	0380287560	b2100012@student.ctu.edu.vn
B2100013	Vũ Hữu Đạt	NAM	Nông học	0939782668	b2100013@student.ctu.edu.vn
B2100014	Bùi Ngọc Hương	NU	Nông học	0911215768	b2100014@student.ctu.edu.vn
B2100015	Nguyễn Nhật Bình	NAM	Kỹ thuật cơ khí	0709930630	b2100015@student.ctu.edu.vn
B2100016	Lý Thị My	NU	Kỹ thuật phần mềm	0700754055	b2100016@student.ctu.edu.vn
B2100017	Hồ Hoàng Toàn	NAM	An toàn thông tin	0963879637	b2100017@student.ctu.edu.vn
B2100018	Trần Minh Linh	NU	Mạng máy tính và truyền thông dữ liệu	0384993373	b2100018@student.ctu.edu.vn
B2100019	Lý Công Nam	NAM	Luật	0976281703	b2100019@student.ctu.edu.vn
B2100020	Dương Mỹ Hà	NU	Mạng máy tính và truyền thông dữ liệu	0705331440	b2100020@student.ctu.edu.vn
B2100021	Dương Trung Thiện	NAM	Kỹ thuật cơ khí	0708204639	b2100021@student.ctu.edu.vn
B2100022	Hồ Mỹ Thư	NU	Kỹ thuật phần mềm	0387451209	b2100022@student.ctu.edu.vn
B2100023	Huỳnh Gia Phúc	NAM	Nông học	0335708992	b2100023@student.ctu.edu.vn
B2100024	Bùi Yến Trinh	NU	An toàn thông tin	0387427732	b2100024@student.ctu.edu.vn
B2100025	Hoàng Minh Khoa	NAM	Công nghệ sinh học	0338315598	b2100025@student.ctu.edu.vn
B2100026	Dương Yến Ngọc	NU	Nuôi trồng thủy sản	0973595769	b2100026@student.ctu.edu.vn
B2100027	Hoàng Công Bình	NAM	Kinh tế	0936911552	b2100027@student.ctu.edu.vn
B2100028	Trương Khánh Huyền	NU	Nuôi trồng thủy sản	0945762875	b2100028@student.ctu.edu.vn
B2100029	Nguyễn Anh Tân	NAM	Nuôi trồng thủy sản	0970878392	b2100029@student.ctu.edu.vn
B2100030	Vũ Phương Vân	NU	Kỹ thuật cơ khí	0940520424	b2100030@student.ctu.edu.vn
B2100031	Huỳnh Đức Phong	NAM	Kinh tế	0988417370	b2100031@student.ctu.edu.vn
B2100032	Phạm Khánh Dung	NU	Tài chính - Ngân hàng	0352486437	b2100032@student.ctu.edu.vn
B2100033	Đỗ Gia Nghĩa	NAM	Tài chính - Ngân hàng	0987711121	b2100033@student.ctu.edu.vn
B2100034	Hồ Ngọc Phương	NU	Kỹ thuật điện	0961846400	b2100034@student.ctu.edu.vn
B2100035	Hồ Đức Tuấn	NAM	Sư phạm Toán học	0943120231	b2100035@student.ctu.edu.vn
B2100036	Bùi Thị Mai	NU	Nông học	0913366487	b2100036@student.ctu.edu.vn
B2100037	Đặng Gia Tân	NAM	Sư phạm Toán học	0979632579	b2100037@student.ctu.edu.vn
B2100038	Vũ Thu Ngọc	NU	An toàn thông tin	0332239665	b2100038@student.ctu.edu.vn
B2100039	Ngô Thanh Kiên	NAM	Quản trị kinh doanh	0983705927	b2100039@student.ctu.edu.vn
B2100040	Hồ Yến Yến	NU	Kỹ thuật cơ khí	0912235633	b2100040@student.ctu.edu.vn
B2100041	Hoàng Minh Nghĩa	NAM	Kế toán	0989965235	b2100041@student.ctu.edu.vn
B2100042	Phan Phương Quyên	NU	Kỹ thuật điện	0705731283	b2100042@student.ctu.edu.vn
B2100043	Trương Trung Thiện	NAM	Luật	0705993234	b2100043@student.ctu.edu.vn
B2100044	Dương Ngọc Tiên	NU	Công nghệ sinh học	0708672151	b2100044@student.ctu.edu.vn
B2100045	Hồ Văn Tùng	NAM	Công nghệ thông tin	0975026070	b2100045@student.ctu.edu.vn
B2100046	Hoàng Yến Châu	NU	Công nghệ thông tin	0917146805	b2100046@student.ctu.edu.vn
B2100047	Ngô Trung Thắng	NAM	Tài chính - Ngân hàng	0946295000	b2100047@student.ctu.edu.vn
B2100048	Võ Thùy Anh	NU	Mạng máy tính và truyền thông dữ liệu	0915317119	b2100048@student.ctu.edu.vn
B2100049	Nguyễn Văn Dũng	NAM	Kinh tế	0384791146	b2100049@student.ctu.edu.vn
B2100050	Nguyễn Ngọc Oanh	NU	Kỹ thuật phần mềm	0945974753	b2100050@student.ctu.edu.vn
B2100051	Hoàng Hữu Phát	NAM	Kỹ thuật phần mềm	0351769515	b2100051@student.ctu.edu.vn
B2100052	Nguyễn Thùy Châu	NU	Sư phạm Toán học	0948593689	b2100052@student.ctu.edu.vn
B2100053	Đoàn Gia Tân	NAM	Kế toán	0702629860	b2100053@student.ctu.edu.vn
B2100054	Phạm Ngọc Yến	NU	Kỹ thuật cơ khí	0359718647	b2100054@student.ctu.edu.vn
B2100055	Phạm Hữu An	NAM	Sư phạm Toán học	0836715612	b2100055@student.ctu.edu.vn
B2200056	Phạm Phương Giang	NU	Kỹ thuật cơ khí	0337399645	b2200056@student.ctu.edu.vn
B2200057	Hoàng Đức Sơn	NAM	Công nghệ sinh học	0968334042	b2200057@student.ctu.edu.vn
B2200058	Đặng Yến Diệp	NU	Ngôn ngữ Anh	0337328764	b2200058@student.ctu.edu.vn
B2200059	Đỗ Quốc Vinh	NAM	Luật	0979434959	b2200059@student.ctu.edu.vn
B2200060	Nguyễn Thùy Quyên	NU	Ngôn ngữ Anh	0385577318	b2200060@student.ctu.edu.vn
B2200061	Lý Nhật Phong	NAM	Kỹ thuật phần mềm	0981642312	b2200061@student.ctu.edu.vn
B2200062	Võ Thị Thủy	NU	Hệ thống thông tin	0981640279	b2200062@student.ctu.edu.vn
B2200063	Phạm Gia Tùng	NAM	Kế toán	0916145255	b2200063@student.ctu.edu.vn
B2200064	Phạm Yến Hiền	NU	Kinh tế	0357438853	b2200064@student.ctu.edu.vn
B2200065	Huỳnh Hữu Tùng	NAM	Mạng máy tính và truyền thông dữ liệu	0707673715	b2200065@student.ctu.edu.vn
B2200066	Vũ Khánh Trúc	NU	Mạng máy tính và truyền thông dữ liệu	0972954490	b2200066@student.ctu.edu.vn
B2200067	Vũ Hoàng Hào	NAM	An toàn thông tin	0974102107	b2200067@student.ctu.edu.vn
B2200068	Lý Yến Ngân	NU	Mạng máy tính và truyền thông dữ liệu	0967401073	b2200068@student.ctu.edu.vn
B2200069	Trần Quốc Tuấn	NAM	Sư phạm Toán học	0941973691	b2200069@student.ctu.edu.vn
B2200070	Phạm Thu Thảo	NU	Công nghệ thông tin	0350333560	b2200070@student.ctu.edu.vn
B2200071	Lý Hoàng Dũng	NAM	Kỹ thuật cơ khí	0985361518	b2200071@student.ctu.edu.vn
B2200072	Lê Thu Hiền	NU	Kỹ thuật phần mềm	0910177955	b2200072@student.ctu.edu.vn
B2200073	Hồ Công Quân	NAM	Luật	0934129240	b2200073@student.ctu.edu.vn
B2200074	Nguyễn Bảo Quỳnh	NU	An toàn thông tin	0832409807	b2200074@student.ctu.edu.vn
B2200075	Đặng Hữu Vinh	NAM	Luật	0934375892	b2200075@student.ctu.edu.vn
B2200076	Ngô Khánh Hà	NU	Nuôi trồng thủy sản	0913668634	b2200076@student.ctu.edu.vn
B2200077	Lý Quốc Kiên	NAM	An toàn thông tin	0332493221	b2200077@student.ctu.edu.vn
B2200078	Bùi Khánh Thơ	NU	Kỹ thuật cơ khí	0949281595	b2200078@student.ctu.edu.vn
B2200079	Lê Minh Phúc	NAM	Hệ thống thông tin	0943359639	b2200079@student.ctu.edu.vn
B2200080	Đỗ Bảo Như	NU	Kinh tế	0985827730	b2200080@student.ctu.edu.vn
B2200081	Phạm Hoàng Trí	NAM	Kinh tế	0932602810	b2200081@student.ctu.edu.vn
B2200082	Bùi Hồng Diệp	NU	Hệ thống thông tin	0974646429	b2200082@student.ctu.edu.vn
B2200083	Hồ Thanh Đạt	NAM	Công nghệ thông tin	0707008498	b2200083@student.ctu.edu.vn
B2200084	Võ Thị Yến	NU	Nông học	0911666048	b2200084@student.ctu.edu.vn
B2200085	Đoàn Minh Cường	NAM	Công nghệ sinh học	0944382282	b2200085@student.ctu.edu.vn
B2200086	Phan Hồng Duyên	NU	Tài chính - Ngân hàng	0982624477	b2200086@student.ctu.edu.vn
B2200087	Dương Văn Tân	NAM	Kỹ thuật phần mềm	0910522513	b2200087@student.ctu.edu.vn
B2200088	Trần Ngọc Vy	NU	Công nghệ thông tin	0833005050	b2200088@student.ctu.edu.vn
B2200089	Bùi Đức An	NAM	Sư phạm Toán học	0830159213	b2200089@student.ctu.edu.vn
B2200090	Dương Hồng Quỳnh	NU	Mạng máy tính và truyền thông dữ liệu	0337470071	b2200090@student.ctu.edu.vn
B2200091	Hồ Văn Nam	NAM	Nông học	0961646989	b2200091@student.ctu.edu.vn
B2200092	Phạm Phương My	NU	Nuôi trồng thủy sản	0939505749	b2200092@student.ctu.edu.vn
B2200093	Dương Hữu Hiếu	NAM	Luật	0355467172	b2200093@student.ctu.edu.vn
B2200094	Nguyễn Ngọc Quyên	NU	Nông học	0949862212	b2200094@student.ctu.edu.vn
B2200095	Trần Hoàng Khoa	NAM	Kỹ thuật điện	0333556635	b2200095@student.ctu.edu.vn
B2200096	Huỳnh Thanh Linh	NU	Sư phạm Toán học	0969478213	b2200096@student.ctu.edu.vn
B2200097	Nguyễn Hữu Tùng	NAM	Hệ thống thông tin	0838950818	b2200097@student.ctu.edu.vn
B2200098	Trần Phương Linh	NU	Hệ thống thông tin	0836908932	b2200098@student.ctu.edu.vn
B2200099	Phạm Quốc Thắng	NAM	Quản trị kinh doanh	0352772482	b2200099@student.ctu.edu.vn
B2200100	Phan Thu Anh	NU	Kế toán	0351586630	b2200100@student.ctu.edu.vn
B2200101	Võ Đức Long	NAM	An toàn thông tin	0336753820	b2200101@student.ctu.edu.vn
B2200102	Bùi Bảo Hân	NU	Kinh tế	0336784591	b2200102@student.ctu.edu.vn
B2200103	Huỳnh Nhật Khang	NAM	Kỹ thuật điện	0350900637	b2200103@student.ctu.edu.vn
B2200104	Hồ Minh Vân	NU	Kỹ thuật phần mềm	0708081303	b2200104@student.ctu.edu.vn
B2200105	Hồ Công Lâm	NAM	Kế toán	0835324080	b2200105@student.ctu.edu.vn
B2200106	Huỳnh Thanh Yến	NU	Kỹ thuật điện	0966034896	b2200106@student.ctu.edu.vn
B2200107	Lý Hữu Hào	NAM	Kinh tế	0335733861	b2200107@student.ctu.edu.vn
B2200108	Lê Thanh Vân	NU	Kỹ thuật phần mềm	0707877822	b2200108@student.ctu.edu.vn
B2200109	Trần Thanh Phúc	NAM	An toàn thông tin	0332734960	b2200109@student.ctu.edu.vn
B2200110	Đặng Minh Ngân	NU	Kỹ thuật phần mềm	0918162979	b2200110@student.ctu.edu.vn
B2300111	Đoàn Công Trí	NAM	Tài chính - Ngân hàng	0931039007	b2300111@student.ctu.edu.vn
B2300112	Vũ Thùy Loan	NU	Nuôi trồng thủy sản	0949120586	b2300112@student.ctu.edu.vn
B2300113	Huỳnh Công Hải	NAM	Sư phạm Toán học	0709391007	b2300113@student.ctu.edu.vn
B2300114	Nguyễn Mỹ Tâm	NU	Kế toán	0970190812	b2300114@student.ctu.edu.vn
B2300115	Đoàn Gia Thắng	NAM	An toàn thông tin	0938855453	b2300115@student.ctu.edu.vn
B2300116	Vũ Thanh Nga	NU	Luật	0944617134	b2300116@student.ctu.edu.vn
B2300117	Bùi Minh Trung	NAM	An toàn thông tin	0965716001	b2300117@student.ctu.edu.vn
B2300118	Trương Khánh Vy	NU	Tài chính - Ngân hàng	0382764026	b2300118@student.ctu.edu.vn
B2300119	Võ Nhật Đạt	NAM	Kỹ thuật điện	0935248287	b2300119@student.ctu.edu.vn
B2300120	Trần Phương Nhung	NU	Kế toán	0985140642	b2300120@student.ctu.edu.vn
B2300121	Trương Nhật Trung	NAM	Quản trị kinh doanh	0972656207	b2300121@student.ctu.edu.vn
B2300122	Lê Thanh Chi	NU	Công nghệ sinh học	0338316089	b2300122@student.ctu.edu.vn
B2300123	Lý Hữu Hải	NAM	Sư phạm Toán học	0936978615	b2300123@student.ctu.edu.vn
B2300124	Võ Hồng Duyên	NU	Khoa học máy tính	0350065710	b2300124@student.ctu.edu.vn
B2300125	Đỗ Văn Thành	NAM	Kế toán	0355097798	b2300125@student.ctu.edu.vn
B2300126	Đặng Bảo Hằng	NU	Kế toán	0350590562	b2300126@student.ctu.edu.vn
B2300127	Bùi Minh Lâm	NAM	Kỹ thuật cơ khí	0968561633	b2300127@student.ctu.edu.vn
B2300128	Huỳnh Thu Tâm	NU	Mạng máy tính và truyền thông dữ liệu	0938989527	b2300128@student.ctu.edu.vn
B2300129	Đỗ Hoàng Thành	NAM	Kế toán	0936207283	b2300129@student.ctu.edu.vn
B2300130	Trương Thùy Thư	NU	Tài chính - Ngân hàng	0331670591	b2300130@student.ctu.edu.vn
B2300131	Phạm Công Tiến	NAM	Nuôi trồng thủy sản	0985280018	b2300131@student.ctu.edu.vn
B2300132	Đặng Thanh Loan	NU	Kỹ thuật điện	0967932480	b2300132@student.ctu.edu.vn
B2300133	Ngô Văn Phong	NAM	Nông học	0910768185	b2300133@student.ctu.edu.vn
B2300134	Lý Phương Trinh	NU	Công nghệ thông tin	0830386468	b2300134@student.ctu.edu.vn
B2300135	Bùi Gia Phát	NAM	Kỹ thuật điện	0384432657	b2300135@student.ctu.edu.vn
B2300136	Nguyễn Thị Yến	NU	Kế toán	0351075543	b2300136@student.ctu.edu.vn
B2300137	Trần Hữu Vinh	NAM	Quản trị kinh doanh	0970713619	b2300137@student.ctu.edu.vn
B2300138	Trương Yến Tú	NU	Nuôi trồng thủy sản	0385700517	b2300138@student.ctu.edu.vn
B2300139	Lê Hoàng Vinh	NAM	Hệ thống thông tin	0706270363	b2300139@student.ctu.edu.vn
B2300140	Lý Thùy Chi	NU	Sư phạm Toán học	0969274750	b2300140@student.ctu.edu.vn
B2300141	Nguyễn Hoàng An	NAM	Nuôi trồng thủy sản	0916929987	b2300141@student.ctu.edu.vn
B2300142	Trương Minh Nhung	NU	Ngôn ngữ Anh	0917537194	b2300142@student.ctu.edu.vn
B2300143	Trần Minh Cường	NAM	Hệ thống thông tin	0963040803	b2300143@student.ctu.edu.vn
B2300144	Phạm Ngọc Giang	NU	Quản trị kinh doanh	0834618243	b2300144@student.ctu.edu.vn
B2300145	Trương Hữu Quân	NAM	Luật	0976711448	b2300145@student.ctu.edu.vn
B2300146	Trần Thị Yến	NU	Khoa học máy tính	0384509226	b2300146@student.ctu.edu.vn
B2300147	Dương Anh Thắng	NAM	Kỹ thuật phần mềm	0381773711	b2300147@student.ctu.edu.vn
B2300148	Lê Ngọc Tuyền	NU	Quản trị kinh doanh	0985287895	b2300148@student.ctu.edu.vn
B2300149	Vũ Minh Thiện	NAM	Kinh tế	0335258057	b2300149@student.ctu.edu.vn
B2300150	Vũ Mỹ Thảo	NU	Nông học	0963178935	b2300150@student.ctu.edu.vn
B2300151	Phan Quốc Lâm	NAM	Khoa học máy tính	0700323531	b2300151@student.ctu.edu.vn
B2300152	Huỳnh Bảo Hà	NU	Nuôi trồng thủy sản	0354485674	b2300152@student.ctu.edu.vn
B2300153	Bùi Công Huy	NAM	Sư phạm Toán học	0353357888	b2300153@student.ctu.edu.vn
B2300154	Nguyễn Phương Nhung	NU	Quản trị kinh doanh	0389026759	b2300154@student.ctu.edu.vn
B2300155	Trần Thanh Phúc	NAM	Kỹ thuật phần mềm	0833694631	b2300155@student.ctu.edu.vn
B2300156	Võ Bảo Thảo	NU	Kỹ thuật phần mềm	0707851658	b2300156@student.ctu.edu.vn
B2300157	Lý Gia Quân	NAM	Luật	0910176013	b2300157@student.ctu.edu.vn
B2300158	Lê Hồng Huyền	NU	Sư phạm Toán học	0916721445	b2300158@student.ctu.edu.vn
B2300159	Đặng Thanh Kiên	NAM	Hệ thống thông tin	0916521454	b2300159@student.ctu.edu.vn
B2300160	Trương Yến Nhung	NU	Công nghệ sinh học	0944619451	b2300160@student.ctu.edu.vn
B2300161	Hoàng Công Bình	NAM	Kỹ thuật điện	0703967730	b2300161@student.ctu.edu.vn
B2300162	Đỗ Mỹ Ngân	NU	Hệ thống thông tin	0837611755	b2300162@student.ctu.edu.vn
B2300163	Phạm Văn Nhân	NAM	Tài chính - Ngân hàng	0380281258	b2300163@student.ctu.edu.vn
B2300164	Vũ Mỹ Loan	NU	Mạng máy tính và truyền thông dữ liệu	0834524715	b2300164@student.ctu.edu.vn
B2300165	Vũ Anh Hùng	NAM	Khoa học máy tính	0960398140	b2300165@student.ctu.edu.vn
B2400166	Bùi Thanh Quỳnh	NU	Mạng máy tính và truyền thông dữ liệu	0354002052	b2400166@student.ctu.edu.vn
B2400167	Nguyễn Nhật Toàn	NAM	Tài chính - Ngân hàng	0704209104	b2400167@student.ctu.edu.vn
B2400168	Nguyễn Yến Hà	NU	Kế toán	0355061244	b2400168@student.ctu.edu.vn
B2400169	Hồ Đức Dũng	NAM	Nông học	0944810135	b2400169@student.ctu.edu.vn
B2400170	Đoàn Thùy Uyên	NU	Tài chính - Ngân hàng	0335418034	b2400170@student.ctu.edu.vn
B2400171	Đoàn Hoàng Phúc	NAM	Ngôn ngữ Anh	0832216301	b2400171@student.ctu.edu.vn
B2400172	Vũ Khánh Trang	NU	Quản trị kinh doanh	0960521741	b2400172@student.ctu.edu.vn
B2400173	Trần Nhật Lâm	NAM	Sư phạm Toán học	0939805543	b2400173@student.ctu.edu.vn
B2400174	Lý Yến Huyền	NU	Mạng máy tính và truyền thông dữ liệu	0989188232	b2400174@student.ctu.edu.vn
B2400175	Lê Nhật Tùng	NAM	Nông học	0830770321	b2400175@student.ctu.edu.vn
B2400176	Dương Thanh Nhi	NU	An toàn thông tin	0836178329	b2400176@student.ctu.edu.vn
B2400177	Huỳnh Văn Nhân	NAM	Công nghệ sinh học	0979032676	b2400177@student.ctu.edu.vn
B2400178	Trương Bảo Uyên	NU	Nông học	0912126511	b2400178@student.ctu.edu.vn
B2400179	Hồ Hoàng Phúc	NAM	Kinh tế	0915427529	b2400179@student.ctu.edu.vn
B2400180	Hồ Khánh Thảo	NU	Tài chính - Ngân hàng	0914699868	b2400180@student.ctu.edu.vn
B2400181	Trần Minh Kiên	NAM	Sư phạm Toán học	0332713237	b2400181@student.ctu.edu.vn
B2400182	Phan Ngọc Trang	NU	Công nghệ thông tin	0355450905	b2400182@student.ctu.edu.vn
B2400183	Đỗ Hữu Bình	NAM	Công nghệ thông tin	0357504341	b2400183@student.ctu.edu.vn
B2400184	Ngô Thùy Hiền	NU	Kỹ thuật điện	0834047522	b2400184@student.ctu.edu.vn
B2400185	Trần Nhật Hào	NAM	Công nghệ sinh học	0915796889	b2400185@student.ctu.edu.vn
B2400186	Huỳnh Mỹ Ngọc	NU	Kỹ thuật cơ khí	0704009587	b2400186@student.ctu.edu.vn
B2400187	Phan Anh Hải	NAM	Kỹ thuật điện	0974122644	b2400187@student.ctu.edu.vn
B2400188	Huỳnh Hồng Thảo	NU	Quản trị kinh doanh	0944881571	b2400188@student.ctu.edu.vn
B2400189	Phạm Công Khang	NAM	Mạng máy tính và truyền thông dữ liệu	0387885135	b2400189@student.ctu.edu.vn
B2400190	Ngô Thùy Thơ	NU	Khoa học máy tính	0933574366	b2400190@student.ctu.edu.vn
B2400191	Đỗ Đức Tiến	NAM	Luật	0352443875	b2400191@student.ctu.edu.vn
B2400192	Đỗ Thu Diệp	NU	Sư phạm Toán học	0357705301	b2400192@student.ctu.edu.vn
B2400193	Trương Đức Hiếu	NAM	Kỹ thuật điện	0331763481	b2400193@student.ctu.edu.vn
B2400194	Phạm Bảo My	NU	Hệ thống thông tin	0350970632	b2400194@student.ctu.edu.vn
B2400195	Hoàng Nhật Tài	NAM	Ngôn ngữ Anh	0333892361	b2400195@student.ctu.edu.vn
B2400196	Võ Thanh An	NU	Khoa học máy tính	0948309949	b2400196@student.ctu.edu.vn
B2400197	Đoàn Trung Tiến	NAM	Khoa học máy tính	0915728571	b2400197@student.ctu.edu.vn
B2400198	Bùi Hồng Linh	NU	Ngôn ngữ Anh	0947806103	b2400198@student.ctu.edu.vn
B2400199	Lý Thanh Quang	NAM	Kỹ thuật điện	0960053939	b2400199@student.ctu.edu.vn
B2400200	Dương Hồng Diệp	NU	Kinh tế	0355061843	b2400200@student.ctu.edu.vn
B2400201	Lê Gia Quân	NAM	Sư phạm Toán học	0916270379	b2400201@student.ctu.edu.vn
B2400202	Hoàng Hồng Nhi	NU	Luật	0836574974	b2400202@student.ctu.edu.vn
B2400203	Vũ Anh Nam	NAM	Luật	0914556770	b2400203@student.ctu.edu.vn
B2400204	Trương Thị An	NU	Kỹ thuật cơ khí	0837552211	b2400204@student.ctu.edu.vn
B2400205	Phạm Gia Toàn	NAM	Quản trị kinh doanh	0944612495	b2400205@student.ctu.edu.vn
B2400206	Vũ Thu Như	NU	Tài chính - Ngân hàng	0384485602	b2400206@student.ctu.edu.vn
B2400207	Ngô Quốc Lâm	NAM	Khoa học máy tính	0358012379	b2400207@student.ctu.edu.vn
B2400208	Lê Minh Phương	NU	Kỹ thuật phần mềm	0931771144	b2400208@student.ctu.edu.vn
B2400209	Trương Thanh Hải	NAM	Kỹ thuật phần mềm	0356669968	b2400209@student.ctu.edu.vn
B2400210	Đoàn Minh Uyên	NU	Luật	0973707712	b2400210@student.ctu.edu.vn
B2400211	Huỳnh Anh Khoa	NAM	Kỹ thuật phần mềm	0339843018	b2400211@student.ctu.edu.vn
B2400212	Phạm Mỹ Thảo	NU	Kỹ thuật cơ khí	0381386590	b2400212@student.ctu.edu.vn
B2400213	Nguyễn Anh Hùng	NAM	Kỹ thuật điện	0338828166	b2400213@student.ctu.edu.vn
B2400214	Bùi Thị Loan	NU	Công nghệ sinh học	0931163485	b2400214@student.ctu.edu.vn
B2400215	Ngô Hữu Trí	NAM	Công nghệ sinh học	0942096561	b2400215@student.ctu.edu.vn
B2400216	Huỳnh Ngọc Hằng	NU	Kế toán	0837207917	b2400216@student.ctu.edu.vn
B2400217	Vũ Gia Nam	NAM	Kỹ thuật cơ khí	0384012592	b2400217@student.ctu.edu.vn
B2400218	Đỗ Yến Tiên	NU	Kế toán	0354688853	b2400218@student.ctu.edu.vn
B2400219	Lê Hữu Trung	NAM	Kinh tế	0335626704	b2400219@student.ctu.edu.vn
B2400220	Bùi Bảo Vân	NU	Kinh tế	0945952463	b2400220@student.ctu.edu.vn
\.


--
-- Data for Name: tai_khoan; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tai_khoan (ma_tk, ten_dang_nhap, mat_khau_bam, vai_tro, mssv, ho_ten_hien_thi, trang_thai, phai_doi_mat_khau, ngay_tao) FROM stdin;
1	admin	$2b$10$z4KRyOk9EjfTIUHIShYkFeiPuYwsXgd7lefY3eOD5BXrVeWOza2/y	QUAN_LY	\N	Nguyễn Minh Quản (Trưởng Ban KTX)	HOAT_DONG	f	2026-11-19 18:25:23.885551+07
2	canbo1	$2b$10$z4KRyOk9EjfTIUHIShYkFeiPuYwsXgd7lefY3eOD5BXrVeWOza2/y	QUAN_LY	\N	Trần Thị Lan (Cán bộ Nội trú)	HOAT_DONG	f	2026-11-19 18:25:23.885551+07
3	B2100001	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100001	Nguyễn Văn An	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
4	B2100002	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100002	Trần Thị Bích Ngọc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
5	B2100003	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100003	Lý Trung Quân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
6	B2100004	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100004	Trần Thanh Nga	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
7	B2100005	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100005	Võ Hữu Thành	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
8	B2100006	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100006	Nguyễn Ngọc Duyên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
9	B2100007	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100007	Vũ Công Khoa	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
10	B2100008	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100008	Bùi Ngọc Tâm	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
11	B2100009	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100009	Ngô Anh Trí	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
12	B2100010	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100010	Bùi Phương Oanh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
13	B2100011	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100011	Trần Văn Toàn	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
14	B2100012	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100012	Dương Thanh Dung	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
15	B2100013	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100013	Vũ Hữu Đạt	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
16	B2100014	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100014	Bùi Ngọc Hương	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
17	B2100015	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100015	Nguyễn Nhật Bình	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
18	B2100016	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100016	Lý Thị My	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
19	B2100017	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100017	Hồ Hoàng Toàn	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
20	B2100018	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100018	Trần Minh Linh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
21	B2100019	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100019	Lý Công Nam	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
22	B2100020	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100020	Dương Mỹ Hà	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
23	B2100021	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100021	Dương Trung Thiện	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
24	B2100022	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100022	Hồ Mỹ Thư	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
25	B2100023	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100023	Huỳnh Gia Phúc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
26	B2100024	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100024	Bùi Yến Trinh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
27	B2100025	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100025	Hoàng Minh Khoa	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
28	B2100026	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100026	Dương Yến Ngọc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
29	B2100027	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100027	Hoàng Công Bình	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
30	B2100028	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100028	Trương Khánh Huyền	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
31	B2100029	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100029	Nguyễn Anh Tân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
32	B2100030	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100030	Vũ Phương Vân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
33	B2100031	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100031	Huỳnh Đức Phong	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
34	B2100032	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100032	Phạm Khánh Dung	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
35	B2100033	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100033	Đỗ Gia Nghĩa	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
36	B2100034	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100034	Hồ Ngọc Phương	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
37	B2100035	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100035	Hồ Đức Tuấn	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
38	B2100036	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100036	Bùi Thị Mai	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
39	B2100037	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100037	Đặng Gia Tân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
40	B2100038	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100038	Vũ Thu Ngọc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
41	B2100039	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100039	Ngô Thanh Kiên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
42	B2100040	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100040	Hồ Yến Yến	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
43	B2100041	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100041	Hoàng Minh Nghĩa	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
44	B2100042	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100042	Phan Phương Quyên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
45	B2100043	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100043	Trương Trung Thiện	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
46	B2100044	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100044	Dương Ngọc Tiên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
47	B2100045	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100045	Hồ Văn Tùng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
48	B2100046	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100046	Hoàng Yến Châu	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
49	B2100047	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100047	Ngô Trung Thắng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
50	B2100048	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100048	Võ Thùy Anh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
51	B2100049	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100049	Nguyễn Văn Dũng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
52	B2100050	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100050	Nguyễn Ngọc Oanh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
53	B2100051	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100051	Hoàng Hữu Phát	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
54	B2100052	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100052	Nguyễn Thùy Châu	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
55	B2100053	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100053	Đoàn Gia Tân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
56	B2100054	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100054	Phạm Ngọc Yến	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
57	B2100055	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2100055	Phạm Hữu An	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
58	B2200056	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200056	Phạm Phương Giang	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
59	B2200057	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200057	Hoàng Đức Sơn	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
60	B2200058	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200058	Đặng Yến Diệp	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
61	B2200059	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200059	Đỗ Quốc Vinh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
62	B2200060	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200060	Nguyễn Thùy Quyên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
63	B2200061	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200061	Lý Nhật Phong	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
64	B2200062	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200062	Võ Thị Thủy	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
65	B2200063	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200063	Phạm Gia Tùng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
66	B2200064	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200064	Phạm Yến Hiền	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
67	B2200065	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200065	Huỳnh Hữu Tùng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
68	B2200066	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200066	Vũ Khánh Trúc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
69	B2200067	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200067	Vũ Hoàng Hào	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
70	B2200068	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200068	Lý Yến Ngân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
71	B2200069	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200069	Trần Quốc Tuấn	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
72	B2200070	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200070	Phạm Thu Thảo	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
73	B2200071	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200071	Lý Hoàng Dũng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
74	B2200072	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200072	Lê Thu Hiền	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
75	B2200073	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200073	Hồ Công Quân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
76	B2200074	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200074	Nguyễn Bảo Quỳnh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
77	B2200075	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200075	Đặng Hữu Vinh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
78	B2200076	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200076	Ngô Khánh Hà	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
79	B2200077	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200077	Lý Quốc Kiên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
80	B2200078	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200078	Bùi Khánh Thơ	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
81	B2200079	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200079	Lê Minh Phúc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
82	B2200080	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200080	Đỗ Bảo Như	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
83	B2200081	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200081	Phạm Hoàng Trí	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
84	B2200082	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200082	Bùi Hồng Diệp	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
85	B2200083	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200083	Hồ Thanh Đạt	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
86	B2200084	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200084	Võ Thị Yến	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
87	B2200085	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200085	Đoàn Minh Cường	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
88	B2200086	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200086	Phan Hồng Duyên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
89	B2200087	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200087	Dương Văn Tân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
90	B2200088	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200088	Trần Ngọc Vy	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
91	B2200089	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200089	Bùi Đức An	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
92	B2200090	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200090	Dương Hồng Quỳnh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
93	B2200091	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200091	Hồ Văn Nam	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
94	B2200092	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200092	Phạm Phương My	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
95	B2200093	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200093	Dương Hữu Hiếu	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
96	B2200094	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200094	Nguyễn Ngọc Quyên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
97	B2200095	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200095	Trần Hoàng Khoa	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
98	B2200096	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200096	Huỳnh Thanh Linh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
99	B2200097	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200097	Nguyễn Hữu Tùng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
100	B2200098	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200098	Trần Phương Linh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
101	B2200099	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200099	Phạm Quốc Thắng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
102	B2200100	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200100	Phan Thu Anh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
103	B2200101	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200101	Võ Đức Long	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
104	B2200102	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200102	Bùi Bảo Hân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
105	B2200103	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200103	Huỳnh Nhật Khang	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
106	B2200104	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200104	Hồ Minh Vân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
107	B2200105	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200105	Hồ Công Lâm	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
108	B2200106	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200106	Huỳnh Thanh Yến	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
109	B2200107	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200107	Lý Hữu Hào	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
110	B2200108	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200108	Lê Thanh Vân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
111	B2200109	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200109	Trần Thanh Phúc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
112	B2200110	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2200110	Đặng Minh Ngân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
113	B2300111	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300111	Đoàn Công Trí	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
114	B2300112	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300112	Vũ Thùy Loan	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
115	B2300113	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300113	Huỳnh Công Hải	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
116	B2300114	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300114	Nguyễn Mỹ Tâm	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
117	B2300115	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300115	Đoàn Gia Thắng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
118	B2300116	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300116	Vũ Thanh Nga	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
119	B2300117	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300117	Bùi Minh Trung	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
120	B2300118	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300118	Trương Khánh Vy	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
121	B2300119	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300119	Võ Nhật Đạt	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
122	B2300120	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300120	Trần Phương Nhung	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
123	B2300121	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300121	Trương Nhật Trung	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
124	B2300122	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300122	Lê Thanh Chi	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
125	B2300123	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300123	Lý Hữu Hải	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
126	B2300124	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300124	Võ Hồng Duyên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
127	B2300125	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300125	Đỗ Văn Thành	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
128	B2300126	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300126	Đặng Bảo Hằng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
129	B2300127	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300127	Bùi Minh Lâm	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
130	B2300128	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300128	Huỳnh Thu Tâm	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
131	B2300129	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300129	Đỗ Hoàng Thành	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
132	B2300130	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300130	Trương Thùy Thư	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
133	B2300131	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300131	Phạm Công Tiến	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
134	B2300132	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300132	Đặng Thanh Loan	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
135	B2300133	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300133	Ngô Văn Phong	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
136	B2300134	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300134	Lý Phương Trinh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
137	B2300135	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300135	Bùi Gia Phát	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
138	B2300136	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300136	Nguyễn Thị Yến	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
139	B2300137	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300137	Trần Hữu Vinh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
140	B2300138	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300138	Trương Yến Tú	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
141	B2300139	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300139	Lê Hoàng Vinh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
142	B2300140	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300140	Lý Thùy Chi	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
143	B2300141	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300141	Nguyễn Hoàng An	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
144	B2300142	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300142	Trương Minh Nhung	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
145	B2300143	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300143	Trần Minh Cường	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
146	B2300144	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300144	Phạm Ngọc Giang	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
147	B2300145	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300145	Trương Hữu Quân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
148	B2300146	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300146	Trần Thị Yến	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
149	B2300147	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300147	Dương Anh Thắng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
150	B2300148	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300148	Lê Ngọc Tuyền	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
151	B2300149	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300149	Vũ Minh Thiện	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
152	B2300150	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300150	Vũ Mỹ Thảo	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
153	B2300151	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300151	Phan Quốc Lâm	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
154	B2300152	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300152	Huỳnh Bảo Hà	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
155	B2300153	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300153	Bùi Công Huy	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
156	B2300154	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300154	Nguyễn Phương Nhung	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
157	B2300155	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300155	Trần Thanh Phúc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
158	B2300156	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300156	Võ Bảo Thảo	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
159	B2300157	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300157	Lý Gia Quân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
160	B2300158	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300158	Lê Hồng Huyền	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
161	B2300159	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300159	Đặng Thanh Kiên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
162	B2300160	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300160	Trương Yến Nhung	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
163	B2300161	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300161	Hoàng Công Bình	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
164	B2300162	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300162	Đỗ Mỹ Ngân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
165	B2300163	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300163	Phạm Văn Nhân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
166	B2300164	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300164	Vũ Mỹ Loan	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
167	B2300165	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2300165	Vũ Anh Hùng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
168	B2400166	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400166	Bùi Thanh Quỳnh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
169	B2400167	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400167	Nguyễn Nhật Toàn	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
170	B2400168	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400168	Nguyễn Yến Hà	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
171	B2400169	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400169	Hồ Đức Dũng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
172	B2400170	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400170	Đoàn Thùy Uyên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
173	B2400171	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400171	Đoàn Hoàng Phúc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
174	B2400172	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400172	Vũ Khánh Trang	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
175	B2400173	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400173	Trần Nhật Lâm	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
176	B2400174	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400174	Lý Yến Huyền	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
177	B2400175	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400175	Lê Nhật Tùng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
178	B2400176	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400176	Dương Thanh Nhi	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
179	B2400177	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400177	Huỳnh Văn Nhân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
180	B2400178	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400178	Trương Bảo Uyên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
181	B2400179	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400179	Hồ Hoàng Phúc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
182	B2400180	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400180	Hồ Khánh Thảo	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
183	B2400181	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400181	Trần Minh Kiên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
184	B2400182	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400182	Phan Ngọc Trang	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
185	B2400183	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400183	Đỗ Hữu Bình	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
186	B2400184	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400184	Ngô Thùy Hiền	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
187	B2400185	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400185	Trần Nhật Hào	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
188	B2400186	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400186	Huỳnh Mỹ Ngọc	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
189	B2400187	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400187	Phan Anh Hải	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
190	B2400188	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400188	Huỳnh Hồng Thảo	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
191	B2400189	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400189	Phạm Công Khang	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
192	B2400190	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400190	Ngô Thùy Thơ	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
193	B2400191	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400191	Đỗ Đức Tiến	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
194	B2400192	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400192	Đỗ Thu Diệp	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
195	B2400193	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400193	Trương Đức Hiếu	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
196	B2400194	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400194	Phạm Bảo My	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
197	B2400195	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400195	Hoàng Nhật Tài	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
198	B2400196	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400196	Võ Thanh An	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
199	B2400197	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400197	Đoàn Trung Tiến	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
200	B2400198	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400198	Bùi Hồng Linh	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
201	B2400199	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400199	Lý Thanh Quang	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
202	B2400200	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400200	Dương Hồng Diệp	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
203	B2400201	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400201	Lê Gia Quân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
204	B2400202	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400202	Hoàng Hồng Nhi	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
205	B2400203	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400203	Vũ Anh Nam	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
206	B2400204	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400204	Trương Thị An	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
207	B2400205	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400205	Phạm Gia Toàn	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
208	B2400206	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400206	Vũ Thu Như	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
209	B2400207	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400207	Ngô Quốc Lâm	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
210	B2400208	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400208	Lê Minh Phương	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
211	B2400209	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400209	Trương Thanh Hải	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
212	B2400210	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400210	Đoàn Minh Uyên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
213	B2400211	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400211	Huỳnh Anh Khoa	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
214	B2400212	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400212	Phạm Mỹ Thảo	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
215	B2400213	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400213	Nguyễn Anh Hùng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
216	B2400214	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400214	Bùi Thị Loan	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
217	B2400215	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400215	Ngô Hữu Trí	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
218	B2400216	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400216	Huỳnh Ngọc Hằng	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
219	B2400217	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400217	Vũ Gia Nam	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
220	B2400218	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400218	Đỗ Yến Tiên	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
221	B2400219	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400219	Lê Hữu Trung	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
222	B2400220	$2b$10$3wQBhTSDuv1i76LCdcDnfOQgP0tHKG3EtA9UESLMBExe/cKXJsMxq	SINH_VIEN	B2400220	Bùi Bảo Vân	HOAT_DONG	t	2026-11-19 18:25:23.885551+07
\.


--
-- Data for Name: thanh_toan; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.thanh_toan (ma_tt, ma_hoa_don, mssv_nguoi_nop, so_tien, thoi_gian, ma_giao_dich) FROM stdin;
1	6	B2100012	3400000	2026-11-19 18:25:23.885551+07	QR-KTX-A106-20260901
2	7	B2100024	3600000	2026-11-19 18:25:23.885551+07	QR-KTX-A107-20260901
3	8	B2100038	3600000	2026-11-19 18:25:23.885551+07	QR-KTX-A108-20260901
4	11	B2100039	2400000	2026-11-19 18:25:23.885551+07	QR-KTX-A203-20260901
5	15	B2200066	3200000	2026-11-19 18:25:23.885551+07	QR-KTX-A207-20260901
6	18	B2200057	2400000	2026-11-19 18:25:23.885551+07	QR-KTX-A302-20260901
7	20	B2200069	3000000	2026-11-19 18:25:23.885551+07	QR-KTX-A304-20260901
8	24	B2200108	2800000	2026-11-19 18:25:23.885551+07	QR-KTX-B103-20260901
9	26	B2200079	3400000	2026-11-19 18:25:23.885551+07	QR-KTX-B105-20260901
10	27	B2200089	3400000	2026-11-19 18:25:23.885551+07	QR-KTX-B106-20260901
11	29	B2300113	3600000	2026-11-19 18:25:23.885551+07	QR-KTX-B108-20260901
12	30	B2300120	2400000	2026-11-19 18:25:23.885551+07	QR-KTX-B201-20260901
13	31	B2300128	2800000	2026-11-19 18:25:23.885551+07	QR-KTX-B202-20260901
14	32	B2300134	2400000	2026-11-19 18:25:23.885551+07	QR-KTX-B203-20260901
15	34	B2300127	3000000	2026-11-19 18:25:23.885551+07	QR-KTX-B205-20260901
16	35	B2300137	3400000	2026-11-19 18:25:23.885551+07	QR-KTX-B206-20260901
17	41	B2400170	3000000	2026-11-19 18:25:23.885551+07	QR-KTX-B304-20260901
18	42	B2100001	756000	2026-11-19 18:25:23.885551+07	QR-DN-A101-202609
19	43	B2100009	970000	2026-11-19 18:25:23.885551+07	QR-DN-A102-202609
20	44	B2100017	330000	2026-11-19 18:25:23.885551+07	QR-DN-A103-202609
21	45	B2100019	774000	2026-11-19 18:25:23.885551+07	QR-DN-A104-202609
22	46	B2100002	1302500	2026-11-19 18:25:23.885551+07	QR-DN-A105-202609
23	47	B2100012	1021000	2026-11-19 18:25:23.885551+07	QR-DN-A106-202609
24	48	B2100024	1493000	2026-11-19 18:25:23.885551+07	QR-DN-A107-202609
25	49	B2100038	1063000	2026-11-19 18:25:23.885551+07	QR-DN-A108-202609
26	50	B2100027	706000	2026-11-19 18:25:23.885551+07	QR-DN-A201-202609
27	51	B2100035	516000	2026-11-19 18:25:23.885551+07	QR-DN-A202-202609
28	52	B2100039	168500	2026-11-19 18:25:23.885551+07	QR-DN-A203-202609
29	54	B2100050	656000	2026-11-19 18:25:23.885551+07	QR-DN-A205-202609
30	55	B2200058	816000	2026-11-19 18:25:23.885551+07	QR-DN-A206-202609
31	56	B2200066	202500	2026-11-19 18:25:23.885551+07	QR-DN-A207-202609
32	57	B2200068	1186000	2026-11-19 18:25:23.885551+07	QR-DN-A208-202609
33	59	B2200057	842000	2026-11-19 18:25:23.885551+07	QR-DN-A302-202609
34	60	B2200065	374000	2026-11-19 18:25:23.885551+07	QR-DN-A303-202609
35	61	B2200069	1087500	2026-11-19 18:25:23.885551+07	QR-DN-A304-202609
36	62	B2200080	1233000	2026-11-19 18:25:23.885551+07	QR-DN-A305-202609
37	63	B2200092	932000	2026-11-19 18:25:23.885551+07	QR-DN-B101-202609
38	64	B2200100	770000	2026-11-19 18:25:23.885551+07	QR-DN-B102-202609
39	65	B2200108	316000	2026-11-19 18:25:23.885551+07	QR-DN-B103-202609
40	66	B2200110	1017500	2026-11-19 18:25:23.885551+07	QR-DN-B104-202609
41	67	B2200079	1017500	2026-11-19 18:25:23.885551+07	QR-DN-B105-202609
42	68	B2200089	1090000	2026-11-19 18:25:23.885551+07	QR-DN-B106-202609
43	69	B2200101	1252000	2026-11-19 18:25:23.885551+07	QR-DN-B107-202609
44	70	B2300113	1493000	2026-11-19 18:25:23.885551+07	QR-DN-B108-202609
45	71	B2300120	618000	2026-11-19 18:25:23.885551+07	QR-DN-B201-202609
46	72	B2300128	602500	2026-11-19 18:25:23.885551+07	QR-DN-B202-202609
47	73	B2300134	579000	2026-11-19 18:25:23.885551+07	QR-DN-B203-202609
48	76	B2300137	1250000	2026-11-19 18:25:23.885551+07	QR-DN-B206-202609
49	77	B2300147	200000	2026-11-19 18:25:23.885551+07	QR-DN-B207-202609
50	78	B2300149	1580500	2026-11-19 18:25:23.885551+07	QR-DN-B208-202609
51	81	B2300164	669000	2026-11-19 18:25:23.885551+07	QR-DN-B303-202609
52	82	B2400170	828000	2026-11-19 18:25:23.885551+07	QR-DN-B304-202609
53	83	B2100001	806000	2026-11-19 18:25:23.885551+07	QR-DN-A101-202610
54	84	B2100009	770000	2026-11-19 18:25:23.885551+07	QR-DN-A102-202610
55	85	B2100017	317500	2026-11-19 18:25:23.885551+07	QR-DN-A103-202610
56	86	B2100019	950000	2026-11-19 18:25:23.885551+07	QR-DN-A104-202610
57	88	B2100012	985000	2026-11-19 18:25:23.885551+07	QR-DN-A106-202610
58	89	B2100024	1101000	2026-11-19 18:25:23.885551+07	QR-DN-A107-202610
59	90	B2100038	1264000	2026-11-19 18:25:23.885551+07	QR-DN-A108-202610
60	92	B2100035	490000	2026-11-19 18:25:23.885551+07	QR-DN-A202-202610
61	93	B2100039	208000	2026-11-19 18:25:23.885551+07	QR-DN-A203-202610
62	96	B2200058	810000	2026-11-19 18:25:23.885551+07	QR-DN-A206-202610
63	97	B2200066	151000	2026-11-19 18:25:23.885551+07	QR-DN-A207-202610
64	98	B2200068	1300000	2026-11-19 18:25:23.885551+07	QR-DN-A208-202610
65	101	B2200065	309000	2026-11-19 18:25:23.885551+07	QR-DN-A303-202610
66	103	B2200080	942000	2026-11-19 18:25:23.885551+07	QR-DN-A305-202610
67	104	B2200092	714000	2026-11-19 18:25:23.885551+07	QR-DN-B101-202610
68	106	B2200108	239500	2026-11-19 18:25:23.885551+07	QR-DN-B103-202610
69	107	B2200110	1025000	2026-11-19 18:25:23.885551+07	QR-DN-B104-202610
70	108	B2200079	1092500	2026-11-19 18:25:23.885551+07	QR-DN-B105-202610
71	109	B2200089	916000	2026-11-19 18:25:23.885551+07	QR-DN-B106-202610
72	110	B2200101	985000	2026-11-19 18:25:23.885551+07	QR-DN-B107-202610
73	112	B2300120	618000	2026-11-19 18:25:23.885551+07	QR-DN-B201-202610
74	113	B2300128	664000	2026-11-19 18:25:23.885551+07	QR-DN-B202-202610
75	114	B2300134	648000	2026-11-19 18:25:23.885551+07	QR-DN-B203-202610
76	116	B2300127	755000	2026-11-19 18:25:23.885551+07	QR-DN-B205-202610
77	122	B2300164	453000	2026-11-19 18:25:23.885551+07	QR-DN-B303-202610
78	126	B2100017	232500	2026-11-19 18:25:23.885551+07	QR-DN-A103-202611
79	139	B2200068	1294000	2026-11-19 18:25:23.885551+07	QR-DN-A208-202611
80	141	B2200069	995000	2026-11-19 18:25:23.885551+07	QR-DN-A304-202611
81	148	B2200089	1201000	2026-11-19 18:25:23.885551+07	QR-DN-B106-202611
82	152	B2300128	776500	2026-11-19 18:25:23.885551+07	QR-DN-B202-202611
\.


--
-- Data for Name: thong_bao; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.thong_bao (ma_tb, mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung, thoi_gian, da_doc) FROM stdin;
338	B2100001	1	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A101	Hóa đơn điện nước tháng 11/2026 của phòng A101 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
339	B2100003	1	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A101	Hóa đơn điện nước tháng 11/2026 của phòng A101 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
340	B2100005	1	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A101	Hóa đơn điện nước tháng 11/2026 của phòng A101 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
341	B2100007	1	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A101	Hóa đơn điện nước tháng 11/2026 của phòng A101 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
342	B2100009	2	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A102	Hóa đơn điện nước tháng 11/2026 của phòng A102 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
343	B2100011	2	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A102	Hóa đơn điện nước tháng 11/2026 của phòng A102 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
344	B2100013	2	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A102	Hóa đơn điện nước tháng 11/2026 của phòng A102 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
345	B2100015	2	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A102	Hóa đơn điện nước tháng 11/2026 của phòng A102 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
346	B2100017	3	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A103	Hóa đơn điện nước tháng 11/2026 của phòng A103 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
347	B2100019	4	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A104	Hóa đơn điện nước tháng 11/2026 của phòng A104 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
348	B2100021	4	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A104	Hóa đơn điện nước tháng 11/2026 của phòng A104 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
349	B2100023	4	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A104	Hóa đơn điện nước tháng 11/2026 của phòng A104 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
350	B2100025	4	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A104	Hóa đơn điện nước tháng 11/2026 của phòng A104 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
351	B2100002	5	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A105	Hóa đơn điện nước tháng 11/2026 của phòng A105 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
352	B2100004	5	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A105	Hóa đơn điện nước tháng 11/2026 của phòng A105 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
353	B2100006	5	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A105	Hóa đơn điện nước tháng 11/2026 của phòng A105 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
354	B2100008	5	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A105	Hóa đơn điện nước tháng 11/2026 của phòng A105 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
355	B2100010	5	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A105	Hóa đơn điện nước tháng 11/2026 của phòng A105 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
356	B2100012	6	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A106	Hóa đơn điện nước tháng 11/2026 của phòng A106 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
357	B2100014	6	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A106	Hóa đơn điện nước tháng 11/2026 của phòng A106 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
358	B2100016	6	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A106	Hóa đơn điện nước tháng 11/2026 của phòng A106 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
359	B2100018	6	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A106	Hóa đơn điện nước tháng 11/2026 của phòng A106 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
360	B2100020	6	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A106	Hóa đơn điện nước tháng 11/2026 của phòng A106 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
361	B2100022	6	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A106	Hóa đơn điện nước tháng 11/2026 của phòng A106 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
362	B2100024	7	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A107	Hóa đơn điện nước tháng 11/2026 của phòng A107 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
363	B2100026	7	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A107	Hóa đơn điện nước tháng 11/2026 của phòng A107 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
364	B2100028	7	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A107	Hóa đơn điện nước tháng 11/2026 của phòng A107 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
365	B2100030	7	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A107	Hóa đơn điện nước tháng 11/2026 của phòng A107 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
366	B2100032	7	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A107	Hóa đơn điện nước tháng 11/2026 của phòng A107 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
367	B2100034	7	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A107	Hóa đơn điện nước tháng 11/2026 của phòng A107 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
368	B2100036	7	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A107	Hóa đơn điện nước tháng 11/2026 của phòng A107 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
369	B2100038	8	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A108	Hóa đơn điện nước tháng 11/2026 của phòng A108 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
370	B2100040	8	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A108	Hóa đơn điện nước tháng 11/2026 của phòng A108 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
371	B2100042	8	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A108	Hóa đơn điện nước tháng 11/2026 của phòng A108 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
372	B2100044	8	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A108	Hóa đơn điện nước tháng 11/2026 của phòng A108 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
373	B2100046	8	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A108	Hóa đơn điện nước tháng 11/2026 của phòng A108 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
374	B2100048	8	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A108	Hóa đơn điện nước tháng 11/2026 của phòng A108 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
375	B2100027	9	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A201	Hóa đơn điện nước tháng 11/2026 của phòng A201 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
376	B2100029	9	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A201	Hóa đơn điện nước tháng 11/2026 của phòng A201 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
377	B2100031	9	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A201	Hóa đơn điện nước tháng 11/2026 của phòng A201 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
378	B2100033	9	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A201	Hóa đơn điện nước tháng 11/2026 của phòng A201 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
379	B2100035	10	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A202	Hóa đơn điện nước tháng 11/2026 của phòng A202 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
380	B2100037	10	A	HOA_DON	Thông báo hóa đơn điện nước tháng 11/2026 - Phòng A202	Hóa đơn điện nước tháng 11/2026 của phòng A202 đã được phát hành. Đề nghị sinh viên đại diện phòng hoàn tất thanh toán trước hạn.	2026-11-19 12:25:23.727781+07	f
381	B2200092	25	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
382	B2200094	25	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
383	B2200096	25	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
384	B2200098	25	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
385	B2200100	26	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
386	B2200102	26	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
387	B2200104	26	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
388	B2200106	26	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
389	B2200108	27	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
390	B2200110	28	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
391	B2300112	28	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
392	B2300114	28	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
393	B2300116	28	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
394	B2300118	28	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
395	B2200079	29	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
396	B2200081	29	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
397	B2200083	29	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
398	B2200085	29	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
399	B2200087	29	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
400	B2200089	30	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
401	B2200091	30	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
402	B2200093	30	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
403	B2200095	30	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
404	B2200097	30	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
405	B2200099	30	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
406	B2200101	31	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
407	B2200103	31	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
408	B2200105	31	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
409	B2200107	31	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
410	B2200109	31	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
411	B2300111	31	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
412	B2300113	32	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
413	B2300115	32	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
414	B2300117	32	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
415	B2300119	32	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
416	B2300121	32	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
417	B2300123	32	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
418	B2300125	32	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
419	B2300120	33	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
420	B2300122	33	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
421	B2300124	33	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
422	B2300126	33	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
423	B2300128	34	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
424	B2300130	34	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
425	B2300132	34	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
426	B2300134	35	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
427	B2300136	35	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
428	B2300138	35	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
429	B2300140	36	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
430	B2300142	36	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
431	B2300144	36	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
432	B2300146	36	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
433	B2300148	36	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
434	B2300150	36	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
435	B2300127	37	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
436	B2300129	37	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
437	B2300131	37	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
438	B2300133	37	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
439	B2300135	37	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
440	B2300137	38	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
441	B2300139	38	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
442	B2300141	38	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
443	B2300143	38	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
444	B2300145	38	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
445	B2300147	39	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
446	B2300149	40	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
447	B2300151	40	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
448	B2300153	40	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
449	B2300155	40	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
450	B2300157	40	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
451	B2300159	40	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
452	B2300161	40	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
453	B2300152	41	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
454	B2300154	41	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
455	B2300156	42	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
456	B2300158	42	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
457	B2300160	42	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
458	B2300162	42	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
459	B2300164	43	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
460	B2400166	43	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
461	B2400168	43	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
462	B2400170	44	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
463	B2400172	44	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
464	B2400174	44	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
465	B2400176	44	B	BAO_TRI	Thông báo bảo trì hệ thống nước Khu B	Ban Quản lý KTX sẽ tiến hành vệ sinh bồn nước mái Khu B từ 13:00 đến 15:00 ngày mai. Mong các bạn chủ động trữ nước sinh hoạt.	2026-11-19 15:25:23.727781+07	f
\.


--
-- Data for Name: yeu_cau_bao_tri; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.yeu_cau_bao_tri (ma_yc, ma_phong, ma_khu, mssv, nhom_su_co, mo_ta, anh_url, trang_thai, thoi_gian, cap_nhat_luc) FROM stdin;
1	1	A	B2100001	DIEN	Bóng đèn tuýp khu vực bàn học bị nhấp nháy liên tục	\N	MOI	2026-11-16 05:25:23.727781+07	2026-11-19 18:25:23.885551+07
2	2	A	B2100009	NUOC	Vòi sen nhà vệ sinh rò rỉ nước nhẹ	\N	DA_TIEP_NHAN	2026-11-18 15:25:23.727781+07	2026-11-19 18:25:23.885551+07
3	4	A	B2100019	NOI_THAT	Bản lề tủ quần áo số 2 bị bung ốc	\N	DANG_XU_LY	2026-11-16 00:25:23.727781+07	2026-11-19 18:25:23.885551+07
4	9	A	B2100027	DIEN	Ổ cắm điện gần cửa ra vào không có nguồn	\N	HOAN_TAT	2026-11-17 04:25:23.727781+07	2026-11-19 18:25:23.885551+07
5	25	B	B2200092	NUOC	Bồn rửa mặt thoát nước chậm	\N	MOI	2026-11-17 18:25:23.727781+07	2026-11-19 18:25:23.885551+07
6	28	B	B2200110	CONG_TRINH	Cửa sổ hành lang bị kẹt chốt khóa	\N	DANG_XU_LY	2026-11-17 11:25:23.727781+07	2026-11-19 18:25:23.885551+07
7	34	B	B2300128	NOI_THAT	Quạt trần quay chậm và kêu lớn	\N	DA_TIEP_NHAN	2026-11-16 09:25:23.727781+07	2026-11-19 18:25:23.885551+07
8	24	A	\N	CONG_TRINH	Sơn sửa lại tường và thay mới hệ thống ống nước toàn phòng	\N	DANG_XU_LY	2026-11-19 05:25:23.727781+07	2026-11-19 18:25:23.885551+07
9	48	B	\N	DIEN	Nâng cấp tủ điện và thay mới dây dẫn âm tường	\N	DANG_XU_LY	2026-11-16 09:25:23.727781+07	2026-11-19 18:25:23.885551+07
10	\N	B	\N	NUOC	Bảo trì định kỳ bồn chứa nước mái Khu B (dự kiến cắt nước 13:00 - 15:00)	\N	DA_TIEP_NHAN	2026-11-19 03:25:23.727781+07	2026-11-19 18:25:23.885551+07
\.


--
-- Data for Name: yeu_cau_doi_phong; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.yeu_cau_doi_phong (ma_yc, mssv, ma_ky, phong_hien_tai, phong_moi, nguyen_vong_khu, nguyen_vong_loai, ly_do, trang_thai, ly_do_tu_choi, thoi_gian, ngay_xu_ly) FROM stdin;
1	B2100003	HK1_2026_2027	1	\N	A	4	Em muốn chuyển sang phòng cùng khu có bạn học chung lớp Công nghệ thông tin để tiện làm đồ án.	CHO_XU_LY	\N	2026-11-18 18:25:23.727781+07	\N
2	B2100004	HK1_2026_2027	5	\N	A	6	Em có nhu cầu chuyển sang phòng có nấu ăn để tự chuẩn bị bữa ăn theo chế độ sức khỏe.	CHO_XU_LY	\N	2026-11-18 18:25:23.727781+07	\N
3	B2200102	HK1_2026_2027	26	\N	B	4	Phòng hiện tại ở tầng 1 hơi ồn vào buổi sáng, em xin chuyển lên tầng cao hơn để ôn thi.	CHO_XU_LY	\N	2026-11-16 18:25:23.727781+07	\N
4	B2100037	HK1_2026_2027	10	9	A	4	Xin chuyển về gần phòng bạn cùng quê.	DA_DUYET	\N	2026-11-18 18:25:23.727781+07	2026-11-19 06:25:23.727781+07
5	B2300122	HK1_2026_2027	33	\N	A	4	Muốn chuyển sang phòng đơn 1 người.	TU_CHOI	KTX hiện không có loại phòng đơn 1 người, vui lòng chọn loại phòng 4, 6 hoặc 8 sinh viên.	2026-11-16 18:25:23.727781+07	2026-11-19 06:25:23.727781+07
\.


--
-- Name: don_gia_ma_dg_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.don_gia_ma_dg_seq', 4, true);


--
-- Name: hoa_don_ma_hoa_don_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hoa_don_ma_hoa_don_seq', 159, true);


--
-- Name: hop_dong_ma_hd_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.hop_dong_ma_hd_seq', 36, true);


--
-- Name: luot_ra_vao_ma_luot_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.luot_ra_vao_ma_luot_seq', 890, true);


--
-- Name: phong_ma_phong_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.phong_ma_phong_seq', 48, true);


--
-- Name: tai_khoan_ma_tk_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tai_khoan_ma_tk_seq', 222, true);


--
-- Name: thanh_toan_ma_tt_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.thanh_toan_ma_tt_seq', 82, true);


--
-- Name: thong_bao_ma_tb_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.thong_bao_ma_tb_seq', 465, true);


--
-- Name: yeu_cau_bao_tri_ma_yc_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.yeu_cau_bao_tri_ma_yc_seq', 10, true);


--
-- Name: yeu_cau_doi_phong_ma_yc_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.yeu_cau_doi_phong_ma_yc_seq', 5, true);


--
-- Name: cau_hinh cau_hinh_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cau_hinh
    ADD CONSTRAINT cau_hinh_pkey PRIMARY KEY (khoa);


--
-- Name: chi_so chi_so_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chi_so
    ADD CONSTRAINT chi_so_pkey PRIMARY KEY (ma_phong, thang);


--
-- Name: don_gia don_gia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.don_gia
    ADD CONSTRAINT don_gia_pkey PRIMARY KEY (ma_dg);


--
-- Name: hoa_don hoa_don_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hoa_don
    ADD CONSTRAINT hoa_don_pkey PRIMARY KEY (ma_hoa_don);


--
-- Name: hop_dong hop_dong_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hop_dong
    ADD CONSTRAINT hop_dong_pkey PRIMARY KEY (ma_hd);


--
-- Name: khu khu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.khu
    ADD CONSTRAINT khu_pkey PRIMARY KEY (ma_khu);


--
-- Name: khu khu_ten_khu_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.khu
    ADD CONSTRAINT khu_ten_khu_key UNIQUE (ten_khu);


--
-- Name: ky_hoc ky_hoc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ky_hoc
    ADD CONSTRAINT ky_hoc_pkey PRIMARY KEY (ma_ky);


--
-- Name: luot_ra_vao luot_ra_vao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.luot_ra_vao
    ADD CONSTRAINT luot_ra_vao_pkey PRIMARY KEY (ma_luot);


--
-- Name: luu_tru luu_tru_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.luu_tru
    ADD CONSTRAINT luu_tru_pkey PRIMARY KEY (mssv, ma_ky);


--
-- Name: phong phong_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phong
    ADD CONSTRAINT phong_pkey PRIMARY KEY (ma_phong);


--
-- Name: phong phong_ten_phong_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phong
    ADD CONSTRAINT phong_ten_phong_key UNIQUE (ten_phong);


--
-- Name: sinh_vien sinh_vien_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sinh_vien
    ADD CONSTRAINT sinh_vien_email_key UNIQUE (email);


--
-- Name: sinh_vien sinh_vien_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sinh_vien
    ADD CONSTRAINT sinh_vien_pkey PRIMARY KEY (mssv);


--
-- Name: tai_khoan tai_khoan_mssv_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tai_khoan
    ADD CONSTRAINT tai_khoan_mssv_key UNIQUE (mssv);


--
-- Name: tai_khoan tai_khoan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tai_khoan
    ADD CONSTRAINT tai_khoan_pkey PRIMARY KEY (ma_tk);


--
-- Name: tai_khoan tai_khoan_ten_dang_nhap_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tai_khoan
    ADD CONSTRAINT tai_khoan_ten_dang_nhap_key UNIQUE (ten_dang_nhap);


--
-- Name: thanh_toan thanh_toan_ma_giao_dich_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thanh_toan
    ADD CONSTRAINT thanh_toan_ma_giao_dich_key UNIQUE (ma_giao_dich);


--
-- Name: thanh_toan thanh_toan_ma_hoa_don_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thanh_toan
    ADD CONSTRAINT thanh_toan_ma_hoa_don_key UNIQUE (ma_hoa_don);


--
-- Name: thanh_toan thanh_toan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thanh_toan
    ADD CONSTRAINT thanh_toan_pkey PRIMARY KEY (ma_tt);


--
-- Name: thong_bao thong_bao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thong_bao
    ADD CONSTRAINT thong_bao_pkey PRIMARY KEY (ma_tb);


--
-- Name: hoa_don uq_hoa_don_phong_ky_thang_loai; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hoa_don
    ADD CONSTRAINT uq_hoa_don_phong_ky_thang_loai UNIQUE (ma_phong, ma_ky, thang, loai);


--
-- Name: yeu_cau_bao_tri yeu_cau_bao_tri_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_bao_tri
    ADD CONSTRAINT yeu_cau_bao_tri_pkey PRIMARY KEY (ma_yc);


--
-- Name: yeu_cau_doi_phong yeu_cau_doi_phong_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_doi_phong
    ADD CONSTRAINT yeu_cau_doi_phong_pkey PRIMARY KEY (ma_yc);


--
-- Name: idx_bao_tri_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bao_tri_loc ON public.yeu_cau_bao_tri USING btree (trang_thai, ma_khu, ma_phong, thoi_gian DESC);


--
-- Name: idx_chi_so_thang; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chi_so_thang ON public.chi_so USING btree (thang, ma_phong);


--
-- Name: idx_doi_phong_trang_thai; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doi_phong_trang_thai ON public.yeu_cau_doi_phong USING btree (trang_thai, thoi_gian DESC);


--
-- Name: idx_don_gia_loai_ap_dung; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_don_gia_loai_ap_dung ON public.don_gia USING btree (loai, ap_dung_tu DESC);


--
-- Name: idx_hoa_don_ky_phong; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hoa_don_ky_phong ON public.hoa_don USING btree (ma_ky, ma_phong, loai);


--
-- Name: idx_hoa_don_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hoa_don_loc ON public.hoa_don USING btree (loai, thang, trang_thai, ma_phong);


--
-- Name: idx_hop_dong_ky_trang_thai; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hop_dong_ky_trang_thai ON public.hop_dong USING btree (ma_ky, trang_thai);


--
-- Name: idx_luot_ra_vao_mssv_thoi_gian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_luot_ra_vao_mssv_thoi_gian ON public.luot_ra_vao USING btree (mssv, thoi_gian DESC);


--
-- Name: idx_luot_ra_vao_thoi_gian_loai; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_luot_ra_vao_thoi_gian_loai ON public.luot_ra_vao USING btree (thoi_gian DESC, loai);


--
-- Name: idx_luu_tru_phong_ky_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_luu_tru_phong_ky_active ON public.luu_tru USING btree (ma_phong, ma_ky) WHERE (ngay_ra IS NULL);


--
-- Name: idx_phong_bo_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phong_bo_loc ON public.phong USING btree (ma_khu, suc_chua, gioi_tinh, co_nau_an, tinh_trang);


--
-- Name: idx_sinh_vien_ho_ten; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sinh_vien_ho_ten ON public.sinh_vien USING btree (ho_ten);


--
-- Name: idx_sinh_vien_nganh; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sinh_vien_nganh ON public.sinh_vien USING btree (nganh);


--
-- Name: idx_thong_bao_mssv_thoi_gian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_thong_bao_mssv_thoi_gian ON public.thong_bao USING btree (mssv, da_doc, thoi_gian DESC);


--
-- Name: uq_doi_phong_dang_cho; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_doi_phong_dang_cho ON public.yeu_cau_doi_phong USING btree (mssv) WHERE ((trang_thai)::text = 'CHO_XU_LY'::text);


--
-- Name: uq_hop_dong_hieu_luc; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_hop_dong_hieu_luc ON public.hop_dong USING btree (ma_phong, ma_ky) WHERE ((trang_thai)::text = 'HIEU_LUC'::text);


--
-- Name: uq_ky_hoc_hien_hanh; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ky_hoc_hien_hanh ON public.ky_hoc USING btree (dang_hien_hanh) WHERE (dang_hien_hanh = true);


--
-- Name: luu_tru trg_cap_nhat_trang_thai_phong; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cap_nhat_trang_thai_phong AFTER INSERT OR DELETE OR UPDATE ON public.luu_tru FOR EACH ROW EXECUTE FUNCTION public.fn_trg_cap_nhat_trang_thai_phong();


--
-- Name: hoa_don trg_chan_sua_xoa_hoa_don_da_nop; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chan_sua_xoa_hoa_don_da_nop BEFORE DELETE OR UPDATE ON public.hoa_don FOR EACH ROW EXECUTE FUNCTION public.fn_trg_chan_sua_xoa_hoa_don_da_nop();


--
-- Name: hop_dong trg_kiem_tra_hop_dong; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kiem_tra_hop_dong BEFORE INSERT OR UPDATE ON public.hop_dong FOR EACH ROW EXECUTE FUNCTION public.fn_trg_kiem_tra_hop_dong();


--
-- Name: luu_tru trg_kiem_tra_luu_tru; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kiem_tra_luu_tru BEFORE INSERT OR UPDATE OF ma_phong, ma_ky, ngay_ra ON public.luu_tru FOR EACH ROW EXECUTE FUNCTION public.fn_trg_kiem_tra_luu_tru();


--
-- Name: phong trg_kiem_tra_sua_phong; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kiem_tra_sua_phong BEFORE UPDATE OF suc_chua, gioi_tinh, tinh_trang ON public.phong FOR EACH ROW EXECUTE FUNCTION public.fn_trg_kiem_tra_sua_phong();


--
-- Name: yeu_cau_bao_tri trg_thong_bao_bao_tri; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_thong_bao_bao_tri AFTER UPDATE OF trang_thai ON public.yeu_cau_bao_tri FOR EACH ROW EXECUTE FUNCTION public.fn_trg_thong_bao_bao_tri();


--
-- Name: chi_so chi_so_ma_phong_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chi_so
    ADD CONSTRAINT chi_so_ma_phong_fkey FOREIGN KEY (ma_phong) REFERENCES public.phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: hoa_don hoa_don_ma_ky_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hoa_don
    ADD CONSTRAINT hoa_don_ma_ky_fkey FOREIGN KEY (ma_ky) REFERENCES public.ky_hoc(ma_ky) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: hoa_don hoa_don_ma_phong_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hoa_don
    ADD CONSTRAINT hoa_don_ma_phong_fkey FOREIGN KEY (ma_phong) REFERENCES public.phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: hop_dong hop_dong_ma_ky_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hop_dong
    ADD CONSTRAINT hop_dong_ma_ky_fkey FOREIGN KEY (ma_ky) REFERENCES public.ky_hoc(ma_ky) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: hop_dong hop_dong_ma_phong_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hop_dong
    ADD CONSTRAINT hop_dong_ma_phong_fkey FOREIGN KEY (ma_phong) REFERENCES public.phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: hop_dong hop_dong_mssv_dai_dien_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hop_dong
    ADD CONSTRAINT hop_dong_mssv_dai_dien_fkey FOREIGN KEY (mssv_dai_dien) REFERENCES public.sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: luot_ra_vao luot_ra_vao_mssv_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.luot_ra_vao
    ADD CONSTRAINT luot_ra_vao_mssv_fkey FOREIGN KEY (mssv) REFERENCES public.sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: luu_tru luu_tru_ma_ky_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.luu_tru
    ADD CONSTRAINT luu_tru_ma_ky_fkey FOREIGN KEY (ma_ky) REFERENCES public.ky_hoc(ma_ky) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: luu_tru luu_tru_ma_phong_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.luu_tru
    ADD CONSTRAINT luu_tru_ma_phong_fkey FOREIGN KEY (ma_phong) REFERENCES public.phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: luu_tru luu_tru_mssv_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.luu_tru
    ADD CONSTRAINT luu_tru_mssv_fkey FOREIGN KEY (mssv) REFERENCES public.sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: phong phong_ma_khu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phong
    ADD CONSTRAINT phong_ma_khu_fkey FOREIGN KEY (ma_khu) REFERENCES public.khu(ma_khu) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tai_khoan tai_khoan_mssv_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tai_khoan
    ADD CONSTRAINT tai_khoan_mssv_fkey FOREIGN KEY (mssv) REFERENCES public.sinh_vien(mssv) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: thanh_toan thanh_toan_ma_hoa_don_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thanh_toan
    ADD CONSTRAINT thanh_toan_ma_hoa_don_fkey FOREIGN KEY (ma_hoa_don) REFERENCES public.hoa_don(ma_hoa_don) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: thanh_toan thanh_toan_mssv_nguoi_nop_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thanh_toan
    ADD CONSTRAINT thanh_toan_mssv_nguoi_nop_fkey FOREIGN KEY (mssv_nguoi_nop) REFERENCES public.sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: thong_bao thong_bao_ma_khu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thong_bao
    ADD CONSTRAINT thong_bao_ma_khu_fkey FOREIGN KEY (ma_khu) REFERENCES public.khu(ma_khu) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: thong_bao thong_bao_ma_phong_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thong_bao
    ADD CONSTRAINT thong_bao_ma_phong_fkey FOREIGN KEY (ma_phong) REFERENCES public.phong(ma_phong) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: thong_bao thong_bao_mssv_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thong_bao
    ADD CONSTRAINT thong_bao_mssv_fkey FOREIGN KEY (mssv) REFERENCES public.sinh_vien(mssv) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: yeu_cau_bao_tri yeu_cau_bao_tri_ma_khu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_bao_tri
    ADD CONSTRAINT yeu_cau_bao_tri_ma_khu_fkey FOREIGN KEY (ma_khu) REFERENCES public.khu(ma_khu) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: yeu_cau_bao_tri yeu_cau_bao_tri_ma_phong_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_bao_tri
    ADD CONSTRAINT yeu_cau_bao_tri_ma_phong_fkey FOREIGN KEY (ma_phong) REFERENCES public.phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: yeu_cau_bao_tri yeu_cau_bao_tri_mssv_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_bao_tri
    ADD CONSTRAINT yeu_cau_bao_tri_mssv_fkey FOREIGN KEY (mssv) REFERENCES public.sinh_vien(mssv) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: yeu_cau_doi_phong yeu_cau_doi_phong_ma_ky_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_doi_phong
    ADD CONSTRAINT yeu_cau_doi_phong_ma_ky_fkey FOREIGN KEY (ma_ky) REFERENCES public.ky_hoc(ma_ky) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: yeu_cau_doi_phong yeu_cau_doi_phong_mssv_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_doi_phong
    ADD CONSTRAINT yeu_cau_doi_phong_mssv_fkey FOREIGN KEY (mssv) REFERENCES public.sinh_vien(mssv) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: yeu_cau_doi_phong yeu_cau_doi_phong_nguyen_vong_khu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_doi_phong
    ADD CONSTRAINT yeu_cau_doi_phong_nguyen_vong_khu_fkey FOREIGN KEY (nguyen_vong_khu) REFERENCES public.khu(ma_khu) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: yeu_cau_doi_phong yeu_cau_doi_phong_phong_hien_tai_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_doi_phong
    ADD CONSTRAINT yeu_cau_doi_phong_phong_hien_tai_fkey FOREIGN KEY (phong_hien_tai) REFERENCES public.phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: yeu_cau_doi_phong yeu_cau_doi_phong_phong_moi_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yeu_cau_doi_phong
    ADD CONSTRAINT yeu_cau_doi_phong_phong_moi_fkey FOREIGN KEY (phong_moi) REFERENCES public.phong(ma_phong) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO ktx_admin_role;
GRANT USAGE ON SCHEMA public TO ktx_app_user;


--
-- Name: FUNCTION fn_de_xuat_gop_phong(p_ma_ky character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_de_xuat_gop_phong(p_ma_ky character varying) TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_de_xuat_gop_phong(p_ma_ky character varying) TO ktx_app_user;


--
-- Name: FUNCTION fn_dong_bo_trang_thai_mot_phong(p_ma_phong integer, p_ma_ky character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_dong_bo_trang_thai_mot_phong(p_ma_phong integer, p_ma_ky character varying) TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_dong_bo_trang_thai_mot_phong(p_ma_phong integer, p_ma_ky character varying) TO ktx_app_user;


--
-- Name: FUNCTION fn_ky_hoc_hien_hanh(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_ky_hoc_hien_hanh() TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_ky_hoc_hien_hanh() TO ktx_app_user;


--
-- Name: FUNCTION fn_sinh_vien_chua_ve(p_ngay date, p_moc_gio time without time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_sinh_vien_chua_ve(p_ngay date, p_moc_gio time without time zone) TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_sinh_vien_chua_ve(p_ngay date, p_moc_gio time without time zone) TO ktx_app_user;


--
-- Name: FUNCTION fn_trg_cap_nhat_trang_thai_phong(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_trg_cap_nhat_trang_thai_phong() TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_trg_cap_nhat_trang_thai_phong() TO ktx_app_user;


--
-- Name: FUNCTION fn_trg_chan_sua_xoa_hoa_don_da_nop(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_trg_chan_sua_xoa_hoa_don_da_nop() TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_trg_chan_sua_xoa_hoa_don_da_nop() TO ktx_app_user;


--
-- Name: FUNCTION fn_trg_kiem_tra_hop_dong(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_trg_kiem_tra_hop_dong() TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_trg_kiem_tra_hop_dong() TO ktx_app_user;


--
-- Name: FUNCTION fn_trg_kiem_tra_luu_tru(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_trg_kiem_tra_luu_tru() TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_trg_kiem_tra_luu_tru() TO ktx_app_user;


--
-- Name: FUNCTION fn_trg_kiem_tra_sua_phong(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_trg_kiem_tra_sua_phong() TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_trg_kiem_tra_sua_phong() TO ktx_app_user;


--
-- Name: FUNCTION fn_trg_thong_bao_bao_tri(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_trg_thong_bao_bao_tri() TO ktx_admin_role;
GRANT ALL ON FUNCTION public.fn_trg_thong_bao_bao_tri() TO ktx_app_user;


--
-- Name: FUNCTION sp_duyet_doi_phong(p_ma_yc integer, p_phong_moi integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sp_duyet_doi_phong(p_ma_yc integer, p_phong_moi integer) TO ktx_admin_role;
GRANT ALL ON FUNCTION public.sp_duyet_doi_phong(p_ma_yc integer, p_phong_moi integer) TO ktx_app_user;


--
-- Name: FUNCTION sp_gop_phong_cuoi_ky(p_de_xuat jsonb, p_ma_ky character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sp_gop_phong_cuoi_ky(p_de_xuat jsonb, p_ma_ky character varying) TO ktx_admin_role;
GRANT ALL ON FUNCTION public.sp_gop_phong_cuoi_ky(p_de_xuat jsonb, p_ma_ky character varying) TO ktx_app_user;


--
-- Name: FUNCTION sp_nhap_chi_so_va_tao_hoa_don(p_ma_phong integer, p_thang character varying, p_dien_cuoi integer, p_nuoc_cuoi integer, p_ma_ky character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sp_nhap_chi_so_va_tao_hoa_don(p_ma_phong integer, p_thang character varying, p_dien_cuoi integer, p_nuoc_cuoi integer, p_ma_ky character varying) TO ktx_admin_role;
GRANT ALL ON FUNCTION public.sp_nhap_chi_so_va_tao_hoa_don(p_ma_phong integer, p_thang character varying, p_dien_cuoi integer, p_nuoc_cuoi integer, p_ma_ky character varying) TO ktx_app_user;


--
-- Name: FUNCTION sp_tao_hoa_don_ktx_ky(p_ma_ky character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sp_tao_hoa_don_ktx_ky(p_ma_ky character varying) TO ktx_admin_role;
GRANT ALL ON FUNCTION public.sp_tao_hoa_don_ktx_ky(p_ma_ky character varying) TO ktx_app_user;


--
-- Name: FUNCTION sp_thanh_toan_hoa_don(p_ma_hoa_don integer, p_mssv character varying, p_ma_giao_dich character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sp_thanh_toan_hoa_don(p_ma_hoa_don integer, p_mssv character varying, p_ma_giao_dich character varying) TO ktx_admin_role;
GRANT ALL ON FUNCTION public.sp_thanh_toan_hoa_don(p_ma_hoa_don integer, p_mssv character varying, p_ma_giao_dich character varying) TO ktx_app_user;


--
-- Name: FUNCTION sp_xep_phong_tu_dong(p_mssv_list character varying[], p_suc_chua integer, p_ma_khu character varying, p_co_nau_an boolean, p_cho_phep_chua_day boolean, p_chi_xem_truoc boolean, p_ma_ky character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sp_xep_phong_tu_dong(p_mssv_list character varying[], p_suc_chua integer, p_ma_khu character varying, p_co_nau_an boolean, p_cho_phep_chua_day boolean, p_chi_xem_truoc boolean, p_ma_ky character varying) TO ktx_admin_role;
GRANT ALL ON FUNCTION public.sp_xep_phong_tu_dong(p_mssv_list character varying[], p_suc_chua integer, p_ma_khu character varying, p_co_nau_an boolean, p_cho_phep_chua_day boolean, p_chi_xem_truoc boolean, p_ma_ky character varying) TO ktx_app_user;


--
-- Name: TABLE cau_hinh; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cau_hinh TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cau_hinh TO ktx_app_user;


--
-- Name: TABLE chi_so; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chi_so TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.chi_so TO ktx_app_user;


--
-- Name: TABLE don_gia; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.don_gia TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.don_gia TO ktx_app_user;


--
-- Name: SEQUENCE don_gia_ma_dg_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.don_gia_ma_dg_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.don_gia_ma_dg_seq TO ktx_app_user;


--
-- Name: TABLE hoa_don; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hoa_don TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hoa_don TO ktx_app_user;


--
-- Name: SEQUENCE hoa_don_ma_hoa_don_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.hoa_don_ma_hoa_don_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.hoa_don_ma_hoa_don_seq TO ktx_app_user;


--
-- Name: TABLE hop_dong; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hop_dong TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hop_dong TO ktx_app_user;


--
-- Name: SEQUENCE hop_dong_ma_hd_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.hop_dong_ma_hd_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.hop_dong_ma_hd_seq TO ktx_app_user;


--
-- Name: TABLE khu; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.khu TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.khu TO ktx_app_user;


--
-- Name: TABLE ky_hoc; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ky_hoc TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ky_hoc TO ktx_app_user;


--
-- Name: TABLE luot_ra_vao; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.luot_ra_vao TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.luot_ra_vao TO ktx_app_user;


--
-- Name: SEQUENCE luot_ra_vao_ma_luot_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.luot_ra_vao_ma_luot_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.luot_ra_vao_ma_luot_seq TO ktx_app_user;


--
-- Name: TABLE luu_tru; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.luu_tru TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.luu_tru TO ktx_app_user;


--
-- Name: TABLE phong; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.phong TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.phong TO ktx_app_user;


--
-- Name: SEQUENCE phong_ma_phong_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.phong_ma_phong_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.phong_ma_phong_seq TO ktx_app_user;


--
-- Name: TABLE sinh_vien; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sinh_vien TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sinh_vien TO ktx_app_user;


--
-- Name: TABLE tai_khoan; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tai_khoan TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tai_khoan TO ktx_app_user;


--
-- Name: SEQUENCE tai_khoan_ma_tk_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.tai_khoan_ma_tk_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.tai_khoan_ma_tk_seq TO ktx_app_user;


--
-- Name: TABLE thanh_toan; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.thanh_toan TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.thanh_toan TO ktx_app_user;


--
-- Name: SEQUENCE thanh_toan_ma_tt_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.thanh_toan_ma_tt_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.thanh_toan_ma_tt_seq TO ktx_app_user;


--
-- Name: TABLE thong_bao; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.thong_bao TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.thong_bao TO ktx_app_user;


--
-- Name: SEQUENCE thong_bao_ma_tb_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.thong_bao_ma_tb_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.thong_bao_ma_tb_seq TO ktx_app_user;


--
-- Name: TABLE v_bao_cao_dien_nuoc; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_bao_cao_dien_nuoc TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_bao_cao_dien_nuoc TO ktx_app_user;


--
-- Name: TABLE v_luot_vao_7_ngay; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_luot_vao_7_ngay TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_luot_vao_7_ngay TO ktx_app_user;


--
-- Name: TABLE yeu_cau_bao_tri; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.yeu_cau_bao_tri TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.yeu_cau_bao_tri TO ktx_app_user;


--
-- Name: TABLE v_phong_chi_tiet; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_phong_chi_tiet TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_phong_chi_tiet TO ktx_app_user;


--
-- Name: TABLE v_sinh_vien_chua_ve_hom_nay; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_sinh_vien_chua_ve_hom_nay TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_sinh_vien_chua_ve_hom_nay TO ktx_app_user;


--
-- Name: TABLE v_tong_quan_ktx; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_tong_quan_ktx TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_tong_quan_ktx TO ktx_app_user;


--
-- Name: SEQUENCE yeu_cau_bao_tri_ma_yc_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.yeu_cau_bao_tri_ma_yc_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.yeu_cau_bao_tri_ma_yc_seq TO ktx_app_user;


--
-- Name: TABLE yeu_cau_doi_phong; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.yeu_cau_doi_phong TO ktx_admin_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.yeu_cau_doi_phong TO ktx_app_user;


--
-- Name: SEQUENCE yeu_cau_doi_phong_ma_yc_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.yeu_cau_doi_phong_ma_yc_seq TO ktx_admin_role;
GRANT SELECT,USAGE ON SEQUENCE public.yeu_cau_doi_phong_ma_yc_seq TO ktx_app_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO ktx_app_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO ktx_app_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO ktx_app_user;


--
-- PostgreSQL database dump complete
--

\unrestrict e0yzmmXyWdtBGyAfjPFjjE6GVcJrlVEoB3BLXMtp1mfps2RdOHFqkM9UmSwKjcP


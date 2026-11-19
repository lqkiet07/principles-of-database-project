-- =============================================================================
-- HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ TRƯỜNG ĐẠI HỌC CẦN THƠ (CTU)
-- File 04: Stored Procedures / Functions chạy giao dịch ACID & khóa dòng (Mục 7.2 & 7.3)
-- =============================================================================

-- 1. Xếp phòng tự động (hỗ trợ chế độ xem trước và chế độ xác nhận nguyên tử)
CREATE OR REPLACE FUNCTION sp_xep_phong_tu_dong(
    p_mssv_list         VARCHAR[],
    p_suc_chua          INTEGER,
    p_ma_khu            VARCHAR(10) DEFAULT NULL,
    p_co_nau_an         BOOLEAN DEFAULT NULL,
    p_cho_phep_chua_day BOOLEAN DEFAULT FALSE,
    p_chi_xem_truoc     BOOLEAN DEFAULT FALSE,
    p_ma_ky             VARCHAR(20) DEFAULT NULL
)
RETURNS JSONB
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

-- 2. Đề xuất & thực thi Gộp phòng cuối kỳ (Mục 4.2 & 7.2)
CREATE OR REPLACE FUNCTION fn_de_xuat_gop_phong(p_ma_ky VARCHAR(20) DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
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

CREATE OR REPLACE FUNCTION sp_gop_phong_cuoi_ky(
    p_de_xuat JSONB,
    p_ma_ky   VARCHAR(20) DEFAULT NULL
)
RETURNS JSONB
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

-- 3. Nhập chỉ số điện nước và tính/tạo hóa đơn phòng trong 1 giao dịch (Mục 4.3 & 7.3)
CREATE OR REPLACE FUNCTION sp_nhap_chi_so_va_tao_hoa_don(
    p_ma_phong   INTEGER,
    p_thang      VARCHAR(7),
    p_dien_cuoi  INTEGER,
    p_nuoc_cuoi  INTEGER,
    p_ma_ky      VARCHAR(20) DEFAULT NULL
)
RETURNS JSONB
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

-- 4. Phát hành hóa đơn tiền KTX theo kỳ cho các phòng đang có người ở
CREATE OR REPLACE FUNCTION sp_tao_hoa_don_ktx_ky(p_ma_ky VARCHAR(20) DEFAULT NULL)
RETURNS INTEGER
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

-- 5. Thanh toán hóa đơn bằng mã QR giả lập (khóa dòng chống thanh toán trùng - Mục 5.1 & 7.2)
CREATE OR REPLACE FUNCTION sp_thanh_toan_hoa_don(
    p_ma_hoa_don   INTEGER,
    p_mssv         VARCHAR(8),
    p_ma_giao_dich VARCHAR(64) DEFAULT NULL
)
RETURNS JSONB
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

-- 6. Duyệt yêu cầu đổi phòng nguyên tử (lưu ghi chú chuyển phòng quản lý KTX)
CREATE OR REPLACE FUNCTION sp_duyet_doi_phong(
    p_ma_yc     INTEGER,
    p_phong_moi INTEGER,
    p_ghi_chu   TEXT DEFAULT NULL
)
RETURNS JSONB
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
    v_ghi_chu_clean TEXT;
    v_noi_dung_tb   TEXT;
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

    v_ghi_chu_clean := NULLIF(trim(COALESCE(p_ghi_chu, '')), '');

    UPDATE yeu_cau_doi_phong
    SET phong_moi = p_phong_moi,
        trang_thai = 'DA_DUYET',
        ghi_chu_duyet = v_ghi_chu_clean,
        ngay_xu_ly = NOW()
    WHERE ma_yc = p_ma_yc;

    v_noi_dung_tb := format('Yêu cầu đổi phòng #%s của bạn đã được chấp thuận. Phòng mới: %s (chuyển từ %s).',
        p_ma_yc, v_ten_moi, v_ten_cu);
    IF v_ghi_chu_clean IS NOT NULL THEN
        v_noi_dung_tb := v_noi_dung_tb || format(' Ghi chú thủ tục: %s', v_ghi_chu_clean);
    END IF;

    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    VALUES (
        v_yc.mssv,
        p_phong_moi,
        v_khu_moi,
        'DOI_PHONG',
        format('Yêu cầu đổi phòng đã được duyệt: chuyển sang phòng %s', v_ten_moi),
        v_noi_dung_tb
    );

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'ma_yc', p_ma_yc,
        'mssv', v_yc.mssv,
        'ten_phong_cu', v_ten_cu,
        'ten_phong_moi', v_ten_moi,
        'ghi_chu_duyet', v_ghi_chu_clean
    );
END;
$$;

-- 7. Nạp tiền vào số dư nội trú của sinh viên (ACID + khóa dòng)
CREATE OR REPLACE FUNCTION sp_nap_tien_vi(
    p_mssv    VARCHAR(8),
    p_so_tien NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_mssv       VARCHAR(8);
    v_cu         NUMERIC(12, 0);
    v_moi        NUMERIC(12, 0);
BEGIN
    IF p_so_tien IS NULL OR p_so_tien <= 0 THEN
        RAISE EXCEPTION 'Số tiền nạp phải lớn hơn 0.' USING ERRCODE = 'P0001';
    END IF;

    SELECT mssv, so_du INTO v_mssv, v_cu
    FROM sinh_vien
    WHERE mssv = upper(trim(p_mssv))
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy sinh viên có MSSV %.', p_mssv USING ERRCODE = 'P0001';
    END IF;

    v_moi := v_cu + p_so_tien;
    UPDATE sinh_vien SET so_du = v_moi WHERE mssv = v_mssv;

    INSERT INTO giao_dich_vi (mssv, loai, so_tien, so_du_truoc, so_du_sau, mo_ta)
    VALUES (v_mssv, 'NAP_TIEN', p_so_tien, v_cu, v_moi, 'Nạp tiền vào tài khoản nội trú KTX');

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'mssv', v_mssv,
        'so_du_truoc', v_cu,
        'so_du_sau', v_moi,
        'so_tien_nap', p_so_tien
    );
END;
$$;

-- 8. Thanh toán hóa đơn bằng số dư ví sinh viên (ACID Transaction: trừ ví SV + gạch nợ HĐ + cộng quỹ KTX)
CREATE OR REPLACE FUNCTION sp_thanh_toan_bang_vi(
    p_ma_hoa_don   INTEGER,
    p_mssv         VARCHAR(8),
    p_gia_lap_loi  BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_hd          RECORD;
    v_sv          RECORD;
    v_dai_dien    VARCHAR(8);
    v_ten_phong   VARCHAR(20);
    v_ma_khu      VARCHAR(10);
    v_so_du_sau   NUMERIC(12, 0);
    v_quy_cu      NUMERIC(12, 0);
    v_quy_moi     NUMERIC(12, 0);
    v_ma_gd       VARCHAR(64);
    v_ma_tt       INTEGER;
    v_loai_label  TEXT;
BEGIN
    -- Khóa hóa đơn và tài khoản sinh viên theo thứ tự cố định
    SELECT * INTO v_hd FROM hoa_don WHERE ma_hoa_don = p_ma_hoa_don FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hóa đơn mã #%.', p_ma_hoa_don USING ERRCODE = 'P0001';
    END IF;

    IF v_hd.trang_thai = 'DA_NOP' THEN
        RAISE EXCEPTION 'Hóa đơn #% đã được thanh toán trước đó.', p_ma_hoa_don USING ERRCODE = 'P0001';
    END IF;

    SELECT mssv_dai_dien INTO v_dai_dien
    FROM hop_dong
    WHERE ma_phong = v_hd.ma_phong AND ma_ky = v_hd.ma_ky AND trang_thai = 'HIEU_LUC'
    LIMIT 1;

    IF v_dai_dien IS NULL OR upper(trim(p_mssv)) <> v_dai_dien THEN
        RAISE EXCEPTION 'Chỉ sinh viên đại diện phòng mới được thanh toán hóa đơn.' USING ERRCODE = 'P0001';
    END IF;

    SELECT mssv, so_du INTO v_sv FROM sinh_vien WHERE mssv = v_dai_dien FOR UPDATE;
    IF v_sv.so_du < v_hd.so_tien THEN
        RAISE EXCEPTION 'Số dư ví (% đ) không đủ để thanh toán hóa đơn (% đ).',
            to_char(v_sv.so_du, 'FM999,999,999'), to_char(v_hd.so_tien, 'FM999,999,999')
            USING ERRCODE = 'P0001';
    END IF;

    -- Bước 1: Trừ tiền ví sinh viên
    v_so_du_sau := v_sv.so_du - v_hd.so_tien;
    UPDATE sinh_vien SET so_du = v_so_du_sau WHERE mssv = v_dai_dien;

    INSERT INTO giao_dich_vi (mssv, loai, so_tien, so_du_truoc, so_du_sau, ma_hoa_don, mo_ta)
    VALUES (
        v_dai_dien, 'THANH_TOAN', v_hd.so_tien, v_sv.so_du, v_so_du_sau, p_ma_hoa_don,
        format('Thanh toán hóa đơn #%s (%s)', p_ma_hoa_don, v_hd.loai)
    );

    -- Nếu kiểm thử kịch bản lỗi giữa chừng -> ROLLBACK toàn bộ Bước 1 (tiền ví SV không bị mất)
    IF p_gia_lap_loi THEN
        RAISE EXCEPTION 'Lỗi kết nối khi cập nhật quỹ KTX: PostgreSQL đã ROLLBACK bước trừ tiền ví sinh viên.'
            USING ERRCODE = 'P0001';
    END IF;

    -- Bước 2: Gạch nợ hóa đơn & ghi biên lai & cộng quỹ thu KTX
    SELECT COALESCE(NULLIF(gia_tri, ''), '0')::NUMERIC INTO v_quy_cu
    FROM cau_hinh WHERE khoa = 'quy_thu_ktx' FOR UPDATE;
    v_quy_moi := COALESCE(v_quy_cu, 0) + v_hd.so_tien;
    INSERT INTO cau_hinh (khoa, gia_tri, mo_ta)
    VALUES ('quy_thu_ktx', v_quy_moi::TEXT, 'Tổng quỹ thu KTX từ thanh toán trực tuyến')
    ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri;

    v_ma_gd := 'VI-CTU-' || p_ma_hoa_don || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
    INSERT INTO thanh_toan (ma_hoa_don, mssv_nguoi_nop, so_tien, ma_giao_dich)
    VALUES (p_ma_hoa_don, v_dai_dien, v_hd.so_tien, v_ma_gd)
    RETURNING ma_tt INTO v_ma_tt;

    UPDATE hoa_don SET trang_thai = 'DA_NOP' WHERE ma_hoa_don = p_ma_hoa_don;

    SELECT ten_phong, ma_khu INTO v_ten_phong, v_ma_khu FROM phong WHERE ma_phong = v_hd.ma_phong;
    v_loai_label := CASE WHEN v_hd.loai = 'KTX'
        THEN format('Tiền KTX kỳ %s', v_hd.ma_ky)
        ELSE format('Tiền điện nước tháng %s', v_hd.thang)
    END;

    INSERT INTO thong_bao (mssv, ma_phong, ma_khu, loai, tieu_de, noi_dung)
    SELECT lt.mssv, v_hd.ma_phong, v_ma_khu, 'HOA_DON',
        format('Đã thanh toán %s - Phòng %s', v_loai_label, v_ten_phong),
        format('Sinh viên %s đã thanh toán %s qua số dư ví (%s đ). Mã GD: %s.',
            v_dai_dien, v_loai_label, to_char(v_hd.so_tien, 'FM999,999,999'), v_ma_gd)
    FROM luu_tru lt
    WHERE lt.ma_phong = v_hd.ma_phong AND lt.ma_ky = v_hd.ma_ky AND lt.ngay_ra IS NULL;

    RETURN jsonb_build_object(
        'thanh_cong', TRUE,
        'ma_tt', v_ma_tt,
        'ma_hoa_don', p_ma_hoa_don,
        'ma_giao_dich', v_ma_gd,
        'so_du_truoc', v_sv.so_du,
        'so_du_sau', v_so_du_sau,
        'quy_ktx_moi', v_quy_moi
    );
END;
$$;

from typing import Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from app.db import fetch_all

CLUSTER_META = {
    "GUONG_MAU": {
        "label": "Gương mẫu / Ổn định",
        "description": "Đóng phí KTX đúng hạn và không ra vào khuya",
    },
    "NHAC_THANH_TOAN": {
        "label": "Đóng phí KTX trễ",
        "description": "Chưa đóng phí KTX từ 2 kỳ trở lên",
    },
    "LUU_Y_GIO_GIAC": {
        "label": "Giờ giấc ra vào",
        "description": "Lưu thông tin ra vào khung giờ khuya (23:00–05:00) & người lạ quét cổng",
    },
}


async def fetch_stranger_gate_scans(ma_khu: str | None = None) -> list[dict[str, Any]]:
    """Lấy danh sách các lượt quét vân tay bị từ chối / người lạ tại cổng KTX."""
    khu = ma_khu.strip().upper() if ma_khu and ma_khu.strip().upper() in ("A", "B") else None
    if khu:
        return await fetch_all(
            """
            SELECT ma_cb, ma_van_tay_quet, cong, loai_luot, mssv, ho_ten, ten_phong,
                   cho_phep_vao, ket_qua, ly_do, thoi_gian
            FROM canh_bao_cong_van_tay
            WHERE cho_phep_vao = FALSE
              AND (cong ILIKE %s OR ten_phong LIKE %s)
            ORDER BY ma_cb DESC
            """,
            (f"%Khu {khu}%", f"{khu}%"),
        )
    return await fetch_all(
        """
        SELECT ma_cb, ma_van_tay_quet, cong, loai_luot, mssv, ho_ten, ten_phong,
               cho_phep_vao, ket_qua, ly_do, thoi_gian
        FROM canh_bao_cong_van_tay
        WHERE cho_phep_vao = FALSE
        ORDER BY ma_cb DESC
        """
    )


async def cluster_dormitory_students(ma_khu: str | None = None) -> dict[str, Any]:
    """Phân nhóm sinh viên nội trú: trễ phí KTX (>= 2 kỳ) và giờ giấc ra vào (23:00–05:00) độc lập nhau."""
    khu_clause = ""
    params: list[Any] = []
    if ma_khu and ma_khu.strip().upper() in ("A", "B"):
        khu_clause = "WHERE p.ma_khu = %s"
        params.append(ma_khu.strip().upper())

    rows = await fetch_all(
        f"""
        SELECT sv.mssv,
               sv.ho_ten,
               sv.nganh,
               p.ten_phong,
               p.ma_khu,
               COALESCE(sv.so_ky_dong_tre, 0)::INT AS so_ky_dong_tre,
               COALESCE(rv.late_count, 0)::INT AS late_count
        FROM sinh_vien sv
        JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN (
            SELECT mssv, COUNT(*)::INT AS late_count
            FROM luot_ra_vao
            WHERE (thoi_gian::TIME > TIME '23:00:00' OR thoi_gian::TIME < TIME '05:00:00')
              AND thoi_gian >= DATE_TRUNC('year', CURRENT_DATE)
            GROUP BY mssv
        ) rv ON rv.mssv = sv.mssv
        {khu_clause}
        ORDER BY sv.mssv ASC
        """,
        params,
    )

    strangers = await fetch_stranger_gate_scans(ma_khu)

    if len(rows) < 3:
        return {
            "model": "KMeans (k=3)",
            "summary": [],
            "students": [],
            "nguoi_la_quet_cong": strangers,
            "so_luot_nguoi_la": len(strangers),
        }

    features = np.array(
        [
            [
                float(r["so_ky_dong_tre"]),
                1.0 if r["so_ky_dong_tre"] >= 2 else 0.0,
                float(r["late_count"]),
            ]
            for r in rows
        ],
        dtype=float,
    )
    scaled = StandardScaler().fit_transform(features)

    KMeans(n_clusters=3, random_state=42, n_init=10).fit(scaled)
    coords = PCA(n_components=2, random_state=42).fit_transform(scaled)

    students_out: list[dict[str, Any]] = []
    counts = {"GUONG_MAU": 0, "NHAC_THANH_TOAN": 0, "LUU_Y_GIO_GIAC": 0}
    for i, r in enumerate(rows):
        nhom_codes: list[str] = []
        if r["so_ky_dong_tre"] >= 2:
            nhom_codes.append("NHAC_THANH_TOAN")
        if r["late_count"] > 0:
            nhom_codes.append("LUU_Y_GIO_GIAC")
        if not nhom_codes:
            nhom_codes.append("GUONG_MAU")

        primary_code = nhom_codes[0]
        for c in nhom_codes:
            counts[c] += 1

        students_out.append(
            {
                "mssv": r["mssv"],
                "ho_ten": r["ho_ten"],
                "nganh": r["nganh"],
                "ten_phong": r["ten_phong"],
                "ma_khu": r["ma_khu"],
                "nhom_code": primary_code,
                "nhom_codes": nhom_codes,
                "nhom_label": CLUSTER_META[primary_code]["label"],
                "so_ky_dong_tre": r["so_ky_dong_tre"],
                "late_count": r["late_count"],
                "pca_x": round(float(coords[i, 0]), 3),
                "pca_y": round(float(coords[i, 1]), 3),
            }
        )

    summary = [
        {
            "code": code,
            "label": CLUSTER_META[code]["label"],
            "description": CLUSTER_META[code]["description"],
            "so_luong": counts[code],
        }
        for code in ("GUONG_MAU", "NHAC_THANH_TOAN", "LUU_Y_GIO_GIAC")
    ]

    return {
        "model": "K-Means (k=3) + StandardScaler + PCA",
        "tong_sinh_vien": len(students_out),
        "summary": summary,
        "students": students_out,
        "nguoi_la_quet_cong": strangers,
        "so_luot_nguoi_la": len(strangers),
    }

from typing import Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from app.db import fetch_all

CLUSTER_META = {
    "GUONG_MAU": {
        "label": "Gương mẫu / Ổn định",
        "description": "Đóng phí đầy đủ và chấp hành tốt giờ giới nghiêm",
    },
    "NHAC_THANH_TOAN": {
        "label": "Cần nhắc thanh toán",
        "description": "Phòng còn hóa đơn điện nước / KTX chưa hoàn tất",
    },
    "LUU_Y_GIO_GIAC": {
        "label": "Lưu ý giờ giấc & tiêu thụ",
        "description": "Số lượt ra vào sau 23:00 hoặc mức tiêu thụ điện cao hơn trung bình",
    },
}


async def cluster_dormitory_students() -> dict[str, Any]:
    """Phân nhóm sinh viên nội trú bằng K-Means + PCA dựa trên dữ liệu thực tế."""
    rows = await fetch_all(
        """
        SELECT sv.mssv,
               sv.ho_ten,
               sv.nganh,
               p.ten_phong,
               p.ma_khu,
               COALESCE(rv.late_count, 0)::INT AS late_count,
               COALESCE(hd_stat.unpaid_ratio, 0.0)::FLOAT AS unpaid_ratio,
               COALESCE(cs_stat.avg_kwh, 180.0)::FLOAT AS avg_kwh
        FROM sinh_vien sv
        JOIN luu_tru lt ON lt.mssv = sv.mssv AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        JOIN phong p ON p.ma_phong = lt.ma_phong
        LEFT JOIN (
            SELECT mssv, COUNT(*)::INT AS late_count
            FROM luot_ra_vao
            WHERE (thoi_gian::TIME > TIME '23:00:00' OR thoi_gian::TIME < TIME '05:00:00')
              AND thoi_gian >= NOW() - INTERVAL '30 days'
            GROUP BY mssv
        ) rv ON rv.mssv = sv.mssv
        LEFT JOIN (
            SELECT ma_phong,
                   (COUNT(*) FILTER (WHERE trang_thai = 'CHUA_NOP'))::FLOAT
                   / NULLIF(COUNT(*), 0)::FLOAT AS unpaid_ratio
            FROM hoa_don
            GROUP BY ma_phong
        ) hd_stat ON hd_stat.ma_phong = p.ma_phong
        LEFT JOIN (
            SELECT ma_phong, AVG(chi_so_dien_cuoi - chi_so_dien_dau)::FLOAT AS avg_kwh
            FROM chi_so
            GROUP BY ma_phong
        ) cs_stat ON cs_stat.ma_phong = p.ma_phong
        ORDER BY sv.mssv ASC
        """
    )

    if len(rows) < 3:
        return {"model": "KMeans (k=3)", "summary": [], "students": []}

    features = np.array(
        [[r["unpaid_ratio"], r["late_count"], r["avg_kwh"]] for r in rows],
        dtype=float,
    )
    scaled = StandardScaler().fit_transform(features)

    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    labels = kmeans.fit_predict(scaled)
    coords = PCA(n_components=2, random_state=42).fit_transform(scaled)

    # Gán nhãn ngữ nghĩa cho 3 cụm dựa trên tâm cụm
    cluster_stats = {}
    for cid in range(3):
        mask = labels == cid
        cluster_stats[cid] = {
            "avg_unpaid": float(np.mean(features[mask, 0])),
            "avg_late": float(np.mean(features[mask, 1])),
            "avg_kwh": float(np.mean(features[mask, 2])),
        }

    # Cụm có unpaid cao nhất -> NHAC_THANH_TOAN; còn lại cụm có late/kwh cao hơn -> LUU_Y_GIO_GIAC; cuối -> GUONG_MAU
    by_unpaid = sorted(cluster_stats.keys(), key=lambda c: cluster_stats[c]["avg_unpaid"], reverse=True)
    financial_cid = by_unpaid[0]
    remaining = [c for c in range(3) if c != financial_cid]
    remaining_sorted = sorted(
        remaining,
        key=lambda c: (cluster_stats[c]["avg_late"], cluster_stats[c]["avg_kwh"]),
        reverse=True,
    )
    security_cid = remaining_sorted[0]
    standard_cid = remaining_sorted[1]

    cid_to_code = {
        financial_cid: "NHAC_THANH_TOAN",
        security_cid: "LUU_Y_GIO_GIAC",
        standard_cid: "GUONG_MAU",
    }

    students_out: list[dict[str, Any]] = []
    counts = {"GUONG_MAU": 0, "NHAC_THANH_TOAN": 0, "LUU_Y_GIO_GIAC": 0}
    for i, r in enumerate(rows):
        code = cid_to_code[int(labels[i])]
        counts[code] += 1
        students_out.append(
            {
                "mssv": r["mssv"],
                "ho_ten": r["ho_ten"],
                "nganh": r["nganh"],
                "ten_phong": r["ten_phong"],
                "ma_khu": r["ma_khu"],
                "nhom_code": code,
                "nhom_label": CLUSTER_META[code]["label"],
                "unpaid_ratio": round(r["unpaid_ratio"], 2),
                "late_count": r["late_count"],
                "avg_kwh": round(r["avg_kwh"], 1),
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
    }

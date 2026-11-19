import asyncio
from typing import Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from app.ai.embeddings import ensure_ai_enabled
from app.db import fetch_all

CLUSTER_META = {
    "FINANCIAL_RISK": {
        "label_vi": "Nguy cơ tài chính",
        "description": "Sinh viên thường xuyên nợ hoặc chậm nộp tiền điện nước",
    },
    "SECURITY_RISK": {
        "label_vi": "Cảnh báo an ninh",
        "description": "Sinh viên có tần suất về muộn giờ giới nghiêm cao sau 23:00",
    },
    "STANDARD": {
        "label_vi": "Gương mẫu",
        "description": "Sinh viên chấp hành tốt giờ giấc và thanh toán tiền điện nước đầy đủ",
    },
}


def _label_clusters(
    X_mat: np.ndarray,
    raw_labels: np.ndarray,
) -> tuple[dict[int, str], list[dict[str, Any]]]:
    cluster_stats = {}
    for c_id in range(3):
        mask = raw_labels == c_id
        cluster_stats[c_id] = {
            "avg_late": float(np.mean(X_mat[mask, 0])) if np.any(mask) else 0.0,
            "avg_unpaid": float(np.mean(X_mat[mask, 1])) if np.any(mask) else 0.0,
            "avg_power": float(np.mean(X_mat[mask, 2])) if np.any(mask) else 0.0,
            "count": int(np.sum(mask)),
        }

    # Map semantic roles deterministically: highest unpaid -> FINANCIAL_RISK, then highest late -> SECURITY_RISK
    fin_cluster = max(cluster_stats, key=lambda c: cluster_stats[c]["avg_unpaid"])
    remaining = [c for c in range(3) if c != fin_cluster]
    sec_cluster = max(remaining, key=lambda c: cluster_stats[c]["avg_late"])
    std_cluster = next(c for c in remaining if c != sec_cluster)
    id_to_label = {
        fin_cluster: "FINANCIAL_RISK",
        sec_cluster: "SECURITY_RISK",
        std_cluster: "STANDARD",
    }

    clusters_out = []
    for c_id in (std_cluster, fin_cluster, sec_cluster):
        lbl = id_to_label[c_id]
        meta = CLUSTER_META[lbl]
        st = cluster_stats[c_id]
        clusters_out.append(
            {
                "cluster_id": c_id,
                "label": lbl,
                "label_vi": meta["label_vi"],
                "description": meta["description"],
                "student_count": st["count"],
                "avg_late_count": round(st["avg_late"], 1),
                "avg_unpaid_ratio": round(st["avg_unpaid"], 4),
                "avg_power_kwh": round(st["avg_power"], 1),
            }
        )
    return id_to_label, clusters_out


def _fit_kmeans_and_pca(student_records: list[dict[str, Any]]) -> dict[str, Any]:
    X_mat = np.array(
        [
            [float(r["late_count"]), r["unpaid_ratio"], r["avg_power_kwh"]]
            for r in student_records
        ],
        dtype=np.float64,
    )
    X_scaled = StandardScaler().fit_transform(X_mat)
    raw_labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X_scaled)
    coords_2d = PCA(n_components=2, random_state=42).fit_transform(X_scaled)
    id_to_label, clusters_out = _label_clusters(X_mat, raw_labels)

    points_out = [
        {
            **rec,
            "cluster_id": int(lbl_id),
            "cluster_label": id_to_label[int(lbl_id)],
            "pca_x": float(round(px, 4)),
            "pca_y": float(round(py, 4)),
        }
        for rec, lbl_id, (px, py) in zip(
            student_records, raw_labels, coords_2d, strict=True
        )
    ]
    return {
        "total_students": len(points_out),
        "clusters": clusters_out,
        "points": points_out,
    }


async def perform_student_clustering() -> dict[str, Any]:
    ensure_ai_enabled()
    rows = await fetch_all(
        """
        SELECT s.student_id,
               s.full_name,
               coalesce(r.room_number, 'Chưa xếp') AS room_number,
               coalesce(al.late_count, 0) AS late_count,
               coalesce(ud.unpaid_ratio, 0.0) AS unpaid_ratio,
               coalesce(pb.avg_power_kwh, 200.0) AS avg_power_kwh
        FROM students s
        LEFT JOIN room_assignments a ON a.student_id = s.student_id AND a.is_active = TRUE
        LEFT JOIN rooms r ON r.room_id = a.room_id
        LEFT JOIN (
            SELECT student_id, count(*) AS late_count
            FROM dorm_access_logs
            WHERE is_late = TRUE
            GROUP BY student_id
        ) al ON al.student_id = s.student_id
        LEFT JOIN (
            SELECT student_id,
                   round((sum(assigned_amount - paid_amount) / NULLIF(sum(assigned_amount), 0))::numeric, 4) AS unpaid_ratio
            FROM student_utility_debts
            GROUP BY student_id
        ) ud ON ud.student_id = s.student_id
        LEFT JOIN (
            SELECT room_id,
                   round(avg(curr_electric - prev_electric)::numeric, 1) AS avg_power_kwh
            FROM utility_bills
            GROUP BY room_id
        ) pb ON pb.room_id = r.room_id
        WHERE s.status = 'ACTIVE'
        ORDER BY s.student_id;
        """
    )
    if len(rows) < 3:
        return {"total_students": len(rows), "clusters": [], "points": []}

    records = [
        {
            "student_id": r["student_id"],
            "full_name": r["full_name"],
            "room_number": r["room_number"],
            "late_count": int(r["late_count"]),
            "unpaid_ratio": float(r["unpaid_ratio"]),
            "avg_power_kwh": float(r["avg_power_kwh"]),
        }
        for r in rows
    ]
    return await asyncio.to_thread(_fit_kmeans_and_pca, records)

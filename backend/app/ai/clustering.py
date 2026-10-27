from typing import Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

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


async def perform_student_clustering() -> dict[str, Any]:
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

    student_records = []
    X_raw = []
    for r in rows:
        late_c = int(r["late_count"])
        unpaid_r = float(r["unpaid_ratio"])
        avg_p = float(r["avg_power_kwh"])
        X_raw.append([float(late_c), unpaid_r, avg_p])
        student_records.append(
            {
                "student_id": r["student_id"],
                "full_name": r["full_name"],
                "room_number": r["room_number"],
                "late_count": late_c,
                "unpaid_ratio": unpaid_r,
                "avg_power_kwh": avg_p,
            }
        )

    X_mat = np.array(X_raw, dtype=np.float64)

    # 1. Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_mat)

    # 2. KMeans(3)
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    raw_labels = kmeans.fit_predict(X_scaled)

    # 3. PCA 2D for scatter visualization
    pca = PCA(n_components=2, random_state=42)
    coords_2d = pca.fit_transform(X_scaled)

    # 4. Map raw cluster IDs (0, 1, 2) to semantic labels
    cluster_stats = {}
    for c_id in range(3):
        mask = raw_labels == c_id
        if np.any(mask):
            c_late = float(np.mean(X_mat[mask, 0]))
            c_unpaid = float(np.mean(X_mat[mask, 1]))
            c_power = float(np.mean(X_mat[mask, 2]))
            c_count = int(np.sum(mask))
        else:
            c_late, c_unpaid, c_power, c_count = 0.0, 0.0, 0.0, 0

        cluster_stats[c_id] = {
            "c_id": c_id,
            "avg_late": c_late,
            "avg_unpaid": c_unpaid,
            "avg_power": c_power,
            "count": c_count,
        }

    # Highest unpaid ratio -> FINANCIAL_RISK
    sorted_by_unpaid = sorted(
        cluster_stats.keys(), key=lambda c: cluster_stats[c]["avg_unpaid"], reverse=True
    )
    fin_cluster = sorted_by_unpaid[0]
    remaining = [c for c in [0, 1, 2] if c != fin_cluster]

    # Of remaining, highest late count -> SECURITY_RISK
    sorted_by_late = sorted(
        remaining, key=lambda c: cluster_stats[c]["avg_late"], reverse=True
    )
    sec_cluster = sorted_by_late[0]
    std_cluster = sorted_by_late[1]

    id_to_label = {
        fin_cluster: "FINANCIAL_RISK",
        sec_cluster: "SECURITY_RISK",
        std_cluster: "STANDARD",
    }

    # Prepare clusters output list
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

    # Prepare points output list
    points_out = []
    for idx, (rec, lbl_id, (px, py)) in enumerate(
        zip(student_records, raw_labels, coords_2d, strict=True)
    ):
        lbl = id_to_label[lbl_id]
        points_out.append(
            {
                "student_id": rec["student_id"],
                "full_name": rec["full_name"],
                "room_number": rec["room_number"],
                "late_count": rec["late_count"],
                "unpaid_ratio": rec["unpaid_ratio"],
                "avg_power_kwh": rec["avg_power_kwh"],
                "cluster_id": int(lbl_id),
                "cluster_label": lbl,
                "pca_x": float(round(px, 4)),
                "pca_y": float(round(py, 4)),
            }
        )

    return {
        "total_students": len(points_out),
        "clusters": clusters_out,
        "points": points_out,
    }

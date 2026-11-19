from typing import Any

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

from app.db import fetch_all, fetch_one


def _next_months(last_month: str, count: int = 3) -> list[str]:
    year, month = map(int, last_month.split("-"))
    out: list[str] = []
    for _ in range(count):
        month += 1
        if month > 12:
            month = 1
            year += 1
        out.append(f"{year:04d}-{month:02d}")
    return out


async def forecast_utility_consumption(ma_khu: str | None = None) -> dict[str, Any]:
    """Dự báo tiêu thụ điện (kWh) và nước (m³) 3 tháng tới bằng RandomForestRegressor."""
    where_khu = "AND p.ma_khu = %s" if ma_khu else ""
    params = (ma_khu.upper(),) if ma_khu else ()

    dg_dien = await fetch_one("SELECT don_gia FROM don_gia WHERE loai = 'DIEN' ORDER BY ap_dung_tu DESC LIMIT 1")
    dg_nuoc = await fetch_one("SELECT don_gia FROM don_gia WHERE loai = 'NUOC' ORDER BY ap_dung_tu DESC LIMIT 1")
    gia_dien = int(dg_dien["don_gia"]) if dg_dien else 3500
    gia_nuoc = int(dg_nuoc["don_gia"]) if dg_nuoc else 15000

    # Dữ liệu cấp phòng theo tháng để huấn luyện RandomForestRegressor
    room_rows = await fetch_all(
        f"""
        SELECT cs.thang,
               p.ma_phong,
               p.suc_chua,
               CASE WHEN p.co_nau_an THEN 1 ELSE 0 END AS nau_an,
               CASE WHEN p.ma_khu = 'A' THEN 1 ELSE 2 END AS khu_num,
               (cs.chi_so_dien_cuoi - cs.chi_so_dien_dau)::FLOAT AS dien_kwh,
               (cs.chi_so_nuoc_cuoi - cs.chi_so_nuoc_dau)::FLOAT AS nuoc_m3
        FROM chi_so cs
        JOIN phong p ON p.ma_phong = cs.ma_phong
        WHERE 1=1 {where_khu}
        ORDER BY cs.thang ASC, p.ma_phong ASC
        """,
        params,
    )

    if len(room_rows) < 10:
        return {
            "ma_khu": ma_khu or "TAT_CA",
            "model": "RandomForestRegressor",
            "lich_su": [],
            "du_bao": [],
            "metrics": {"mae_dien": 0, "r2_dien": 0, "mae_nuoc": 0, "so_mau_huan_luyen": len(room_rows)},
        }

    months_sorted = sorted({r["thang"] for r in room_rows})
    month_to_idx = {m: idx + 1 for idx, m in enumerate(months_sorted)}

    X_train = np.array(
        [
            [
                month_to_idx[r["thang"]],
                int(r["thang"].split("-")[1]),
                r["suc_chua"],
                r["nau_an"],
                r["khu_num"],
            ]
            for r in room_rows
        ],
        dtype=float,
    )
    y_dien = np.array([r["dien_kwh"] for r in room_rows], dtype=float)
    y_nuoc = np.array([r["nuoc_m3"] for r in room_rows], dtype=float)

    rf_dien = RandomForestRegressor(n_estimators=120, max_depth=6, random_state=42)
    rf_nuoc = RandomForestRegressor(n_estimators=120, max_depth=6, random_state=42)
    rf_dien.fit(X_train, y_dien)
    rf_nuoc.fit(X_train, y_nuoc)

    pred_train_d = rf_dien.predict(X_train)
    pred_train_n = rf_nuoc.predict(X_train)

    # Tổng hợp lịch sử theo tháng
    history_map: dict[str, dict[str, float]] = {}
    for r in room_rows:
        m = r["thang"]
        item = history_map.setdefault(m, {"dien_kwh": 0.0, "nuoc_m3": 0.0, "so_phong": 0})
        item["dien_kwh"] += r["dien_kwh"]
        item["nuoc_m3"] += r["nuoc_m3"]
        item["so_phong"] += 1

    lich_su = [
        {
            "thang": m,
            "so_phong": int(v["so_phong"]),
            "dien_kwh": round(v["dien_kwh"], 1),
            "nuoc_m3": round(v["nuoc_m3"], 1),
            "uoc_tinh_tien": int(v["dien_kwh"] * gia_dien + v["nuoc_m3"] * gia_nuoc),
        }
        for m, v in sorted(history_map.items())
    ]

    # Dự báo cho tập phòng hoạt động hiện hành trong 3 tháng tới
    active_rooms = await fetch_all(
        f"""
        SELECT DISTINCT p.ma_phong, p.suc_chua,
               CASE WHEN p.co_nau_an THEN 1 ELSE 0 END AS nau_an,
               CASE WHEN p.ma_khu = 'A' THEN 1 ELSE 2 END AS khu_num
        FROM phong p
        JOIN luu_tru lt ON lt.ma_phong = p.ma_phong AND lt.ma_ky = fn_ky_hoc_hien_hanh() AND lt.ngay_ra IS NULL
        WHERE 1=1 {where_khu}
        """,
        params,
    )

    last_month = months_sorted[-1]
    future_months = _next_months(last_month, 3)
    du_bao: list[dict[str, Any]] = []
    base_idx = len(months_sorted)

    for offset, fm in enumerate(future_months, start=1):
        m_num = int(fm.split("-")[1])
        X_fut = np.array(
            [[base_idx + offset, m_num, r["suc_chua"], r["nau_an"], r["khu_num"]] for r in active_rooms],
            dtype=float,
        )
        sum_dien = float(np.sum(rf_dien.predict(X_fut)))
        sum_nuoc = float(np.sum(rf_nuoc.predict(X_fut)))
        du_bao.append(
            {
                "thang": fm,
                "so_phong": len(active_rooms),
                "dien_kwh_du_bao": round(sum_dien, 1),
                "nuoc_m3_du_bao": round(sum_nuoc, 1),
                "uoc_tinh_tien": int(sum_dien * gia_dien + sum_nuoc * gia_nuoc),
            }
        )

    return {
        "ma_khu": ma_khu or "TAT_CA",
        "model": "RandomForestRegressor (scikit-learn)",
        "lich_su": lich_su,
        "du_bao": du_bao,
        "metrics": {
            "mae_dien": round(float(mean_absolute_error(y_dien, pred_train_d)), 2),
            "r2_dien": round(float(r2_score(y_dien, pred_train_d)), 4),
            "mae_nuoc": round(float(mean_absolute_error(y_nuoc, pred_train_n)), 2),
            "so_mau_huan_luyen": len(room_rows),
        },
    }

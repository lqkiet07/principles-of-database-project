import math
from typing import Any

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

from app.db import fetch_all, fetch_one
from app.errors import ApiError


def _next_months(last_month_str: str, count: int = 3) -> list[str]:
    parts = last_month_str.split("-")
    year = int(parts[0])
    month = int(parts[1])
    result = []
    for _ in range(count):
        month += 1
        if month > 12:
            month = 1
            year += 1
        result.append(f"{year:04d}-{month:02d}")
    return result


async def predict_building_consumption(building_id: str) -> dict[str, Any]:
    b_row = await fetch_one(
        "SELECT building_id, building_name FROM dorm_buildings WHERE building_id = %s;",
        (building_id,),
    )
    if not b_row:
        raise ApiError(
            404, "BUILDING_NOT_FOUND", f"Tòa nhà mã '{building_id}' không tồn tại."
        )

    rows = await fetch_all(
        """
        SELECT b.month_year,
               coalesce(sum(b.curr_electric - b.prev_electric), 0.0) AS total_kwh,
               coalesce(sum(b.total_amount), 0.0) AS total_bill
        FROM utility_bills b
        JOIN rooms r ON r.room_id = b.room_id
        WHERE r.building_id = %s
        GROUP BY b.month_year
        ORDER BY b.month_year ASC;
        """,
        (building_id,),
    )
    if not rows:
        raise ApiError(
            422,
            "NO_HISTORICAL_DATA",
            f"Tòa nhà {building_id} chưa có dữ liệu hóa đơn để dự báo.",
        )

    history = [
        {
            "month_year": r["month_year"],
            "actual_kwh": float(r["total_kwh"]),
            "total_bill": float(r["total_bill"]),
        }
        for r in rows
    ]

    # Feature matrix X: [t, sin_month, cos_month]
    X_list = []
    y_list = []
    for t_idx, item in enumerate(history, start=1):
        cal_m = int(item["month_year"].split("-")[1])
        sin_m = math.sin(2 * math.pi * cal_m / 12.0)
        cos_m = math.cos(2 * math.pi * cal_m / 12.0)
        X_list.append([float(t_idx), sin_m, cos_m])
        y_list.append(item["actual_kwh"])

    X = np.array(X_list, dtype=np.float64)
    y = np.array(y_list, dtype=np.float64)

    # Validation on holdout last 3 months
    if len(y) >= 6:
        X_train, y_train = X[:-3], y[:-3]
        X_val, y_val = X[-3:], y[-3:]
        eval_model = RandomForestRegressor(n_estimators=100, random_state=42)
        eval_model.fit(X_train, y_train)
        y_pred_val = eval_model.predict(X_val)
        mae = float(round(mean_absolute_error(y_val, y_pred_val), 2))
    else:
        mae = 0.0

    # Fit final model on all data
    final_model = RandomForestRegressor(n_estimators=100, random_state=42)
    final_model.fit(X, y)

    # Generate predictions for next 3 months
    last_m = history[-1]["month_year"]
    future_months = _next_months(last_m, count=3)
    future_X_list = []
    for offset, m_str in enumerate(future_months, start=1):
        future_t = float(len(history) + offset)
        cal_m = int(m_str.split("-")[1])
        sin_m = math.sin(2 * math.pi * cal_m / 12.0)
        cos_m = math.cos(2 * math.pi * cal_m / 12.0)
        future_X_list.append([future_t, sin_m, cos_m])

    future_preds = final_model.predict(np.array(future_X_list, dtype=np.float64))

    predictions = [
        {
            "month_year": m_str,
            "predicted_kwh": float(round(pred, 1)),
        }
        for m_str, pred in zip(future_months, future_preds, strict=True)
    ]

    return {
        "building_id": b_row["building_id"],
        "building_name": b_row["building_name"],
        "model_name": "RandomForestRegressor",
        "mae": mae,
        "history": history,
        "predictions": predictions,
    }

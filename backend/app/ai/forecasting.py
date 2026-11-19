import asyncio
import math
from typing import Any

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

from app.ai.embeddings import ensure_ai_enabled
from app.db import fetch_all, fetch_one
from app.errors import ApiError


def _next_months(last_month_str: str, count: int = 3) -> list[str]:
    year, month = (int(p) for p in last_month_str.split("-"))
    result = []
    for _ in range(count):
        month += 1
        if month > 12:
            month = 1
            year += 1
        result.append(f"{year:04d}-{month:02d}")
    return result


def _seasonal_features(t_idx: int, month_str: str) -> list[float]:
    cal_m = int(month_str.split("-")[1])
    angle = 2 * math.pi * cal_m / 12.0
    return [float(t_idx), math.sin(angle), math.cos(angle)]


def _fit_and_predict_rf(
    history: list[dict[str, Any]],
) -> tuple[float, list[dict[str, Any]]]:
    X = np.array(
        [_seasonal_features(i, h["month_year"]) for i, h in enumerate(history, start=1)],
        dtype=np.float64,
    )
    y = np.array([h["actual_kwh"] for h in history], dtype=np.float64)

    mae = 0.0
    if len(y) >= 6:
        eval_model = RandomForestRegressor(n_estimators=100, random_state=42)
        eval_model.fit(X[:-3], y[:-3])
        mae = float(round(mean_absolute_error(y[-3:], eval_model.predict(X[-3:])), 2))

    final_model = RandomForestRegressor(n_estimators=100, random_state=42)
    final_model.fit(X, y)

    future_months = _next_months(history[-1]["month_year"], count=3)
    future_X = np.array(
        [
            _seasonal_features(len(history) + offset, m_str)
            for offset, m_str in enumerate(future_months, start=1)
        ],
        dtype=np.float64,
    )
    preds = final_model.predict(future_X)
    predictions = [
        {"month_year": m_str, "predicted_kwh": float(round(pred, 1))}
        for m_str, pred in zip(future_months, preds, strict=True)
    ]
    return mae, predictions


async def predict_building_consumption(building_id: str) -> dict[str, Any]:
    ensure_ai_enabled()
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
    mae, predictions = await asyncio.to_thread(_fit_and_predict_rf, history)

    return {
        "building_id": b_row["building_id"],
        "building_name": b_row["building_name"],
        "model_name": "RandomForestRegressor",
        "mae": mae,
        "history": history,
        "predictions": predictions,
    }

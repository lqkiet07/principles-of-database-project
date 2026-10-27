import pytest


@pytest.mark.asyncio
async def test_forecast_building_success(client):
    response = await client.get("/api/ai/forecast?building_id=B1")
    assert response.status_code == 200
    data = response.json()["data"]

    assert data["building_id"] == "B1"
    assert "Tòa B1" in data["building_name"]
    assert data["model_name"] == "RandomForestRegressor"
    assert data["mae"] >= 0.0

    history = data["history"]
    assert len(history) >= 24
    first = history[0]
    assert first["month_year"] == "2024-10"
    assert first["actual_kwh"] > 0

    predictions = data["predictions"]
    assert len(predictions) == 3
    assert predictions[0]["predicted_kwh"] > 0
    assert predictions[1]["predicted_kwh"] > 0
    assert predictions[2]["predicted_kwh"] > 0
    # Predictions follow immediately after last historical month
    last_hist_m = history[-1]["month_year"]
    assert predictions[0]["month_year"] > last_hist_m


@pytest.mark.asyncio
async def test_forecast_unknown_building_404(client):
    response = await client.get("/api/ai/forecast?building_id=UNKNOWN")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "BUILDING_NOT_FOUND"

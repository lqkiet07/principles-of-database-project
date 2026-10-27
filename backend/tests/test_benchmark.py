import pytest


@pytest.mark.asyncio
async def test_get_admin_access_logs_search(client):
    headers = {"X-Role": "admin"}
    response = await client.get(
        "/api/admin/access-logs?late=true&limit=20", headers=headers
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "total" in data
    assert "late_count" in data
    assert "items" in data
    assert len(data["items"]) <= 20
    if len(data["items"]) > 0:
        item = data["items"][0]
        assert item["is_late"] is True
        assert "student_id" in item
        assert "gate_name" in item


@pytest.mark.asyncio
async def test_benchmark_sequential_scan_plan(client):
    headers = {"X-Role": "admin"}
    response = await client.get("/api/admin/benchmark?mode=seq", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["mode"] == "seq"
    plan_str = str(data["plan"]).lower()
    assert "seq scan" in plan_str
    assert data["total_buffers"] >= 9000


@pytest.mark.asyncio
async def test_benchmark_index_scan_plan_and_fewer_buffers(client):
    headers = {"X-Role": "admin"}
    response = await client.get("/api/admin/benchmark?mode=index", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["mode"] == "index"
    plan_str = str(data["plan"]).lower()
    assert "index scan" in plan_str or "bitmap" in plan_str
    # Index scan uses far fewer buffers (3839 vs > 9300 in seq scan)
    assert data["total_buffers"] < 5000
    assert data["total_buffers"] < 9000


@pytest.mark.asyncio
async def test_benchmark_invalid_mode_rejected(client):
    headers = {"X-Role": "admin"}
    response = await client.get(
        "/api/admin/benchmark?mode=invalid_mode", headers=headers
    )
    assert response.status_code == 422

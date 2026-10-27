import pytest
import pytest_asyncio

from app.db import execute, fetch_one


@pytest_asyncio.fixture(autouse=True)
async def cleanup_test_bills():
    await execute("DELETE FROM utility_bills WHERE month_year = '2026-11';")
    await execute("DELETE FROM rooms WHERE room_number = 'TEST-EMPTY-ROOM';")
    yield
    await execute("DELETE FROM utility_bills WHERE month_year = '2026-11';")
    await execute("DELETE FROM rooms WHERE room_number = 'TEST-EMPTY-ROOM';")


@pytest.mark.asyncio
async def test_generate_bill_success_room1(client):
    headers = {"X-Role": "admin"}
    payload = {
        "room_id": 1,
        "month_year": "2026-11",
        "prev_electric": 100,
        "curr_electric": 350,
        "prev_water": 20,
        "curr_water": 35,
    }
    response = await client.post("/api/admin/bills", json=payload, headers=headers)
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["total_amount"] == 750000.0
    assert data["split_amount"] == 375000.0
    assert data["student_count"] == 2
    assert len(data["debts"]) == 2
    total_debts = sum(d["assigned_amount"] for d in data["debts"])
    assert total_debts == data["total_amount"]


@pytest.mark.asyncio
async def test_generate_bill_duplicate_returns_409(client):
    headers = {"X-Role": "admin"}
    payload = {
        "room_id": 1,
        "month_year": "2026-11",
        "prev_electric": 100,
        "curr_electric": 350,
        "prev_water": 20,
        "curr_water": 35,
    }
    res1 = await client.post("/api/admin/bills", json=payload, headers=headers)
    assert res1.status_code == 201

    res2 = await client.post("/api/admin/bills", json=payload, headers=headers)
    assert res2.status_code == 409
    body = res2.json()
    assert body["success"] is False
    assert body["error_code"] == "BILL_EXISTS"
    assert body["status_code"] == 2


@pytest.mark.asyncio
async def test_generate_bill_invalid_meters_422(client):
    headers = {"X-Role": "admin"}
    payload = {
        "room_id": 1,
        "month_year": "2026-11",
        "prev_electric": 350,
        "curr_electric": 100,  # lower than prev
        "prev_water": 20,
        "curr_water": 35,
    }
    response = await client.post("/api/admin/bills", json=payload, headers=headers)
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "INVALID_METERS"
    assert body["status_code"] == 3


@pytest.mark.asyncio
async def test_generate_bill_empty_room_422(client):
    # Create empty room without active students
    await execute(
        """
        INSERT INTO rooms (building_id, room_number, capacity, current_occupancy, base_price, status)
        VALUES ('B1', 'TEST-EMPTY-ROOM', 4, 0, 1000000.00, 'AVAILABLE')
        ON CONFLICT (room_number) DO NOTHING;
        """
    )
    room = await fetch_one(
        "SELECT room_id FROM rooms WHERE room_number = 'TEST-EMPTY-ROOM';"
    )
    assert room is not None
    room_id = room["room_id"]

    headers = {"X-Role": "admin"}
    payload = {
        "room_id": room_id,
        "month_year": "2026-11",
        "prev_electric": 0,
        "curr_electric": 100,
        "prev_water": 0,
        "curr_water": 10,
    }
    response = await client.post("/api/admin/bills", json=payload, headers=headers)
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "NO_STUDENTS"
    assert body["status_code"] == 1


@pytest.mark.asyncio
async def test_generate_bill_forbidden_without_admin_role(client):
    payload = {
        "room_id": 1,
        "month_year": "2026-11",
        "prev_electric": 100,
        "curr_electric": 350,
        "prev_water": 20,
        "curr_water": 35,
    }
    response = await client.post(
        "/api/admin/bills", json=payload, headers={"X-Role": "student"}
    )
    assert response.status_code == 403
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "FORBIDDEN"

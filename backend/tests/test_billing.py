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
async def test_generate_bill_three_students_exact_rounding_remainder(client):
    headers = {"X-Role": "admin"}
    # Assign a 3rd student to room 1 to test 3-way odd division
    await execute(
        """
        INSERT INTO students (student_id, full_name, email, status)
        VALUES ('TEST_S99', 'Sinh Vien Ba', 'ba.test@ctu.edu.vn', 'ACTIVE')
        ON CONFLICT (student_id) DO NOTHING;
        INSERT INTO room_assignments (room_id, student_id, bed_number, start_date, is_active)
        VALUES (1, 'TEST_S99', 3, '2026-10-01', TRUE)
        ON CONFLICT DO NOTHING;
        UPDATE rooms SET current_occupancy = 3 WHERE room_id = 1;
        """
    )
    try:
        # 100 kWh -> 200,000 VND / 3 = 66,666.67 each, remainder 0.01 adjusted on 3rd student
        payload = {
            "room_id": 1,
            "month_year": "2026-11",
            "prev_electric": 0,
            "curr_electric": 100,
            "prev_water": 0,
            "curr_water": 0,
        }
        res = await client.post("/api/admin/bills", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["total_amount"] == 200000.0
        assert data["student_count"] == 3
        debts = data["debts"]
        assert len(debts) == 3
        total_assigned = sum(d["assigned_amount"] for d in debts)
        assert total_assigned == 200000.0
        # Check individual split rounding
        assert debts[0]["assigned_amount"] == 66666.67
        assert debts[1]["assigned_amount"] == 66666.67
        assert debts[2]["assigned_amount"] == 66666.66
    finally:
        await execute("DELETE FROM room_assignments WHERE student_id = 'TEST_S99';")
        await execute("DELETE FROM students WHERE student_id = 'TEST_S99';")
        await execute("UPDATE rooms SET current_occupancy = 2 WHERE room_id = 1;")


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

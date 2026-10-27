import pytest
import pytest_asyncio

from app.db import execute, fetch_one


@pytest_asyncio.fixture(autouse=True)
async def cleanup_assignments():
    yield
    # Clean up any assignments created with bed_number >= 3 or student B2100012 in room 1
    await execute("DELETE FROM room_assignments WHERE bed_number >= 3;")
    await execute(
        "UPDATE rooms SET current_occupancy = 2, status = 'AVAILABLE' WHERE room_id IN (1, 2, 3, 4, 5, 6);"
    )


@pytest.mark.asyncio
async def test_get_admin_rooms(client):
    headers = {"X-Role": "admin"}
    response = await client.get("/api/admin/rooms", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert isinstance(data, list)
    assert len(data) >= 6
    room = data[0]
    assert "room_number" in room
    assert "capacity" in room
    assert "current_occupancy" in room
    assert "base_price" in room


@pytest.mark.asyncio
async def test_assign_and_unassign_student_with_occupancy_sync(client):
    headers = {"X-Role": "admin"}
    # Room 1 currently has 2 students (occupancy = 2, capacity = 4).
    # Create temp student or use unassigned student. Let's create temp student for clean test
    await execute(
        """
        INSERT INTO students (student_id, full_name, email, status)
        VALUES ('TEST_S01', 'Sinh Viên Test', 'test.s01@ctu.edu.vn', 'ACTIVE')
        ON CONFLICT (student_id) DO NOTHING;
        INSERT INTO student_wallets (student_id, balance) VALUES ('TEST_S01', 100000.00)
        ON CONFLICT (student_id) DO NOTHING;
        """
    )

    # 1. Assign student to Bed 3
    payload = {
        "room_id": 1,
        "student_id": "TEST_S01",
        "bed_number": 3,
        "start_date": "2026-10-01",
    }
    res_assign = await client.post(
        "/api/admin/assignments", json=payload, headers=headers
    )
    assert res_assign.status_code == 201
    assign_id = res_assign.json()["data"]["assignment_id"]

    # Verify room occupancy incremented to 3
    room_after = await fetch_one(
        "SELECT current_occupancy, status FROM rooms WHERE room_id = 1;"
    )
    assert room_after["current_occupancy"] == 3

    # 2. Duplicate bed assignment attempt -> 409
    res_dup_bed = await client.post(
        "/api/admin/assignments", json=payload, headers=headers
    )
    assert res_dup_bed.status_code == 409
    assert res_dup_bed.json()["error_code"] in [
        "BED_ALREADY_OCCUPIED",
        "STUDENT_ALREADY_ASSIGNED",
    ]

    # 3. Unassign / Checkout student
    res_unassign = await client.delete(
        f"/api/admin/assignments/{assign_id}", headers=headers
    )
    assert res_unassign.status_code == 200

    # Verify room occupancy decremented back to 2
    room_final = await fetch_one(
        "SELECT current_occupancy, status FROM rooms WHERE room_id = 1;"
    )
    assert room_final["current_occupancy"] == 2

    # Clean up test student
    await execute("DELETE FROM students WHERE student_id = 'TEST_S01';")


@pytest.mark.asyncio
async def test_assign_room_over_capacity_rejected(client):
    headers = {"X-Role": "admin"}
    # Temporarily set room 1 occupancy to capacity 4
    await execute(
        "UPDATE rooms SET current_occupancy = 4, status = 'FULL' WHERE room_id = 1;"
    )

    payload = {
        "room_id": 1,
        "student_id": "B2100001",
        "bed_number": 3,
        "start_date": "2026-10-01",
    }
    response = await client.post(
        "/api/admin/assignments", json=payload, headers=headers
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error_code"] == "ROOM_OVER_CAPACITY"


@pytest.mark.asyncio
async def test_get_admin_dashboard(client):
    headers = {"X-Role": "admin"}
    response = await client.get("/api/admin/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total_buildings"] == 3
    assert data["total_rooms"] == 6
    assert data["total_capacity"] == 24
    assert data["total_occupancy"] >= 12
    assert "occupancy_rate" in data
    assert "total_students" in data
    assert "total_unpaid_debt" in data
    assert "total_power_kwh" in data

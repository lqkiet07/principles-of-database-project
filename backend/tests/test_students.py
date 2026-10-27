import pytest


@pytest.mark.asyncio
async def test_get_student_profile(client):
    response = await client.get("/api/students/B2100001")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["student_id"] == "B2100001"
    assert data["full_name"] == "Nguyễn Văn An"
    assert data["wallet"]["balance"] is not None


@pytest.mark.asyncio
async def test_get_student_profile_not_found(client):
    response = await client.get("/api/students/UNKNOWN_ID")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "STUDENT_NOT_FOUND"


@pytest.mark.asyncio
async def test_get_student_room_and_roommates(client):
    response = await client.get("/api/students/B2100001/room")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["room_number"] == "B1-101"
    assert data["building_id"] == "B1"
    assert "Tòa B1" in data["building_name"]
    assert data["bed_number"] == 1

    roommates = data["roommates"]
    assert len(roommates) == 1
    assert roommates[0]["student_id"] == "B2100002"
    assert roommates[0]["full_name"] == "Trần Hoàng Bình"
    assert roommates[0]["bed_number"] == 2


@pytest.mark.asyncio
async def test_get_student_debts(client):
    response = await client.get("/api/students/B2100001/debts")
    assert response.status_code == 200
    data = response.json()["data"]
    assert isinstance(data, list)
    if len(data) > 0:
        first = data[0]
        assert "debt_id" in first
        assert "month_year" in first
        assert "assigned_amount" in first
        assert "paid_amount" in first
        assert "debt_status" in first


@pytest.mark.asyncio
async def test_get_student_transactions(client):
    response = await client.get("/api/students/B2100001/transactions")
    assert response.status_code == 200
    data = response.json()["data"]
    assert isinstance(data, list)
    if len(data) > 0:
        tx = data[0]
        assert "reference_code" in tx
        assert "amount" in tx
        assert "status" in tx


@pytest.mark.asyncio
async def test_get_student_access_logs(client):
    response = await client.get("/api/students/B2100001/access-logs?limit=10")
    assert response.status_code == 200
    data = response.json()["data"]
    assert "total" in data
    assert "late_count" in data
    assert "items" in data
    assert isinstance(data["items"], list)

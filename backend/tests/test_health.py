import pytest


@pytest.mark.asyncio
async def test_health_returns_db_version_and_procedures(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "PostgreSQL" in data["db_version"]
    assert "sp_generate_and_split_utility_bill" in data["procedures"]
    assert "sp_pay_student_utility_bill" in data["procedures"]

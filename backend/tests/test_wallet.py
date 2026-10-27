import pytest


@pytest.mark.asyncio
async def test_topup_wallet_success(client):
    # Check current balance first
    res_before = await client.get("/api/students/B2100001")
    assert res_before.status_code == 200
    bal_before = res_before.json()["data"]["wallet"]["balance"]

    response = await client.post(
        "/api/students/B2100001/wallet/topup",
        json={"amount": 500000.0},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["student_id"] == "B2100001"
    assert data["amount_added"] == 500000.0
    assert data["new_balance"] == bal_before + 500000.0


@pytest.mark.parametrize("invalid_amount", [0, -100000, 15000000])
@pytest.mark.asyncio
async def test_topup_wallet_invalid_amount(client, invalid_amount):
    response = await client.post(
        "/api/students/B2100001/wallet/topup",
        json={"amount": invalid_amount},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_topup_wallet_unknown_student_404(client):
    response = await client.post(
        "/api/students/UNKNOWN_ID/wallet/topup",
        json={"amount": 500000.0},
    )
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "STUDENT_NOT_FOUND"

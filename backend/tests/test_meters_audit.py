import pytest
import pytest_asyncio

from app.db import execute, fetch_one


@pytest_asyncio.fixture(autouse=True)
async def cleanup_bills():
    await execute("DELETE FROM utility_bills WHERE month_year = '2026-11';")
    yield
    await execute("DELETE FROM utility_bills WHERE month_year = '2026-11';")


async def setup_test_bill(room_id: int = 2) -> int:
    await execute(
        """
        CALL sp_generate_and_split_utility_bill(
            %s, '2026-11', 100, 350, 20, 35,
            NULL, NULL, NULL, NULL, NULL
        );
        """,
        (room_id,),
    )
    row = await fetch_one(
        "SELECT bill_id FROM utility_bills WHERE room_id = %s AND month_year = '2026-11';",
        (room_id,),
    )
    return row["bill_id"]


@pytest.mark.asyncio
async def test_patch_meters_success_and_writes_audit(client):
    headers = {"X-Role": "admin"}
    bill_id = await setup_test_bill(room_id=2)

    # 1. Update meters legitimately
    payload = {"curr_electric": 360, "curr_water": 38}
    res = await client.patch(
        f"/api/admin/bills/{bill_id}/meters", json=payload, headers=headers
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["curr_electric"] == 360
    assert data["curr_water"] == 38

    # 2. Verify audit log entry created with JSONB old and new state
    res_audit = await client.get(
        f"/api/admin/audit-logs?record_id={bill_id}", headers=headers
    )
    assert res_audit.status_code == 200
    audit_data = res_audit.json()["data"]
    assert len(audit_data) >= 1
    latest = audit_data[0]
    assert latest["record_id"] == str(bill_id)
    assert latest["action_type"] == "UPDATE"
    assert latest["old_data"]["curr_electric"] == 350
    assert latest["new_data"]["curr_electric"] == 360


@pytest.mark.asyncio
async def test_patch_meters_fraud_reversal_rejected(client):
    headers = {"X-Role": "admin"}
    bill_id = await setup_test_bill(room_id=2)

    # Attempt to set curr_electric (50) < prev_electric (100) -> Trigger throws
    payload = {"curr_electric": 50, "curr_water": 35}
    res = await client.patch(
        f"/api/admin/bills/{bill_id}/meters", json=payload, headers=headers
    )
    assert res.status_code == 422
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == "FRAUD_METER_REVERSAL"
    assert (
        "chỉ số điện mới" in body["message"].lower()
        or "nhỏ hơn" in body["message"].lower()
    )


@pytest.mark.asyncio
async def test_patch_meters_paid_bill_tamper_rejected(client):
    headers = {"X-Role": "admin"}
    bill_id = await setup_test_bill(room_id=2)
    await execute(
        "UPDATE utility_bills SET bill_status = 'PAID' WHERE bill_id = %s;",
        (bill_id,),
    )

    # Keep both readings above their previous values so only the PAID-bill rule fires.
    payload = {"curr_electric": 360, "curr_water": 38}
    res = await client.patch(
        f"/api/admin/bills/{bill_id}/meters", json=payload, headers=headers
    )
    assert res.status_code == 422
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == "FRAUD_PAID_BILL_TAMPER"
    assert "tất toán" in body["message"].lower() or "paid" in body["message"].lower()

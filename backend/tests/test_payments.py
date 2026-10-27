import asyncio

import pytest
import pytest_asyncio

from app.db import execute, fetch_one


@pytest_asyncio.fixture(autouse=True)
async def cleanup_bills():
    await execute("DELETE FROM utility_bills WHERE month_year = '2026-11';")
    await execute(
        """
        UPDATE student_wallets SET balance = 1500000.00 
        WHERE student_id IN ('B2100005', 'B2100006', 'B2100007', 'B2100008', 'B2100009', 'B2100010');
        UPDATE student_wallets SET balance = 500000.00 WHERE student_id = 'B2100004';
        """
    )
    yield
    await execute("DELETE FROM utility_bills WHERE month_year = '2026-11';")


async def setup_test_bill(room_id: int = 3, month: str = "2026-11") -> int:
    await execute(
        """
        CALL sp_generate_and_split_utility_bill(
            %s, %s, 100, 350, 20, 35,
            NULL, NULL, NULL, NULL, NULL
        );
        """,
        (room_id, month),
    )
    row = await fetch_one(
        "SELECT bill_id FROM utility_bills WHERE room_id = %s AND month_year = %s;",
        (room_id, month),
    )
    return row["bill_id"]


@pytest.mark.asyncio
async def test_pay_debt_full_success_and_bill_sync(client):
    bill_id = await setup_test_bill(room_id=3)
    debt1 = await fetch_one(
        "SELECT debt_id FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100005';",
        (bill_id,),
    )
    debt2 = await fetch_one(
        "SELECT debt_id FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100006';",
        (bill_id,),
    )

    # 1. Student 1 pays
    res1 = await client.post(
        "/api/payments",
        json={
            "student_id": "B2100005",
            "debt_id": debt1["debt_id"],
            "amount": 375000.0,
        },
    )
    assert res1.status_code == 200
    data1 = res1.json()["data"]
    assert data1["remaining_debt"] == 0.0
    assert data1["tx_code"].startswith("TX-")

    bill_mid = await fetch_one(
        "SELECT bill_status FROM utility_bills WHERE bill_id = %s;", (bill_id,)
    )
    assert bill_mid["bill_status"] == "PARTIALLY_PAID"

    # 2. Student 2 pays
    res2 = await client.post(
        "/api/payments",
        json={
            "student_id": "B2100006",
            "debt_id": debt2["debt_id"],
            "amount": 375000.0,
        },
    )
    assert res2.status_code == 200
    data2 = res2.json()["data"]
    assert data2["remaining_debt"] == 0.0

    bill_final = await fetch_one(
        "SELECT bill_status FROM utility_bills WHERE bill_id = %s;", (bill_id,)
    )
    assert bill_final["bill_status"] == "PAID"


@pytest.mark.asyncio
async def test_pay_debt_partial(client):
    bill_id = await setup_test_bill(room_id=4)
    debt = await fetch_one(
        "SELECT debt_id FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100007';",
        (bill_id,),
    )

    res = await client.post(
        "/api/payments",
        json={"student_id": "B2100007", "debt_id": debt["debt_id"], "amount": 100000.0},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["amount_paid"] == 100000.0
    assert data["remaining_debt"] == 275000.0

    debt_row = await fetch_one(
        "SELECT paid_amount, debt_status FROM student_utility_debts WHERE debt_id = %s;",
        (debt["debt_id"],),
    )
    assert float(debt_row["paid_amount"]) == 100000.0
    assert debt_row["debt_status"] == "UNPAID"


@pytest.mark.asyncio
async def test_pay_debt_not_found(client):
    res = await client.post(
        "/api/payments",
        json={"student_id": "B2100001", "debt_id": 99999, "amount": 50000.0},
    )
    assert res.status_code == 404
    body = res.json()
    assert body["success"] is False
    assert body["error_code"] == "DEBT_NOT_FOUND"


@pytest.mark.asyncio
async def test_pay_debt_already_paid(client):
    bill_id = await setup_test_bill(room_id=3)
    debt = await fetch_one(
        "SELECT debt_id FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100005';",
        (bill_id,),
    )

    res1 = await client.post(
        "/api/payments",
        json={"student_id": "B2100005", "debt_id": debt["debt_id"], "amount": 375000.0},
    )
    assert res1.status_code == 200

    res2 = await client.post(
        "/api/payments",
        json={"student_id": "B2100005", "debt_id": debt["debt_id"], "amount": 375000.0},
    )
    assert res2.status_code == 409
    body = res2.json()
    assert body["error_code"] == "DEBT_ALREADY_PAID"


@pytest.mark.asyncio
async def test_pay_debt_amount_exceeds(client):
    bill_id = await setup_test_bill(room_id=3)
    debt = await fetch_one(
        "SELECT debt_id FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100005';",
        (bill_id,),
    )

    res = await client.post(
        "/api/payments",
        json={"student_id": "B2100005", "debt_id": debt["debt_id"], "amount": 500000.0},
    )
    assert res.status_code == 422
    body = res.json()
    assert body["error_code"] == "AMOUNT_EXCEEDS_DEBT"


@pytest.mark.asyncio
async def test_pay_debt_insufficient_funds(client):
    # Room 2 (B1-102: B2100003, B2100004). B2100004 balance is 500,000 VND
    await execute(
        """
        CALL sp_generate_and_split_utility_bill(
            2, '2026-11', 0, 500, 0, 80,
            NULL, NULL, NULL, NULL, NULL
        );
        """
    )
    bill = await fetch_one(
        "SELECT bill_id FROM utility_bills WHERE room_id = 2 AND month_year = '2026-11';"
    )
    debt = await fetch_one(
        "SELECT debt_id, assigned_amount FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100004';",
        (bill["bill_id"],),
    )

    bal_before = await fetch_one(
        "SELECT balance FROM student_wallets WHERE student_id = 'B2100004';"
    )

    res = await client.post(
        "/api/payments",
        json={
            "student_id": "B2100004",
            "debt_id": debt["debt_id"],
            "amount": float(debt["assigned_amount"]),
        },
    )
    assert res.status_code == 422
    body = res.json()
    assert body["error_code"] == "INSUFFICIENT_FUNDS"

    bal_after = await fetch_one(
        "SELECT balance FROM student_wallets WHERE student_id = 'B2100004';"
    )
    assert bal_after["balance"] == bal_before["balance"]


@pytest.mark.asyncio
async def test_pay_debt_concurrency(client):
    bill_id = await setup_test_bill(room_id=5)
    debt = await fetch_one(
        "SELECT debt_id, assigned_amount FROM student_utility_debts WHERE bill_id = %s AND student_id = 'B2100009';",
        (bill_id,),
    )

    payload = {
        "student_id": "B2100009",
        "debt_id": debt["debt_id"],
        "amount": float(debt["assigned_amount"]),
    }

    # Execute 2 concurrent payment requests simultaneously
    res1, res2 = await asyncio.gather(
        client.post("/api/payments", json=payload),
        client.post("/api/payments", json=payload),
    )

    statuses = sorted([res1.status_code, res2.status_code])
    assert statuses == [200, 409]

    if res1.status_code == 200:
        assert res2.json()["error_code"] == "DEBT_ALREADY_PAID"
    else:
        assert res1.json()["error_code"] == "DEBT_ALREADY_PAID"

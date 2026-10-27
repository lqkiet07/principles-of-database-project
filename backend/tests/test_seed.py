import pytest

from app.db import fetch_all, fetch_one
from scripts.seed_history import seed_billing_history_and_skew_logs


@pytest.mark.asyncio
async def test_seed_history_and_invariants():
    # Run the seed function
    await seed_billing_history_and_skew_logs()

    # 1. Verify 24 months per room
    b_counts = await fetch_all(
        """
        SELECT room_id, count(*) AS bill_count 
        FROM utility_bills 
        WHERE month_year >= '2024-10' AND month_year <= '2026-09'
        GROUP BY room_id;
        """
    )
    assert len(b_counts) == 6
    for b in b_counts:
        assert b["bill_count"] == 24

    # 2. Verify chained meters are monotonic
    chain_check = await fetch_all(
        """
        SELECT b1.room_id, b1.month_year AS m1, b1.curr_electric, b2.month_year AS m2, b2.prev_electric
        FROM utility_bills b1
        JOIN utility_bills b2 ON b1.room_id = b2.room_id 
          AND to_date(b1.month_year, 'YYYY-MM') + INTERVAL '1 month' = to_date(b2.month_year, 'YYYY-MM')
        WHERE b1.month_year >= '2024-10' AND b2.month_year <= '2026-09'
        LIMIT 50;
        """
    )
    assert len(chain_check) > 0
    for row in chain_check:
        assert row["curr_electric"] == row["prev_electric"]

    # 3. Verify debts and parent-child paid_amount consistency
    mismatch = await fetch_one(
        """
        SELECT count(*) AS invalid_count
        FROM utility_bills b
        JOIN (
            SELECT bill_id, sum(paid_amount) AS sum_paid, sum(assigned_amount) AS sum_assigned
            FROM student_utility_debts
            GROUP BY bill_id
        ) d ON d.bill_id = b.bill_id
        WHERE b.month_year >= '2024-10' AND b.month_year <= '2026-09'
          AND (b.paid_amount <> d.sum_paid OR b.total_amount <> d.sum_assigned);
        """
    )
    assert mismatch["invalid_count"] == 0

    # 4. Verify behavioral clustering skew
    # Night owls (B2100009, B2100010) should have higher late count than B2100001
    late_counts = await fetch_all(
        """
        SELECT student_id, count(*) AS late_count
        FROM dorm_access_logs
        WHERE is_late = TRUE AND student_id IN ('B2100001', 'B2100009')
        GROUP BY student_id;
        """
    )
    c_map = {r["student_id"]: r["late_count"] for r in late_counts}
    assert c_map["B2100009"] > c_map["B2100001"] * 1.5

    # 5. Idempotence: running it again does not crash or double counts
    await seed_billing_history_and_skew_logs()
    b_counts_2 = await fetch_all(
        """
        SELECT room_id, count(*) AS bill_count 
        FROM utility_bills 
        WHERE month_year >= '2024-10' AND month_year <= '2026-09'
        GROUP BY room_id;
        """
    )
    for b in b_counts_2:
        assert b["bill_count"] == 24

import asyncio
import sys
from decimal import Decimal
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db import close_pool, get_connection

ROOM_STUDENTS = {
    1: ["B2100001", "B2100002"],
    2: ["B2100003", "B2100004"],
    3: ["B2100005", "B2100006"],
    4: ["B2100007", "B2100008"],
    5: ["B2100009", "B2100010"],
    6: ["B2100011", "B2100012"],
}

FINANCIAL_RISK_STUDENTS = {"B2100003", "B2100004", "B2100007", "B2100008"}
SECURITY_RISK_STUDENTS = {"B2100009", "B2100010", "B2100011", "B2100012"}


def calculate_tiered_elec(delta_kwh: int) -> Decimal:
    if delta_kwh <= 100:
        return Decimal(delta_kwh * 2000)
    elif delta_kwh <= 200:
        return Decimal((100 * 2000) + ((delta_kwh - 100) * 2500))
    else:
        return Decimal((100 * 2000) + (100 * 2500) + ((delta_kwh - 200) * 3000))


def calculate_water(delta_m3: int) -> Decimal:
    return Decimal(delta_m3 * 10000)


def generate_month_sequence() -> list[str]:
    months = []
    for m in range(10, 13):
        months.append(f"2024-{m:02d}")
    for m in range(1, 13):
        months.append(f"2025-{m:02d}")
    for m in range(1, 10):
        months.append(f"2026-{m:02d}")
    return months


async def seed_billing_history_and_skew_logs() -> None:
    months = generate_month_sequence()
    assert len(months) == 24

    curr_elec_map = {1: 1000, 2: 1200, 3: 800, 4: 900, 5: 1500, 6: 1400}
    curr_water_map = {1: 100, 2: 120, 3: 80, 4: 90, 5: 150, 6: 140}

    async with (
        get_connection() as conn,
        conn.transaction(),
        conn.cursor() as cur,
    ):
        await cur.execute(
            "DELETE FROM utility_bills WHERE month_year >= '2024-10' AND month_year <= '2026-09';"
        )

        for m_idx, month_str in enumerate(months, start=1):
            cal_month = int(month_str.split("-")[1])

            for room_id in range(1, 7):
                prev_elec = curr_elec_map[room_id]
                prev_water = curr_water_map[room_id]

                if cal_month in (3, 4, 5, 6):
                    delta_elec = 220 + (room_id * 15) + ((m_idx % 7) * 8)
                elif cal_month in (11, 12, 1, 2):
                    delta_elec = 130 + (room_id * 10) + ((m_idx % 5) * 6)
                else:
                    delta_elec = 170 + (room_id * 12) + ((m_idx % 6) * 7)

                delta_water = 16 + (room_id * 2) + ((m_idx % 4) * 2)

                curr_elec = prev_elec + delta_elec
                curr_water = prev_water + delta_water

                curr_elec_map[room_id] = curr_elec
                curr_water_map[room_id] = curr_water

                total_amount = calculate_tiered_elec(delta_elec) + calculate_water(
                    delta_water
                )
                split_amount = total_amount / Decimal(2)

                students = ROOM_STUDENTS[room_id]
                debt_records = []
                bill_paid = Decimal("0.00")

                for st_id in students:
                    if st_id in FINANCIAL_RISK_STUDENTS:
                        if m_idx % 3 == 0:
                            st_paid = split_amount
                            st_status = "PAID"
                        else:
                            st_paid = Decimal("0.00")
                            st_status = "UNPAID"
                    elif st_id in SECURITY_RISK_STUDENTS:
                        if m_idx == 24:
                            st_paid = Decimal("0.00")
                            st_status = "UNPAID"
                        else:
                            st_paid = split_amount
                            st_status = "PAID"
                    else:
                        st_paid = split_amount
                        st_status = "PAID"

                    bill_paid += st_paid
                    debt_records.append((st_id, split_amount, st_paid, st_status))

                if bill_paid == total_amount:
                    b_status = "PAID"
                elif bill_paid > Decimal("0.00"):
                    b_status = "PARTIALLY_PAID"
                else:
                    b_status = "UNPAID"

                await cur.execute(
                    """
                    INSERT INTO utility_bills (
                        room_id, month_year, prev_electric, curr_electric,
                        prev_water, curr_water, total_amount, paid_amount, bill_status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING bill_id;
                    """,
                    (
                        room_id,
                        month_str,
                        prev_elec,
                        curr_elec,
                        prev_water,
                        curr_water,
                        total_amount,
                        bill_paid,
                        b_status,
                    ),
                )
                bill_id = (await cur.fetchone())["bill_id"]

                for st_id, assigned, paid, d_status in debt_records:
                    await cur.execute(
                        """
                        INSERT INTO student_utility_debts (
                            bill_id, student_id, assigned_amount, paid_amount, debt_status
                        ) VALUES (%s, %s, %s, %s, %s);
                        """,
                        (bill_id, st_id, assigned, paid, d_status),
                    )

        await cur.execute(
            """
            UPDATE dorm_access_logs
            SET student_id = CASE (log_id % 4)
                WHEN 0 THEN 'B2100009'
                WHEN 1 THEN 'B2100010'
                WHEN 2 THEN 'B2100011'
                ELSE 'B2100012'
            END
            WHERE is_late = TRUE 
              AND student_id NOT IN ('B2100009', 'B2100010', 'B2100011', 'B2100012')
              AND (log_id % 4 = 0);
            """
        )


if __name__ == "__main__":

    async def main():
        print("Seeding 24 months billing history and skewing access logs...")
        await seed_billing_history_and_skew_logs()
        print("Completed seeding successfully.")
        await close_pool()

    asyncio.run(main())

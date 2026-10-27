from typing import Any

from app.db import fetch_all, fetch_one, get_connection
from app.errors import raise_sp1_error
from app.schemas import GenerateBillIn


async def generate_and_split_bill(payload: GenerateBillIn) -> dict[str, Any]:
    async with get_connection() as conn, conn.cursor() as cur:
        await cur.execute(
            """
                CALL sp_generate_and_split_utility_bill(
                    %s, %s, %s, %s, %s, %s,
                    NULL, NULL, NULL, NULL, NULL
                );
                """,
            (
                payload.room_id,
                payload.month_year,
                payload.prev_electric,
                payload.curr_electric,
                payload.prev_water,
                payload.curr_water,
            ),
        )
        out_row = await cur.fetchone()

    status_code = out_row["p_status_code"]
    message = out_row["p_message"]

    if status_code != 0:
        raise_sp1_error(status_code, message)

    bill_row = await fetch_one(
        "SELECT bill_id FROM utility_bills WHERE room_id = %s AND month_year = %s;",
        (payload.room_id, payload.month_year),
    )
    bill_id = bill_row["bill_id"] if bill_row else 0

    debt_rows = await fetch_all(
        """
        SELECT debt_id, student_id, assigned_amount, paid_amount, debt_status
        FROM student_utility_debts
        WHERE bill_id = %s
        ORDER BY debt_id;
        """,
        (bill_id,),
    )

    return {
        "bill_id": bill_id,
        "room_id": payload.room_id,
        "month_year": payload.month_year,
        "total_amount": float(out_row["p_total_amount"]),
        "split_amount": float(out_row["p_split_amount"]),
        "student_count": out_row["p_student_count"],
        "status_code": status_code,
        "message": message,
        "debts": [
            {
                "debt_id": d["debt_id"],
                "student_id": d["student_id"],
                "assigned_amount": float(d["assigned_amount"]),
                "paid_amount": float(d["paid_amount"]),
                "debt_status": d["debt_status"],
            }
            for d in debt_rows
        ],
    }

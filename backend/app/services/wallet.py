from app.db import get_connection
from app.errors import ApiError


async def topup_student_wallet(
    student_id: str, amount: float
) -> dict[str, float | str]:
    async with get_connection() as conn, conn.transaction(), conn.cursor() as cur:
        await cur.execute(
            "SELECT student_id FROM students WHERE student_id = %s;",
            (student_id,),
        )
        if not await cur.fetchone():
            raise ApiError(
                http_status=404,
                error_code="STUDENT_NOT_FOUND",
                message=f"Sinh viên mã {student_id} không tồn tại trong hệ thống.",
            )

        await cur.execute(
            """
            INSERT INTO student_wallets (student_id, balance, updated_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (student_id) DO UPDATE
            SET balance = student_wallets.balance + EXCLUDED.balance,
                updated_at = CURRENT_TIMESTAMP
            RETURNING balance;
            """,
            (student_id, amount),
        )
        row = await cur.fetchone()

    return {
        "student_id": student_id,
        "amount_added": amount,
        "new_balance": float(row["balance"]),
    }

from app.db import fetch_one
from app.errors import ApiError


async def topup_student_wallet(
    student_id: str, amount: float
) -> dict[str, float | str]:
    student = await fetch_one(
        "SELECT student_id FROM students WHERE student_id = %s;",
        (student_id,),
    )
    if not student:
        raise ApiError(
            http_status=404,
            error_code="STUDENT_NOT_FOUND",
            message=f"Sinh viên mã {student_id} không tồn tại trong hệ thống.",
        )

    row = await fetch_one(
        """
        UPDATE student_wallets 
        SET balance = balance + %s, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE student_id = %s 
        RETURNING balance;
        """,
        (amount, student_id),
    )
    if not row:
        row = await fetch_one(
            """
            INSERT INTO student_wallets (student_id, balance) 
            VALUES (%s, %s) 
            RETURNING balance;
            """,
            (student_id, amount),
        )

    return {
        "student_id": student_id,
        "amount_added": amount,
        "new_balance": float(row["balance"]),
    }

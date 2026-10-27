from typing import Any

from app.db import fetch_all, fetch_one
from app.errors import ApiError


async def get_student_profile(student_id: str) -> dict[str, Any]:
    row = await fetch_one(
        """
        SELECT s.student_id, s.full_name, s.email, s.phone, s.major, s.status,
               w.balance AS wallet_balance, w.updated_at AS wallet_updated_at
        FROM students s
        LEFT JOIN student_wallets w ON w.student_id = s.student_id
        WHERE s.student_id = %s;
        """,
        (student_id,),
    )
    if not row:
        raise ApiError(
            http_status=404,
            error_code="STUDENT_NOT_FOUND",
            message=f"Sinh viên mã {student_id} không tồn tại trong hệ thống.",
        )
    return {
        "student_id": row["student_id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "phone": row["phone"],
        "major": row["major"],
        "status": row["status"],
        "wallet": {
            "balance": float(row["wallet_balance"])
            if row["wallet_balance"] is not None
            else 0.0,
            "updated_at": row["wallet_updated_at"].isoformat()
            if row["wallet_updated_at"]
            else None,
        },
    }


async def get_student_room(student_id: str) -> dict[str, Any]:
    assignment = await fetch_one(
        """
        SELECT a.assignment_id, a.bed_number, a.start_date, a.end_date,
               r.room_id, r.room_number, r.capacity, r.current_occupancy, r.base_price, r.status AS room_status,
               b.building_id, b.building_name, b.gender_zone
        FROM room_assignments a
        JOIN rooms r ON r.room_id = a.room_id
        JOIN dorm_buildings b ON b.building_id = r.building_id
        WHERE a.student_id = %s AND a.is_active = TRUE;
        """,
        (student_id,),
    )
    if not assignment:
        raise ApiError(
            http_status=404,
            error_code="ROOM_ASSIGNMENT_NOT_FOUND",
            message=f"Sinh viên {student_id} hiện chưa có hợp đồng lưu trú hợp lệ.",
        )

    room_id = assignment["room_id"]
    roommate_rows = await fetch_all(
        """
        SELECT s.student_id, s.full_name, a.bed_number, s.phone
        FROM room_assignments a
        JOIN students s ON s.student_id = a.student_id
        WHERE a.room_id = %s AND a.is_active = TRUE AND a.student_id <> %s
        ORDER BY a.bed_number;
        """,
        (room_id, student_id),
    )

    return {
        "room_id": assignment["room_id"],
        "room_number": assignment["room_number"],
        "building_id": assignment["building_id"],
        "building_name": assignment["building_name"],
        "gender_zone": assignment["gender_zone"],
        "bed_number": assignment["bed_number"],
        "capacity": assignment["capacity"],
        "current_occupancy": assignment["current_occupancy"],
        "base_price": float(assignment["base_price"]),
        "start_date": str(assignment["start_date"]),
        "end_date": str(assignment["end_date"]) if assignment["end_date"] else None,
        "roommates": [
            {
                "student_id": r["student_id"],
                "full_name": r["full_name"],
                "bed_number": r["bed_number"],
                "phone": r["phone"],
            }
            for r in roommate_rows
        ],
    }


async def get_student_debts(student_id: str) -> list[dict[str, Any]]:
    rows = await fetch_all(
        """
        SELECT d.debt_id, d.bill_id, d.assigned_amount, d.paid_amount, d.debt_status,
               b.month_year, b.total_amount AS bill_total_amount, b.bill_status,
               r.room_number
        FROM student_utility_debts d
        JOIN utility_bills b ON b.bill_id = d.bill_id
        JOIN rooms r ON r.room_id = b.room_id
        WHERE d.student_id = %s
        ORDER BY b.month_year DESC, d.debt_id DESC;
        """,
        (student_id,),
    )
    return [
        {
            "debt_id": r["debt_id"],
            "bill_id": r["bill_id"],
            "month_year": r["month_year"],
            "room_number": r["room_number"],
            "bill_total_amount": float(r["bill_total_amount"]),
            "assigned_amount": float(r["assigned_amount"]),
            "paid_amount": float(r["paid_amount"]),
            "remaining_amount": float(r["assigned_amount"] - r["paid_amount"]),
            "debt_status": r["debt_status"],
            "bill_status": r["bill_status"],
        }
        for r in rows
    ]


async def get_student_transactions(student_id: str) -> list[dict[str, Any]]:
    rows = await fetch_all(
        """
        SELECT tx_id, debt_id, bill_id, amount, tx_time, reference_code, status
        FROM payment_transactions
        WHERE student_id = %s
        ORDER BY tx_time DESC, tx_id DESC;
        """,
        (student_id,),
    )
    return [
        {
            "tx_id": r["tx_id"],
            "debt_id": r["debt_id"],
            "bill_id": r["bill_id"],
            "amount": float(r["amount"]),
            "tx_time": r["tx_time"].isoformat(),
            "reference_code": r["reference_code"],
            "status": r["status"],
        }
        for r in rows
    ]


async def get_student_access_logs(
    student_id: str,
    from_date: str | None = None,
    to_date: str | None = None,
    late_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    clauses = ["student_id = %s"]
    params: list[Any] = [student_id]

    if late_only:
        clauses.append("is_late = TRUE")
    if from_date:
        clauses.append("check_time >= %s::timestamp")
        params.append(from_date)
    if to_date:
        clauses.append("check_time <= %s::timestamp")
        params.append(to_date)

    where_sql = " AND ".join(clauses)

    count_row = await fetch_one(
        f"""
        SELECT count(*) AS total,
               count(*) FILTER (WHERE is_late = TRUE) AS late_count
        FROM dorm_access_logs
        WHERE {where_sql};
        """,
        tuple(params),
    )

    query_params = list(params)
    query_params.extend([limit, offset])

    items = await fetch_all(
        f"""
        SELECT log_id, gate_name, check_time, is_late
        FROM dorm_access_logs
        WHERE {where_sql}
        ORDER BY check_time DESC
        LIMIT %s OFFSET %s;
        """,
        tuple(query_params),
    )

    return {
        "total": count_row["total"] if count_row else 0,
        "late_count": count_row["late_count"] if count_row else 0,
        "items": [
            {
                "log_id": r["log_id"],
                "gate_name": r["gate_name"],
                "check_time": r["check_time"].isoformat(),
                "is_late": r["is_late"],
            }
            for r in items
        ],
    }

from typing import Any

import psycopg.errors

from app.db import fetch_all, fetch_one, get_connection
from app.errors import ApiError


async def get_dashboard_summary() -> dict[str, Any]:
    b_row = await fetch_one("SELECT count(*) AS total_buildings FROM dorm_buildings;")
    total_buildings = b_row["total_buildings"] if b_row else 0

    r_row = await fetch_one(
        """
        SELECT count(*) AS total_rooms,
               coalesce(sum(capacity), 0) AS total_capacity,
               coalesce(sum(current_occupancy), 0) AS total_occupancy
        FROM rooms;
        """
    )
    total_rooms = r_row["total_rooms"] if r_row else 0
    total_capacity = int(r_row["total_capacity"]) if r_row else 0
    total_occupancy = int(r_row["total_occupancy"]) if r_row else 0
    occupancy_rate = (
        round((total_occupancy / total_capacity * 100), 2)
        if total_capacity > 0
        else 0.0
    )

    s_row = await fetch_one(
        "SELECT count(*) AS total_students FROM students WHERE status = 'ACTIVE';"
    )
    total_students = s_row["total_students"] if s_row else 0

    d_row = await fetch_one(
        """
        SELECT coalesce(sum(assigned_amount - paid_amount), 0.00) AS total_unpaid_debt
        FROM student_utility_debts
        WHERE debt_status = 'UNPAID';
        """
    )
    total_unpaid_debt = float(d_row["total_unpaid_debt"]) if d_row else 0.0

    p_row = await fetch_one(
        """
        SELECT coalesce(sum(curr_electric - prev_electric), 0.0) AS total_power_kwh
        FROM utility_bills;
        """
    )
    total_power_kwh = float(p_row["total_power_kwh"]) if p_row else 0.0

    return {
        "total_buildings": total_buildings,
        "total_rooms": total_rooms,
        "total_capacity": total_capacity,
        "total_occupancy": total_occupancy,
        "occupancy_rate": occupancy_rate,
        "total_students": total_students,
        "total_unpaid_debt": total_unpaid_debt,
        "total_power_kwh": total_power_kwh,
    }


async def update_bill_meters(
    bill_id: int,
    curr_electric: int,
    curr_water: int,
) -> dict[str, Any]:
    existing = await fetch_one(
        "SELECT bill_id FROM utility_bills WHERE bill_id = %s;", (bill_id,)
    )
    if not existing:
        raise ApiError(404, "BILL_NOT_FOUND", f"Hóa đơn #{bill_id} không tồn tại.")

    try:
        async with get_connection() as conn, conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE utility_bills 
                SET curr_electric = %s, curr_water = %s 
                WHERE bill_id = %s 
                RETURNING bill_id, room_id, month_year, prev_electric, curr_electric, prev_water, curr_water, total_amount, paid_amount, bill_status;
                """,
                (curr_electric, curr_water, bill_id),
            )
            row = await cur.fetchone()
    except psycopg.errors.CheckViolation as ex:
        msg = str(ex).split("\n")[0].strip()
        raise ApiError(422, "FRAUD_METER_REVERSAL", msg) from ex
    except psycopg.errors.IntegrityConstraintViolation as ex:
        msg = str(ex).split("\n")[0].strip()
        raise ApiError(422, "FRAUD_PAID_BILL_TAMPER", msg) from ex

    return {
        "bill_id": row["bill_id"],
        "room_id": row["room_id"],
        "month_year": row["month_year"],
        "prev_electric": row["prev_electric"],
        "curr_electric": row["curr_electric"],
        "prev_water": row["prev_water"],
        "curr_water": row["curr_water"],
        "total_amount": float(row["total_amount"]),
        "paid_amount": float(row["paid_amount"]),
        "bill_status": row["bill_status"],
    }


async def get_audit_logs(
    record_id: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    clauses = ["table_name = 'utility_bills'"]
    params: list[Any] = []
    if record_id:
        clauses.append("record_id = %s")
        params.append(record_id)
    if from_date:
        clauses.append("changed_at >= %s::timestamptz")
        params.append(from_date)
    if to_date:
        clauses.append("changed_at <= %s::timestamptz")
        params.append(to_date)

    where_sql = " AND ".join(clauses)
    query_params = list(params)
    query_params.extend([limit, offset])

    rows = await fetch_all(
        f"""
        SELECT log_id, table_name, action_type, record_id, changed_by, changed_at, reason, old_data, new_data
        FROM audit_logs
        WHERE {where_sql}
        ORDER BY log_id DESC
        LIMIT %s OFFSET %s;
        """,
        tuple(query_params),
    )

    return [
        {
            "log_id": r["log_id"],
            "table_name": r["table_name"],
            "action_type": r["action_type"],
            "record_id": r["record_id"],
            "changed_by": r["changed_by"],
            "changed_at": r["changed_at"].isoformat(),
            "reason": r["reason"],
            "old_data": r["old_data"],
            "new_data": r["new_data"],
        }
        for r in rows
    ]


async def search_all_access_logs(
    student_id: str | None = None,
    gate_name: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    late_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    clauses = ["1=1"]
    params: list[Any] = []

    if student_id:
        clauses.append("l.student_id = %s")
        params.append(student_id)
    if gate_name:
        clauses.append("l.gate_name = %s")
        params.append(gate_name)
    if late_only:
        clauses.append("l.is_late = TRUE")
    if from_date:
        clauses.append("l.check_time >= %s::timestamp")
        params.append(from_date)
    if to_date:
        clauses.append("l.check_time <= %s::timestamp")
        params.append(to_date)

    where_sql = " AND ".join(clauses)

    count_row = await fetch_one(
        f"""
        SELECT count(*) AS total,
               count(*) FILTER (WHERE l.is_late = TRUE) AS late_count
        FROM dorm_access_logs l
        WHERE {where_sql};
        """,
        tuple(params),
    )

    query_params = list(params)
    query_params.extend([limit, offset])

    items = await fetch_all(
        f"""
        SELECT l.log_id, l.student_id, s.full_name AS student_name, l.gate_name, l.check_time, l.is_late
        FROM dorm_access_logs l
        JOIN students s ON s.student_id = l.student_id
        WHERE {where_sql}
        ORDER BY l.check_time DESC
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
                "student_id": r["student_id"],
                "student_name": r["student_name"],
                "gate_name": r["gate_name"],
                "check_time": r["check_time"].isoformat(),
                "is_late": r["is_late"],
            }
            for r in items
        ],
    }

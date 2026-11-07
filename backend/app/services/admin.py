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


def _calculate_progressive_bill_total(delta_elec: int, delta_water: int) -> float:
    # Apply the 3-tier progressive electricity tariff matching SP1
    if delta_elec <= 100:
        elec_cost = delta_elec * 2000.0
    elif delta_elec <= 200:
        elec_cost = (100 * 2000.0) + ((delta_elec - 100) * 2500.0)
    else:
        elec_cost = (100 * 2000.0) + (100 * 2500.0) + ((delta_elec - 200) * 3000.0)
    water_cost = delta_water * 10000.0
    return round(elec_cost + water_cost, 2)


async def update_bill_meters(
    bill_id: int,
    curr_electric: int,
    curr_water: int,
) -> dict[str, Any]:
    existing = await fetch_one(
        "SELECT bill_id, prev_electric, prev_water, paid_amount, bill_status FROM utility_bills WHERE bill_id = %s;",
        (bill_id,),
    )
    if not existing:
        raise ApiError(404, "BILL_NOT_FOUND", f"Hóa đơn #{bill_id} không tồn tại.")

    delta_elec = curr_electric - int(existing["prev_electric"])
    delta_water = curr_water - int(existing["prev_water"])
    recalc_total = (
        _calculate_progressive_bill_total(delta_elec, delta_water)
        if delta_elec >= 0 and delta_water >= 0
        else None
    )

    try:
        async with get_connection() as conn, conn.transaction(), conn.cursor() as cur:
            if recalc_total is not None and existing["bill_status"] == "UNPAID":
                await cur.execute(
                    """
                    UPDATE utility_bills 
                    SET curr_electric = %s, curr_water = %s, total_amount = %s 
                    WHERE bill_id = %s 
                    RETURNING bill_id, room_id, month_year, prev_electric, curr_electric, prev_water, curr_water, total_amount, paid_amount, bill_status;
                    """,
                    (curr_electric, curr_water, recalc_total, bill_id),
                )
            else:
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

            # Reallocate unpaid child debts when an unpaid bill's meters are legitimately adjusted
            if (
                recalc_total is not None
                and row["bill_status"] == "UNPAID"
                and float(row["paid_amount"]) == 0.0
            ):
                await cur.execute(
                    "SELECT debt_id FROM student_utility_debts WHERE bill_id = %s AND paid_amount = 0 ORDER BY student_id;",
                    (bill_id,),
                )
                debt_rows = await cur.fetchall()
                n_debts = len(debt_rows)
                if n_debts > 0:
                    split_amt = round(recalc_total / n_debts, 2)
                    for idx, d_row in enumerate(debt_rows):
                        assigned = (
                            round(recalc_total - split_amt * (n_debts - 1), 2)
                            if idx == n_debts - 1
                            else split_amt
                        )
                        await cur.execute(
                            "UPDATE student_utility_debts SET assigned_amount = %s WHERE debt_id = %s;",
                            (assigned, d_row["debt_id"]),
                        )
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


async def get_bills_list(
    month_year: str | None = None,
    status: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    clauses = ["1=1"]
    params: list[Any] = []
    if month_year:
        clauses.append("ub.month_year = %s")
        params.append(month_year)
    if status:
        clauses.append("ub.bill_status = %s")
        params.append(status)

    where_sql = " AND ".join(clauses)
    params.append(limit)
    rows = await fetch_all(
        f"""
        SELECT ub.bill_id, ub.room_id, r.room_number, r.building_id, b.building_name,
               r.current_occupancy, ub.month_year, ub.prev_electric, ub.curr_electric,
               ub.prev_water, ub.curr_water, ub.total_amount, ub.paid_amount,
               ub.bill_status, ub.created_at
        FROM utility_bills ub
        JOIN rooms r ON r.room_id = ub.room_id
        JOIN dorm_buildings b ON b.building_id = r.building_id
        WHERE {where_sql}
        ORDER BY ub.month_year DESC, ub.room_id ASC, ub.bill_id DESC
        LIMIT %s;
        """,
        tuple(params),
    )
    return [
        {
            "bill_id": r["bill_id"],
            "room_id": r["room_id"],
            "room_number": r["room_number"],
            "building_id": r["building_id"],
            "building_name": r["building_name"],
            "occupants": r["current_occupancy"],
            "month_year": r["month_year"],
            "prev_electric": r["prev_electric"],
            "curr_electric": r["curr_electric"],
            "prev_water": r["prev_water"],
            "curr_water": r["curr_water"],
            "total_amount": float(r["total_amount"]),
            "paid_amount": float(r["paid_amount"]),
            "bill_status": r["bill_status"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


async def get_students_list() -> list[dict[str, Any]]:
    rows = await fetch_all(
        """
        SELECT s.student_id, s.full_name, s.gender, s.email, s.phone, s.major, s.cohort, s.status,
               coalesce(w.balance, 0.00) AS wallet_balance,
               ra.assignment_id, ra.room_id, r.room_number, r.building_id, ra.bed_number, ra.start_date, ra.end_date,
               coalesce(d.unpaid_debt, 0.00) AS unpaid_debt,
               coalesce(l.late_count, 0) AS late_count
        FROM students s
        LEFT JOIN student_wallets w ON w.student_id = s.student_id
        LEFT JOIN room_assignments ra ON ra.student_id = s.student_id AND ra.is_active = TRUE
        LEFT JOIN rooms r ON r.room_id = ra.room_id
        LEFT JOIN (
            SELECT student_id, sum(assigned_amount - paid_amount) AS unpaid_debt
            FROM student_utility_debts
            WHERE debt_status = 'UNPAID'
            GROUP BY student_id
        ) d ON d.student_id = s.student_id
        LEFT JOIN (
            SELECT student_id, count(*) AS late_count
            FROM dorm_access_logs
            WHERE is_late = TRUE
            GROUP BY student_id
        ) l ON l.student_id = s.student_id
        ORDER BY s.student_id;
        """
    )
    return [
        {
            "student_id": r["student_id"],
            "full_name": r["full_name"],
            "gender": r["gender"],
            "email": r["email"],
            "phone": r["phone"],
            "major": r["major"],
            "cohort": r["cohort"],
            "status": r["status"],
            "wallet_balance": float(r["wallet_balance"]),
            "assignment_id": r["assignment_id"],
            "room_id": r["room_id"],
            "room_number": r["room_number"],
            "building_id": r["building_id"],
            "bed_number": r["bed_number"],
            "start_date": str(r["start_date"]) if r["start_date"] else None,
            "end_date": str(r["end_date"]) if r["end_date"] else None,
            "unpaid_debt": float(r["unpaid_debt"]),
            "late_count": int(r["late_count"]),
        }
        for r in rows
    ]


async def get_assignments_list() -> list[dict[str, Any]]:
    rows = await fetch_all(
        """
        SELECT ra.assignment_id, ra.room_id, r.room_number, r.building_id, b.building_name,
               r.base_price, r.capacity, r.current_occupancy,
               ra.student_id, s.full_name, s.major, s.phone,
               ra.bed_number, ra.start_date, ra.end_date, ra.is_active
        FROM room_assignments ra
        JOIN rooms r ON r.room_id = ra.room_id
        JOIN dorm_buildings b ON b.building_id = r.building_id
        JOIN students s ON s.student_id = ra.student_id
        ORDER BY ra.is_active DESC, ra.assignment_id ASC;
        """
    )
    return [
        {
            "assignment_id": r["assignment_id"],
            "room_id": r["room_id"],
            "room_number": r["room_number"],
            "building_id": r["building_id"],
            "building_name": r["building_name"],
            "base_price": float(r["base_price"]),
            "capacity": r["capacity"],
            "current_occupancy": r["current_occupancy"],
            "student_id": r["student_id"],
            "full_name": r["full_name"],
            "major": r["major"],
            "phone": r["phone"],
            "bed_number": r["bed_number"],
            "start_date": str(r["start_date"]),
            "end_date": str(r["end_date"]) if r["end_date"] else None,
            "is_active": r["is_active"],
        }
        for r in rows
    ]


async def reset_demo_checkpoints() -> dict[str, Any]:
    # Clean up any 2026-11 test bills and restore deterministic wallet/debt state for CP1-CP5
    async with get_connection() as conn, conn.transaction(), conn.cursor() as cur:
        await cur.execute(
            """
            DELETE FROM payment_transactions
            WHERE bill_id IN (SELECT bill_id FROM utility_bills WHERE month_year = '2026-11');
            """
        )
        await cur.execute("DELETE FROM utility_bills WHERE month_year = '2026-11';")
        await cur.execute(
            "UPDATE student_wallets SET balance = 1500000.00, updated_at = CURRENT_TIMESTAMP WHERE student_id = 'B2100001';"
        )
        await cur.execute(
            "UPDATE student_wallets SET balance = 800000.00, updated_at = CURRENT_TIMESTAMP WHERE student_id = 'B2100002';"
        )
        await cur.execute(
            "UPDATE student_wallets SET balance = 500000.00, updated_at = CURRENT_TIMESTAMP WHERE student_id = 'B2100004';"
        )

        # Ensure Room 2 (B1-102) has an unpaid 2026-11 bill with 1,075,000 VND debt per student for CP4
        await cur.execute(
            """
            CALL sp_generate_and_split_utility_bill(
                2, '2026-11', 200, 750, 30, 85,
                NULL, NULL, NULL, NULL, NULL
            );
            """
        )
        await cur.execute(
            """
            SELECT d.debt_id, d.assigned_amount
            FROM student_utility_debts d
            JOIN utility_bills b ON b.bill_id = d.bill_id
            WHERE b.room_id = 2 AND b.month_year = '2026-11' AND d.student_id = 'B2100004';
            """
        )
        cp4_debt = await cur.fetchone()

    return {
        "reset_month": "2026-11",
        "cp4_student_id": "B2100004",
        "cp4_debt_id": cp4_debt["debt_id"] if cp4_debt else None,
        "cp4_assigned_amount": float(cp4_debt["assigned_amount"]) if cp4_debt else 1075000.0,
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

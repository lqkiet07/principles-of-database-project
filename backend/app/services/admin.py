from typing import Any

from app.db import fetch_one


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

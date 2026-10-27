from typing import Any

from app.db import fetch_all, get_connection
from app.errors import ApiError
from app.schemas import AssignmentIn


async def get_rooms_list(
    building_id: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    clauses = ["1=1"]
    params: list[Any] = []
    if building_id:
        clauses.append("r.building_id = %s")
        params.append(building_id)
    if status:
        clauses.append("r.status = %s")
        params.append(status)

    where_sql = " AND ".join(clauses)
    rows = await fetch_all(
        f"""
        SELECT r.room_id, r.room_number, r.building_id, b.building_name, b.gender_zone,
               r.capacity, r.current_occupancy, r.base_price, r.status, r.description
        FROM rooms r
        JOIN dorm_buildings b ON b.building_id = r.building_id
        WHERE {where_sql}
        ORDER BY r.room_id;
        """,
        tuple(params),
    )
    return [
        {
            "room_id": r["room_id"],
            "room_number": r["room_number"],
            "building_id": r["building_id"],
            "building_name": r["building_name"],
            "gender_zone": r["gender_zone"],
            "capacity": r["capacity"],
            "current_occupancy": r["current_occupancy"],
            "base_price": float(r["base_price"]),
            "status": r["status"],
            "description": r["description"],
        }
        for r in rows
    ]


async def assign_student(payload: AssignmentIn) -> dict[str, Any]:
    async with (
        get_connection() as conn,
        conn.transaction(),
        conn.cursor() as cur,
    ):
        await cur.execute(
            "SELECT room_id, capacity, current_occupancy, status FROM rooms WHERE room_id = %s FOR UPDATE;",
            (payload.room_id,),
        )
        room = await cur.fetchone()
        if not room:
            raise ApiError(
                404, "ROOM_NOT_FOUND", f"Phòng #{payload.room_id} không tồn tại."
            )
        if room["status"] == "MAINTENANCE":
            raise ApiError(
                422, "ROOM_IN_MAINTENANCE", "Phòng đang bảo trì, không thể xếp chỗ."
            )
        if room["current_occupancy"] >= room["capacity"]:
            raise ApiError(
                422, "ROOM_OVER_CAPACITY", "Phòng đã đủ chỗ (vượt quá sức chứa)."
            )
        if payload.bed_number > room["capacity"]:
            raise ApiError(
                422,
                "INVALID_BED_NUMBER",
                f"Số giường {payload.bed_number} vượt quá sức chứa phòng {room['capacity']}.",
            )

        await cur.execute(
            "SELECT student_id, status FROM students WHERE student_id = %s;",
            (payload.student_id,),
        )
        student = await cur.fetchone()
        if not student:
            raise ApiError(
                404,
                "STUDENT_NOT_FOUND",
                f"Sinh viên {payload.student_id} không tồn tại.",
            )
        if student["status"] != "ACTIVE":
            raise ApiError(
                422, "STUDENT_NOT_ACTIVE", "Sinh viên không ở trạng thái hoạt động."
            )

        await cur.execute(
            "SELECT assignment_id FROM room_assignments WHERE student_id = %s AND is_active = TRUE;",
            (payload.student_id,),
        )
        if await cur.fetchone():
            raise ApiError(
                409,
                "STUDENT_ALREADY_ASSIGNED",
                "Sinh viên đã có hợp đồng lưu trú còn hiệu lực.",
            )

        await cur.execute(
            "SELECT assignment_id FROM room_assignments WHERE room_id = %s AND bed_number = %s AND is_active = TRUE;",
            (payload.room_id, payload.bed_number),
        )
        if await cur.fetchone():
            raise ApiError(
                409,
                "BED_ALREADY_OCCUPIED",
                f"Giường số {payload.bed_number} của phòng này đã có người ở.",
            )

        await cur.execute(
            """
            INSERT INTO room_assignments (room_id, student_id, bed_number, start_date, end_date, is_active)
            VALUES (%s, %s, %s, %s::date, %s::date, TRUE)
            RETURNING assignment_id, start_date, end_date, is_active;
            """,
            (
                payload.room_id,
                payload.student_id,
                payload.bed_number,
                payload.start_date,
                payload.end_date,
            ),
        )
        assign_row = await cur.fetchone()

        new_occ = room["current_occupancy"] + 1
        new_status = "FULL" if new_occ >= room["capacity"] else "AVAILABLE"
        await cur.execute(
            "UPDATE rooms SET current_occupancy = %s, status = %s WHERE room_id = %s;",
            (new_occ, new_status, payload.room_id),
        )

    return {
        "assignment_id": assign_row["assignment_id"],
        "room_id": payload.room_id,
        "student_id": payload.student_id,
        "bed_number": payload.bed_number,
        "start_date": str(assign_row["start_date"]),
        "end_date": str(assign_row["end_date"]) if assign_row["end_date"] else None,
        "is_active": assign_row["is_active"],
    }


async def unassign_student(assignment_id: int) -> dict[str, Any]:
    async with (
        get_connection() as conn,
        conn.transaction(),
        conn.cursor() as cur,
    ):
        await cur.execute(
            "SELECT assignment_id, room_id, is_active FROM room_assignments WHERE assignment_id = %s FOR UPDATE;",
            (assignment_id,),
        )
        assign = await cur.fetchone()
        if not assign:
            raise ApiError(
                404, "ASSIGNMENT_NOT_FOUND", f"Hợp đồng #{assignment_id} không tồn tại."
            )
        if not assign["is_active"]:
            raise ApiError(
                422, "ASSIGNMENT_ALREADY_INACTIVE", "Hợp đồng đã kết thúc trước đó."
            )

        await cur.execute(
            "UPDATE room_assignments SET is_active = FALSE, end_date = CURRENT_DATE WHERE assignment_id = %s RETURNING end_date;",
            (assignment_id,),
        )
        end_row = await cur.fetchone()

        room_id = assign["room_id"]
        await cur.execute(
            """
            UPDATE rooms 
            SET current_occupancy = GREATEST(0, current_occupancy - 1),
                status = 'AVAILABLE'
            WHERE room_id = %s;
            """,
            (room_id,),
        )

    return {
        "assignment_id": assignment_id,
        "is_active": False,
        "end_date": str(end_row["end_date"]),
    }

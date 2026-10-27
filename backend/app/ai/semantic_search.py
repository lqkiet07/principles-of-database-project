from typing import Any

from app.ai.embeddings import embed_texts
from app.db import fetch_all


async def search_available_rooms(query: str, limit: int = 5) -> list[dict[str, Any]]:
    if not query.strip():
        return []

    vec = embed_texts([query])[0]
    vec_str = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"

    rows = await fetch_all(
        """
        SELECT r.room_id, r.room_number, r.building_id, b.building_name, b.gender_zone,
               r.capacity, r.current_occupancy, r.base_price, r.description, r.status,
               (r.embedding <=> %s::vector) AS cosine_distance
        FROM rooms r
        JOIN dorm_buildings b ON b.building_id = r.building_id
        WHERE r.status = 'AVAILABLE' AND r.embedding IS NOT NULL
        ORDER BY cosine_distance ASC
        LIMIT %s;
        """,
        (vec_str, limit),
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
            "description": r["description"],
            "status": r["status"],
            "cosine_distance": round(float(r["cosine_distance"]), 4),
            "similarity": round(max(0.0, 1.0 - float(r["cosine_distance"])), 4),
        }
        for r in rows
    ]

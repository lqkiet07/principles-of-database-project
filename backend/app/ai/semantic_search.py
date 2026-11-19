import asyncio
from typing import Any

from app.ai.embeddings import embed_texts, ensure_ai_enabled
from app.db import fetch_all, get_connection


async def reindex_all_rooms() -> int:
    ensure_ai_enabled()
    rooms = await fetch_all("SELECT room_id, description FROM rooms ORDER BY room_id;")
    if not rooms:
        return 0

    texts = [r["description"] or "" for r in rooms]
    # Offload CPU-bound embedding inference so the asyncio event loop stays responsive
    vectors = await asyncio.to_thread(embed_texts, texts)

    async with get_connection() as conn, conn.transaction(), conn.cursor() as cur:
        for room, vec in zip(rooms, vectors, strict=True):
            vec_str = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
            await cur.execute(
                "UPDATE rooms SET embedding = %s::vector WHERE room_id = %s;",
                (vec_str, room["room_id"]),
            )

    return len(rooms)


async def search_available_rooms(query: str, limit: int = 5) -> list[dict[str, Any]]:
    ensure_ai_enabled()
    if not query.strip():
        return []

    vectors = await asyncio.to_thread(embed_texts, [query])
    vec_str = "[" + ",".join(f"{x:.6f}" for x in vectors[0]) + "]"

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

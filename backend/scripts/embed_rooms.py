import asyncio
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.ai.embeddings import embed_texts
from app.db import close_pool, fetch_all, get_connection


async def reindex_all_rooms() -> int:
    rooms = await fetch_all("SELECT room_id, description FROM rooms ORDER BY room_id;")
    if not rooms:
        return 0

    texts = [r["description"] or "" for r in rooms]
    vectors = embed_texts(texts)

    async with get_connection() as conn, conn.transaction(), conn.cursor() as cur:
        for room, vec in zip(rooms, vectors, strict=True):
            vec_str = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
            await cur.execute(
                "UPDATE rooms SET embedding = %s::vector WHERE room_id = %s;",
                (vec_str, room["room_id"]),
            )

    return len(rooms)


if __name__ == "__main__":

    async def main():
        print("Re-indexing room embeddings with sentence-transformers...")
        n = await reindex_all_rooms()
        print(f"Re-embedded {n} rooms successfully.")
        await close_pool()

    asyncio.run(main())

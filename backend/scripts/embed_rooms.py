import asyncio
import sys
from pathlib import Path

# Ensure backend root is on sys.path when invoked as a standalone CLI script
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.ai.semantic_search import reindex_all_rooms
from app.db import close_pool

__all__ = ["reindex_all_rooms"]


if __name__ == "__main__":

    async def main():
        print("Re-indexing room embeddings with sentence-transformers...")
        n = await reindex_all_rooms()
        print(f"Re-embedded {n} rooms successfully.")
        await close_pool()

    asyncio.run(main())

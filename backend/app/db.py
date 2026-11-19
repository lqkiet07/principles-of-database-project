import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from collections.abc import Sequence
from contextlib import asynccontextmanager
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.config import settings

_pool: AsyncConnectionPool | None = None


async def get_pool() -> AsyncConnectionPool:
    global _pool
    if _pool is None:
        _pool = AsyncConnectionPool(
            conninfo=settings.database_url,
            min_size=2,
            max_size=20,
            open=False,
            kwargs={"row_factory": dict_row},
        )
        await _pool.open(wait=True)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_connection():
    pool = await get_pool()
    async with pool.connection() as conn:
        yield conn


@asynccontextmanager
async def transaction():
    """
    Giao dịch ACID mức cô lập READ COMMITTED kết hợp khóa dòng (SELECT ... FOR UPDATE)
    trong các thủ tục lưu trữ để chống tranh chấp ghi đồng thời và tự động ROLLBACK khi lỗi.
    """
    async with get_connection() as conn:
        async with conn.transaction():
            yield conn


async def fetch_all(sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
    async with get_connection() as conn, conn.cursor() as cur:
        await (cur.execute(sql, params) if params else cur.execute(sql))
        return await cur.fetchall()


async def fetch_one(sql: str, params: Sequence[Any] | None = None) -> dict[str, Any] | None:
    async with get_connection() as conn, conn.cursor() as cur:
        await (cur.execute(sql, params) if params else cur.execute(sql))
        return await cur.fetchone()


async def execute(sql: str, params: Sequence[Any] | None = None) -> int:
    async with get_connection() as conn, conn.cursor() as cur:
        await (cur.execute(sql, params) if params else cur.execute(sql))
        return cur.rowcount

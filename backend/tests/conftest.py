import asyncio
import selectors
import sys
from pathlib import Path

import httpx
import pytest
import pytest_asyncio

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings

settings.database_url = settings.test_database_url
if "test" not in settings.database_url.lower():
    raise RuntimeError("Refusing to run tests against a non-test database")

from app.db import close_pool, fetch_one, get_pool
from app.main import app


@pytest.hookimpl
def pytest_asyncio_loop_factories():
    if sys.platform == "win32":
        return {
            "default": lambda: asyncio.SelectorEventLoop(selectors.SelectSelector())
        }
    return {"default": asyncio.new_event_loop}


@pytest_asyncio.fixture(scope="session", autouse=True)
async def pool():
    p = await get_pool()
    try:
        logs = await fetch_one("SELECT count(*) AS count FROM dorm_access_logs;")
        bills = await fetch_one(
            """
            SELECT count(*) AS count
            FROM utility_bills
            WHERE month_year BETWEEN '2024-10' AND '2026-09';
            """
        )
        if logs["count"] < 1_000_000 or bills["count"] < 144:
            raise RuntimeError(
                "Test database is not seeded. Run backend/scripts/run_tests.ps1 "
                "or reset it with: python -m scripts.reset_test_db --with-logs "
                "&& python -m scripts.seed_history"
            )
        yield p
    finally:
        await close_pool()


@pytest_asyncio.fixture
async def client():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

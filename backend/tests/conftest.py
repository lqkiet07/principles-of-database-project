import asyncio
import sys
from pathlib import Path


def pytest_configure(config):
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


import httpx
import pytest_asyncio

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db import close_pool, get_pool
from app.main import app


@pytest_asyncio.fixture(autouse=True)
async def manage_pool():
    pool = await get_pool()
    yield pool
    await close_pool()


@pytest_asyncio.fixture
async def client():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

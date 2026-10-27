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

from app.db import close_pool, get_pool
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
    yield p
    await close_pool()


@pytest_asyncio.fixture
async def client():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

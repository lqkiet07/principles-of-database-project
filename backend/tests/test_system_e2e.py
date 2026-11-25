import asyncio
import sys
from pathlib import Path

import httpx

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db import close_pool, get_pool
from app.main import app


def _run(coro):
    return asyncio.run(coro)


async def _with_client(fn):
    await get_pool()
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await fn(client)
    finally:
        await close_pool()


def test_api_health_and_procedures():
    async def check(client: httpx.AsyncClient):
        r = await client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "PostgreSQL" in data["db_version"]
        assert "pr_thanh_toan_ngan_hang" in data["procedures"]

    _run(_with_client(check))


def test_auth_and_rbac():
    async def check(client: httpx.AsyncClient):
        r_admin = await client.post(
            "/api/auth/login", json={"ten_dang_nhap": "admin", "mat_khau": "Admin@123"}
        )
        assert r_admin.status_code == 200
        ah = {"Authorization": f"Bearer {r_admin.json()['access_token']}"}

        r_sv = await client.post(
            "/api/auth/login", json={"ten_dang_nhap": "B2100001", "mat_khau": "Ktx@123"}
        )
        assert r_sv.status_code == 200
        sh = {"Authorization": f"Bearer {r_sv.json()['access_token']}"}

        assert (await client.get("/api/admin/overview", headers=sh)).status_code == 403
        assert (await client.get("/api/admin/settings", headers=sh)).status_code == 403

        r_ov = await client.get("/api/admin/overview", headers=ah)
        assert r_ov.status_code == 200
        assert "tong_quan" in r_ov.json()

    _run(_with_client(check))


def test_student_bills_and_bank_sandbox():
    async def check(client: httpx.AsyncClient):
        r_sv = await client.post(
            "/api/auth/login", json={"ten_dang_nhap": "B2100001", "mat_khau": "Ktx@123"}
        )
        sh = {"Authorization": f"Bearer {r_sv.json()['access_token']}"}

        r_bills = await client.get("/api/student/bills", headers=sh)
        assert r_bills.status_code == 200
        data = r_bills.json()
        assert "sinh_vien" in data
        assert "so_du" not in data["sinh_vien"]
        assert len(data["tai_khoan_ngan_hang"]) >= 1
        assert "so_du_sandbox" in data["tai_khoan_ngan_hang"][0]

    _run(_with_client(check))


def test_ai_modules_search_forecast_clusters():
    async def check(client: httpx.AsyncClient):
        r_admin = await client.post(
            "/api/auth/login", json={"ten_dang_nhap": "admin", "mat_khau": "Admin@123"}
        )
        ah = {"Authorization": f"Bearer {r_admin.json()['access_token']}"}

        r_sem = await client.get(
            "/api/admin/rooms/semantic-search",
            params={"q": "phòng nam tầng trệt gần cổng đi lại thuận tiện", "limit": 4},
            headers=ah,
        )
        assert r_sem.status_code == 200
        assert len(r_sem.json()["items"]) >= 1

        r_fc = await client.get(
            "/api/admin/bills/forecast", params={"ma_khu": "A"}, headers=ah
        )
        assert r_fc.status_code == 200
        assert "du_bao" in r_fc.json()

        r_cl = await client.get("/api/admin/students/ai/clusters", headers=ah)
        assert r_cl.status_code == 200

    _run(_with_client(check))


if __name__ == "__main__":
    test_api_health_and_procedures()
    test_auth_and_rbac()
    test_student_bills_and_bank_sandbox()
    test_ai_modules_search_forecast_clusters()
    print("ALL 4 SYSTEM E2E TESTS PASSED!")

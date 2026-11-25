import asyncio
import sys
from pathlib import Path

import httpx

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db import close_pool, get_pool
from app.main import app


async def run_smoke() -> None:
    await get_pool()
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            # 1. Health & Stored Procedures
            r_health = await client.get("/health")
            r_health.raise_for_status()
            b_health = r_health.json()
            print(
                f"1. HEALTH: {b_health['status']} | DB User: {b_health['db_user']} | "
                f"Routines ({len(b_health['procedures'])}): {', '.join(b_health['procedures'][:5])}..."
            )

            # 2. Admin & Student Authentication
            r_admin = await client.post(
                "/api/auth/login",
                json={"ten_dang_nhap": "admin", "mat_khau": "Admin@123"},
            )
            r_admin.raise_for_status()
            ah = {"Authorization": f"Bearer {r_admin.json()['access_token']}"}

            r_sv = await client.post(
                "/api/auth/login",
                json={"ten_dang_nhap": "B2100001", "mat_khau": "Ktx@123"},
            )
            r_sv.raise_for_status()
            sh = {"Authorization": f"Bearer {r_sv.json()['access_token']}"}
            print("2. AUTH: Đăng nhập Quản trị viên & Sinh viên B2100001 thành công.")

            # 3. Overview Dashboard
            r_ov = await client.get("/api/admin/overview", headers=ah)
            r_ov.raise_for_status()
            tq = r_ov.json()["tong_quan"]
            print(
                f"3. TỔNG QUAN KTX: Tổng phòng = {tq['tong_so_phong']}, "
                f"SV đang ở = {tq['tong_sv_dang_o']}, "
                f"Phòng chưa nộp điện nước = {tq['so_phong_chua_nop_dien_nuoc']}"
            )

            # 4. Student Bills & Linked Bank Account
            r_bills = await client.get("/api/student/bills", headers=sh)
            r_bills.raise_for_status()
            sv_bills = r_bills.json()
            print(
                f"4. CỔNG SINH VIÊN: {len(sv_bills['tai_khoan_ngan_hang'])} TK ngân hàng liên kết, "
                f"số dư Sandbox = {sv_bills['tai_khoan_ngan_hang'][0]['so_du_sandbox']:,.0f} đ."
            )

            # 5. Semantic Room Search
            r_search = await client.get(
                "/api/admin/rooms/semantic-search",
                params={"q": "phòng nam tầng trệt gần cổng đi lại thuận tiện", "limit": 3},
                headers=ah,
            )
            r_search.raise_for_status()
            matches = r_search.json()["items"]
            top = matches[0] if matches else {}
            print(
                f"5. TÌM KIẾM NGỮ NGHĨA: {len(matches)} kết quả | "
                f"Top 1 = {top.get('ten_phong')} (similarity={top.get('similarity')})"
            )

            # 6. Utility Consumption Forecasting (RandomForestRegressor)
            r_fc = await client.get(
                "/api/admin/bills/forecast", params={"ma_khu": "A"}, headers=ah
            )
            r_fc.raise_for_status()
            fc = r_fc.json()
            metrics = fc["metrics"]
            print(
                f"6. DỰ BÁO ĐIỆN NƯỚC (Khu A): Model = {fc['model']} | "
                f"R2 = {metrics['r2_dien']}, MAE = {metrics['mae_dien']} kWh"
            )

            # 7. Student Behavioral Clustering (K-Means)
            r_cl = await client.get("/api/admin/students/ai/clusters", headers=ah)
            r_cl.raise_for_status()
            cl = r_cl.json()
            print(
                f"7. PHÂN NHÓM SINH VIÊN: Tổng {cl.get('tong_sinh_vien', len(cl.get('points', [])))} SV được phân tích."
            )
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(run_smoke())

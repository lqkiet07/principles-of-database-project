import asyncio

import httpx

from app.main import app


async def run_smoke():
    admin_h = {"X-Role": "admin"}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Health
        r_health = await client.get("/health")
        b_health = r_health.json()
        print(f"1. HEALTH: {b_health['status']} | Procedures: {', '.join(b_health['procedures'])}")

        # 2. Docs
        r_docs = await client.get("/docs")
        print(f"2. DOCS: Status {r_docs.status_code}")

        # 3. Semantic Search (pgvector)
        r_search = await client.get(
            "/api/ai/semantic-search",
            params={"q": "phòng nam tầng 1 gần căng tin", "limit": 2},
        )
        b_search = r_search.json()
        rooms = b_search.get("data", [])
        print(f"3. SEMANTIC SEARCH: {len(rooms)} matches found")
        for room in rooms:
            print(f"   - Room {room['room_number']} ({room['building_id']}): similarity = {room['similarity']}")

        # 4. Forecast (RandomForest)
        r_forecast = await client.get(
            "/api/ai/forecast", params={"building_id": "B1"}
        )
        b_forecast = r_forecast.json()["data"]
        print(f"4. FORECAST B1: Model = {b_forecast['model_name']}, MAE = {b_forecast['mae']} kWh")
        for f in b_forecast["predictions"]:
            print(f"   - Month {f['month_year']}: {f['predicted_kwh']} kWh")

        # 5. Clusters (K-Means & PCA)
        r_clusters = await client.get("/api/ai/clusters")
        b_clusters = r_clusters.json()["data"]
        print(f"5. CLUSTERS: {len(b_clusters['clusters'])} clusters, {len(b_clusters['points'])} students evaluated")
        for c in b_clusters["clusters"]:
            print(f"   - Cluster {c['cluster_id']}: {c['label_vi']} ({c['student_count']} students)")

        # 6. Benchmark Index on 1M Logs
        r_idx = await client.get("/api/admin/benchmark", params={"mode": "index"}, headers=admin_h)
        b_idx = r_idx.json()["data"]

        r_seq = await client.get("/api/admin/benchmark", params={"mode": "seq"}, headers=admin_h)
        b_seq = r_seq.json()["data"]

        print("6. BENCHMARK 1M LOGS:")
        print(f"   - Index Scan: {b_idx['execution_time_ms']} ms ({b_idx['shared_hit_blocks']} buffers hit, node={b_idx['node_type']})")
        print(f"   - Seq Scan:   {b_seq['execution_time_ms']} ms ({b_seq['shared_hit_blocks']} buffers hit, node={b_seq['node_type']})")

        # 7. Dashboard
        r_dash = await client.get("/api/admin/dashboard", headers=admin_h)
        dash = r_dash.json()["data"]
        print(f"7. DASHBOARD: Buildings = {dash['total_buildings']}, "
              f"Rooms = {dash['total_rooms']}, "
              f"Occupancy = {dash['occupancy_rate']}%, "
              f"Unpaid Debt = {dash['total_unpaid_debt']:,.0f} VND")


if __name__ == "__main__":
    asyncio.run(run_smoke())

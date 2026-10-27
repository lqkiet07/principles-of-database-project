import pytest

from app.db import fetch_one
from scripts.embed_rooms import reindex_all_rooms


@pytest.mark.asyncio
async def test_reindex_rooms_and_semantic_search(client):
    # 1. Run reindex
    count = await reindex_all_rooms()
    assert count == 6

    # Verify room embedding is non-null and 384 dimensions
    room = await fetch_one("SELECT embedding FROM rooms WHERE room_id = 1;")
    assert room["embedding"] is not None

    # 2. Test semantic search query for female room near library
    query = "phòng nữ thoáng mát yên tĩnh gần thư viện"
    response = await client.get(f"/api/ai/semantic-search?q={query}&limit=3")
    assert response.status_code == 200
    data = response.json()["data"]
    assert isinstance(data, list)
    assert len(data) >= 1

    top_match = data[0]
    # Rooms in B2 are female rooms near library (B2-201, B2-202)
    assert top_match["building_id"] == "B2"
    assert top_match["gender_zone"] == "FEMALE"
    assert top_match["similarity"] > 0.4
    assert "cosine_distance" in top_match


@pytest.mark.asyncio
async def test_semantic_search_excludes_maintenance_rooms(client):
    # Mark room 3 as MAINTENANCE
    from app.db import execute

    await execute("UPDATE rooms SET status = 'MAINTENANCE' WHERE room_id = 3;")

    try:
        query = "phòng nữ tầng 2"
        response = await client.get(f"/api/ai/semantic-search?q={query}")
        assert response.status_code == 200
        data = response.json()["data"]
        room_ids = [r["room_id"] for r in data]
        assert 3 not in room_ids
    finally:
        await execute("UPDATE rooms SET status = 'AVAILABLE' WHERE room_id = 3;")


@pytest.mark.asyncio
async def test_admin_ai_reindex_endpoint(client):
    headers = {"X-Role": "admin"}
    response = await client.post("/api/admin/ai/reindex", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["reindexed_count"] == 6

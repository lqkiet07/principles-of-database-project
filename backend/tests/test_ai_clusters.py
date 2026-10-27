import pytest


@pytest.mark.asyncio
async def test_get_student_clusters_success(client):
    response = await client.get("/api/ai/clusters")
    assert response.status_code == 200
    data = response.json()["data"]

    assert data["total_students"] == 12

    clusters = data["clusters"]
    assert len(clusters) == 3
    labels = {c["label"] for c in clusters}
    assert labels == {"STANDARD", "FINANCIAL_RISK", "SECURITY_RISK"}

    points = data["points"]
    assert len(points) == 12
    for p in points:
        assert "student_id" in p
        assert "full_name" in p
        assert "room_number" in p
        assert "late_count" in p
        assert "unpaid_ratio" in p
        assert "avg_power_kwh" in p
        assert "cluster_label" in p
        assert "pca_x" in p
        assert "pca_y" in p

    # Verify semantic cluster assignment for representative students
    student_map = {p["student_id"]: p for p in points}

    # B2100001 (Exemplary) -> STANDARD
    assert student_map["B2100001"]["cluster_label"] == "STANDARD"

    # B2100003 (Financial risk profile) -> FINANCIAL_RISK
    assert student_map["B2100003"]["cluster_label"] == "FINANCIAL_RISK"

    # B2100009 (Night owl profile) -> SECURITY_RISK
    assert student_map["B2100009"]["cluster_label"] == "SECURITY_RISK"

import json
from pathlib import Path

from app.main import app

REQUIRED_PATHS = [
    "/health",
    "/api/students/{student_id}",
    "/api/students/{student_id}/room",
    "/api/students/{student_id}/debts",
    "/api/students/{student_id}/transactions",
    "/api/students/{student_id}/access-logs",
    "/api/students/{student_id}/wallet/topup",
    "/api/admin/bills",
    "/api/admin/bills/{bill_id}/meters",
    "/api/admin/audit-logs",
    "/api/admin/rooms",
    "/api/admin/assignments",
    "/api/admin/assignments/{assignment_id}",
    "/api/admin/dashboard",
    "/api/admin/access-logs",
    "/api/admin/benchmark",
    "/api/admin/ai/reindex",
    "/api/payments",
    "/api/ai/semantic-search",
    "/api/ai/forecast",
    "/api/ai/clusters",
]


def test_openapi_schema_contains_all_endpoints():
    schema = app.openapi()
    assert schema["info"]["title"] == "Smart Dormitory & Utility Billing API"
    paths = schema["paths"]

    for req_path in REQUIRED_PATHS:
        assert req_path in paths, f"Missing endpoint in OpenAPI schema: {req_path}"

    # Export schema to docs/api/openapi.json
    docs_api_dir = Path(__file__).resolve().parent.parent.parent / "docs" / "api"
    docs_api_dir.mkdir(parents=True, exist_ok=True)
    out_file = docs_api_dir / "openapi.json"
    out_file.write_text(
        json.dumps(schema, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    assert out_file.exists()
    assert out_file.stat().st_size > 1000

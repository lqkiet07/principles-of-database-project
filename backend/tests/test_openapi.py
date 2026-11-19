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


def test_openapi_paths_use_typed_schemas():
    schema = app.openapi()
    assert "/api/test-error" not in schema["paths"]
    assert "ApiErrorResponse" in schema["components"]["schemas"]

    for path, methods in schema["paths"].items():
        if not path.startswith("/api/"):
            continue
        for method, spec in methods.items():
            ok_resp = spec["responses"].get("200") or spec["responses"].get("201")
            assert ok_resp is not None
            json_schema = ok_resp["content"]["application/json"]["schema"]
            ref = json_schema.get("$ref", "")
            assert ref, f"Expected schema ref on {method.upper()} {path}"
            assert not ref.endswith(("ApiResponse_dict_", "ApiResponse_list_", "ApiResponse_Any_")), (
                f"Untyped response schema on {method.upper()} {path}: {ref}"
            )

import pytest

from app.errors import (
    SP1_CODE_MAP,
    SP2_CODE_MAP,
    ApiError,
    raise_sp1_error,
    raise_sp2_error,
)
from app.main import app


@pytest.mark.parametrize(
    ("code", "expected_http", "expected_label"),
    [
        (1, 422, "NO_STUDENTS"),
        (2, 409, "BILL_EXISTS"),
        (3, 422, "INVALID_METERS"),
        (99, 500, "SYSTEM_ERROR"),
    ],
)
def test_sp1_code_mapping(code, expected_http, expected_label):
    http_status, label = SP1_CODE_MAP[code]
    assert http_status == expected_http
    assert label == expected_label


@pytest.mark.parametrize(
    ("code", "expected_http", "expected_label"),
    [
        (1, 404, "DEBT_NOT_FOUND"),
        (2, 409, "DEBT_ALREADY_PAID"),
        (3, 422, "AMOUNT_EXCEEDS_DEBT"),
        (4, 422, "INSUFFICIENT_FUNDS"),
        (99, 500, "SYSTEM_ERROR"),
    ],
)
def test_sp2_code_mapping(code, expected_http, expected_label):
    http_status, label = SP2_CODE_MAP[code]
    assert http_status == expected_http
    assert label == expected_label


def test_raise_sp1_error():
    with pytest.raises(ApiError) as exc_info:
        raise_sp1_error(2, "Bill already exists for month")
    err = exc_info.value
    assert err.http_status == 409
    assert err.error_code == "BILL_EXISTS"
    assert err.status_code == 2
    assert "Bill already exists" in err.message


def test_raise_sp2_error():
    with pytest.raises(ApiError) as exc_info:
        raise_sp2_error(4, "Ví không đủ tiền")
    err = exc_info.value
    assert err.http_status == 422
    assert err.error_code == "INSUFFICIENT_FUNDS"
    assert err.status_code == 4


@pytest.mark.asyncio
async def test_api_error_response_envelope(client):
    assert "/api/test-error" not in app.openapi()["paths"]

    # 1. Trigger 404 STUDENT_NOT_FOUND
    response = await client.get("/api/students/UNKNOWN_ID")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["status_code"] is None
    assert body["error_code"] == "STUDENT_NOT_FOUND"
    assert body["data"] is None

    # 2. Trigger SP1 status_code=3 (INVALID_METERS)
    sp_res = await client.post(
        "/api/admin/bills",
        json={
            "room_id": 1,
            "month_year": "2026-11",
            "prev_electric": 300,
            "curr_electric": 100,
            "prev_water": 10,
            "curr_water": 20,
        },
        headers={"X-Role": "admin"},
    )
    assert sp_res.status_code == 422
    sp_body = sp_res.json()
    assert sp_body["success"] is False
    assert sp_body["status_code"] == 3
    assert sp_body["error_code"] == "INVALID_METERS"
    assert sp_body["data"] is None

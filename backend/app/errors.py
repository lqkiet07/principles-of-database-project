from typing import Any


class ApiError(Exception):
    def __init__(
        self,
        http_status: int,
        error_code: str,
        message: str,
        status_code: int | None = None,
        data: Any = None,
    ) -> None:
        super().__init__(message)
        self.http_status = http_status
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.data = data


SP1_CODE_MAP: dict[int, tuple[int, str]] = {
    1: (422, "NO_STUDENTS"),
    2: (409, "BILL_EXISTS"),
    3: (422, "INVALID_METERS"),
    99: (500, "SYSTEM_ERROR"),
}

SP2_CODE_MAP: dict[int, tuple[int, str]] = {
    1: (404, "DEBT_NOT_FOUND"),
    2: (409, "DEBT_ALREADY_PAID"),
    3: (422, "AMOUNT_EXCEEDS_DEBT"),
    4: (422, "INSUFFICIENT_FUNDS"),
    99: (500, "SYSTEM_ERROR"),
}


def raise_sp1_error(code: int, message: str) -> None:
    http_status, label = SP1_CODE_MAP.get(code, (500, "SYSTEM_ERROR"))
    raise ApiError(
        http_status=http_status,
        error_code=label,
        message=message,
        status_code=code,
    )


def raise_sp2_error(code: int, message: str) -> None:
    http_status, label = SP2_CODE_MAP.get(code, (500, "SYSTEM_ERROR"))
    raise ApiError(
        http_status=http_status,
        error_code=label,
        message=message,
        status_code=code,
    )

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(from_attributes=True)
    success: bool = True
    status_code: int = 0
    error_code: str | None = None
    message: str = "Thành công"
    data: T | None = None


class ApiErrorResponse(BaseModel):
    success: bool = False
    status_code: int | None = None
    error_code: str
    message: str
    data: Any = None

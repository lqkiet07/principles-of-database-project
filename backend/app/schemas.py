from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

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


class TopupIn(BaseModel):
    amount: float = Field(..., gt=0, le=10_000_000)


class TopupOut(BaseModel):
    student_id: str
    amount_added: float
    new_balance: float

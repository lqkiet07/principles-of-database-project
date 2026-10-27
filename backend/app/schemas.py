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


class GenerateBillIn(BaseModel):
    room_id: int = Field(..., ge=1)
    month_year: str = Field(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    prev_electric: int = Field(..., ge=0)
    curr_electric: int = Field(..., ge=0)
    prev_water: int = Field(..., ge=0)
    curr_water: int = Field(..., ge=0)


class DebtItem(BaseModel):
    debt_id: int
    student_id: str
    assigned_amount: float
    paid_amount: float
    debt_status: str


class GenerateBillOut(BaseModel):
    bill_id: int
    room_id: int
    month_year: str
    total_amount: float
    split_amount: float
    student_count: int
    status_code: int
    message: str
    debts: list[DebtItem]


class PaymentIn(BaseModel):
    student_id: str
    debt_id: int = Field(..., ge=1)
    amount: float = Field(..., gt=0)


class PaymentOut(BaseModel):
    status_code: int
    tx_code: str
    student_id: str
    debt_id: int
    amount_paid: float
    remaining_balance: float
    remaining_debt: float
    message: str

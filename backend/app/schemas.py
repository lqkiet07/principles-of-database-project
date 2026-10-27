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


class AssignmentIn(BaseModel):
    room_id: int = Field(..., ge=1)
    student_id: str
    bed_number: int = Field(..., ge=1)
    start_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class AssignmentOut(BaseModel):
    assignment_id: int
    room_id: int
    student_id: str
    bed_number: int
    start_date: str
    end_date: str | None = None
    is_active: bool


class DashboardSummaryOut(BaseModel):
    total_buildings: int
    total_rooms: int
    total_capacity: int
    total_occupancy: int
    occupancy_rate: float
    total_students: int
    total_unpaid_debt: float
    total_power_kwh: float


class MeterUpdateIn(BaseModel):
    curr_electric: int = Field(..., ge=0)
    curr_water: int = Field(..., ge=0)


class MeterUpdateOut(BaseModel):
    bill_id: int
    room_id: int
    month_year: str
    prev_electric: int
    curr_electric: int
    prev_water: int
    curr_water: int
    total_amount: float
    paid_amount: float
    bill_status: str


class AuditLogItem(BaseModel):
    log_id: int
    table_name: str
    action_type: str
    record_id: str
    changed_by: str
    changed_at: str
    reason: str | None = None
    old_data: dict[str, Any] | None = None
    new_data: dict[str, Any] | None = None


class BenchmarkOut(BaseModel):
    mode: str
    execution_time_ms: float
    planning_time_ms: float
    node_type: str
    shared_hit_blocks: int
    shared_read_blocks: int
    total_buffers: int
    rows_returned: int
    plan: dict[str, Any]

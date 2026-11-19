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


class StudentWalletOut(BaseModel):
    balance: float
    updated_at: str | None = None


class StudentProfileOut(BaseModel):
    student_id: str
    full_name: str
    email: str
    phone: str | None = None
    major: str | None = None
    status: str
    wallet: StudentWalletOut


class RoommateOut(BaseModel):
    student_id: str
    full_name: str
    major: str | None = None
    bed_number: int
    phone: str | None = None


class StudentRoomOut(BaseModel):
    assignment_id: int
    room_id: int
    room_number: str
    building_id: str
    building_name: str
    gender_zone: str
    bed_number: int
    capacity: int
    current_occupancy: int
    base_price: float
    description: str | None = None
    start_date: str
    end_date: str | None = None
    roommates: list[RoommateOut]


class StudentDebtOut(BaseModel):
    debt_id: int
    bill_id: int
    student_id: str
    room_id: int
    month_year: str
    room_number: str
    bill_total_amount: float
    total_room_bill: float
    assigned_amount: float
    paid_amount: float
    remaining_amount: float
    debt_status: str
    bill_status: str
    prev_electric: int
    curr_electric: int
    prev_water: int
    curr_water: int


class TransactionOut(BaseModel):
    tx_id: int
    debt_id: int | None = None
    bill_id: int | None = None
    amount: float
    tx_time: str
    reference_code: str
    status: str


class AccessLogItemOut(BaseModel):
    log_id: int
    gate_name: str
    check_time: str
    is_late: bool


class StudentAccessLogsOut(BaseModel):
    total: int
    late_count: int
    items: list[AccessLogItemOut]


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


class CheckoutOut(BaseModel):
    assignment_id: int
    is_active: bool
    end_date: str


class RoomOccupantOut(BaseModel):
    assignment_id: int
    student_id: str
    full_name: str
    major: str | None = None
    bed_number: int
    start_date: str
    end_date: str | None = None


class RoomOut(BaseModel):
    room_id: int
    room_number: str
    building_id: str
    building_name: str
    gender_zone: str
    capacity: int
    current_occupancy: int
    base_price: float
    status: str
    description: str | None = None
    occupants: list[RoomOccupantOut]


class SemanticRoomOut(BaseModel):
    room_id: int
    room_number: str
    building_id: str
    building_name: str
    gender_zone: str
    capacity: int
    current_occupancy: int
    base_price: float
    description: str | None = None
    status: str
    cosine_distance: float
    similarity: float


class AdminBillOut(BaseModel):
    bill_id: int
    room_id: int
    room_number: str
    building_id: str
    building_name: str
    occupants: int
    month_year: str
    prev_electric: int
    curr_electric: int
    prev_water: int
    curr_water: int
    total_amount: float
    paid_amount: float
    bill_status: str
    created_at: str | None = None


class AdminStudentOut(BaseModel):
    student_id: str
    full_name: str
    gender: str
    email: str
    phone: str | None = None
    major: str | None = None
    cohort: int
    status: str
    wallet_balance: float
    assignment_id: int | None = None
    room_id: int | None = None
    room_number: str | None = None
    building_id: str | None = None
    bed_number: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    unpaid_debt: float
    late_count: int


class AdminAssignmentOut(BaseModel):
    assignment_id: int
    room_id: int
    room_number: str
    building_id: str
    building_name: str
    base_price: float
    capacity: int
    current_occupancy: int
    student_id: str
    full_name: str
    major: str | None = None
    phone: str | None = None
    bed_number: int
    start_date: str
    end_date: str | None = None
    is_active: bool


class DemoResetOut(BaseModel):
    reset_month: str
    cp4_student_id: str
    cp4_debt_id: int | None = None
    cp4_assigned_amount: float


class AdminAccessLogItemOut(BaseModel):
    log_id: int
    student_id: str
    student_name: str
    gate_name: str
    check_time: str
    is_late: bool


class AdminAccessLogsOut(BaseModel):
    total: int
    late_count: int
    items: list[AdminAccessLogItemOut]


class ReindexOut(BaseModel):
    reindexed_count: int


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


class ForecastHistoryPoint(BaseModel):
    month_year: str
    actual_kwh: float
    total_bill: float


class ForecastFuturePoint(BaseModel):
    month_year: str
    predicted_kwh: float


class ForecastOut(BaseModel):
    building_id: str
    building_name: str
    model_name: str
    mae: float
    history: list[ForecastHistoryPoint]
    predictions: list[ForecastFuturePoint]


class ClusterSummaryItem(BaseModel):
    cluster_id: int
    label: str
    label_vi: str
    description: str
    student_count: int
    avg_late_count: float
    avg_unpaid_ratio: float
    avg_power_kwh: float


class ClusterStudentPoint(BaseModel):
    student_id: str
    full_name: str
    room_number: str
    late_count: int
    unpaid_ratio: float
    avg_power_kwh: float
    cluster_id: int
    cluster_label: str
    pca_x: float
    pca_y: float


class ClusterAnalysisOut(BaseModel):
    total_students: int
    clusters: list[ClusterSummaryItem]
    points: list[ClusterStudentPoint]

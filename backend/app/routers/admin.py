from fastapi import APIRouter, Depends, Query, status

from app.schemas import (
    ApiResponse,
    AssignmentIn,
    AssignmentOut,
    AuditLogItem,
    DashboardSummaryOut,
    GenerateBillIn,
    GenerateBillOut,
    MeterUpdateIn,
    MeterUpdateOut,
)
from app.services import admin as admin_service
from app.services import billing as billing_service
from app.services import rooms as room_service
from app.services.security import require_admin_role

router = APIRouter(
    prefix="/api/admin", tags=["Admin"], dependencies=[Depends(require_admin_role)]
)


@router.post(
    "/bills",
    response_model=ApiResponse[GenerateBillOut],
    status_code=status.HTTP_201_CREATED,
)
async def generate_bill(payload: GenerateBillIn):
    data = await billing_service.generate_and_split_bill(payload)
    return ApiResponse(message=data["message"], data=data)


@router.patch("/bills/{bill_id}/meters", response_model=ApiResponse[MeterUpdateOut])
async def patch_bill_meters(bill_id: int, payload: MeterUpdateIn):
    data = await admin_service.update_bill_meters(
        bill_id=bill_id,
        curr_electric=payload.curr_electric,
        curr_water=payload.curr_water,
    )
    return ApiResponse(message="Cập nhật chỉ số công tơ thành công", data=data)


@router.get("/audit-logs", response_model=ApiResponse[list[AuditLogItem]])
async def list_audit_logs(
    record_id: str | None = Query(None),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    data = await admin_service.get_audit_logs(
        record_id=record_id,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset,
    )
    return ApiResponse(data=data)


@router.get("/rooms", response_model=ApiResponse[list])
async def list_rooms(
    building_id: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
):
    data = await room_service.get_rooms_list(
        building_id=building_id, status=status_filter
    )
    return ApiResponse(data=data)


@router.post(
    "/assignments",
    response_model=ApiResponse[AssignmentOut],
    status_code=status.HTTP_201_CREATED,
)
async def create_assignment(payload: AssignmentIn):
    data = await room_service.assign_student(payload)
    return ApiResponse(message="Xếp chỗ lưu trú thành công", data=data)


@router.delete("/assignments/{assignment_id}", response_model=ApiResponse[dict])
async def checkout_assignment(assignment_id: int):
    data = await room_service.unassign_student(assignment_id)
    return ApiResponse(message="Thanh lý hợp đồng lưu trú thành công", data=data)


@router.get("/dashboard", response_model=ApiResponse[DashboardSummaryOut])
async def get_dashboard():
    data = await admin_service.get_dashboard_summary()
    return ApiResponse(data=data)

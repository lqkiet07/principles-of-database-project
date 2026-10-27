from fastapi import APIRouter, Query

from app.schemas import ApiResponse, TopupIn, TopupOut
from app.services import students as student_service
from app.services import wallet as wallet_service

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.post("/{student_id}/wallet/topup", response_model=ApiResponse[TopupOut])
async def topup_wallet(student_id: str, payload: TopupIn):
    data = await wallet_service.topup_student_wallet(student_id, payload.amount)
    return ApiResponse(message="Nạp tiền vào ví thành công", data=data)


@router.get("/{student_id}", response_model=ApiResponse[dict])
async def get_profile(student_id: str):
    data = await student_service.get_student_profile(student_id)
    return ApiResponse(data=data)


@router.get("/{student_id}/room", response_model=ApiResponse[dict])
async def get_room(student_id: str):
    data = await student_service.get_student_room(student_id)
    return ApiResponse(data=data)


@router.get("/{student_id}/debts", response_model=ApiResponse[list])
async def get_debts(student_id: str):
    data = await student_service.get_student_debts(student_id)
    return ApiResponse(data=data)


@router.get("/{student_id}/transactions", response_model=ApiResponse[list])
async def get_transactions(student_id: str):
    data = await student_service.get_student_transactions(student_id)
    return ApiResponse(data=data)


@router.get("/{student_id}/access-logs", response_model=ApiResponse[dict])
async def get_access_logs(
    student_id: str,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    late_only: bool = Query(False, alias="late"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    data = await student_service.get_student_access_logs(
        student_id=student_id,
        from_date=from_date,
        to_date=to_date,
        late_only=late_only,
        limit=limit,
        offset=offset,
    )
    return ApiResponse(data=data)

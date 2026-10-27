from fastapi import APIRouter

from app.schemas import ApiResponse, PaymentIn, PaymentOut
from app.services import billing as billing_service

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.post("", response_model=ApiResponse[PaymentOut])
async def pay_debt(payload: PaymentIn):
    data = await billing_service.pay_student_debt(payload)
    return ApiResponse(message=data["message"], data=data)

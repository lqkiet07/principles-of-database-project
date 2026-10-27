from fastapi import APIRouter, Depends, status

from app.schemas import ApiResponse, GenerateBillIn, GenerateBillOut
from app.services import billing as billing_service
from app.services.security import require_admin_role

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post(
    "/bills",
    response_model=ApiResponse[GenerateBillOut],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_role)],
)
async def generate_bill(payload: GenerateBillIn):
    data = await billing_service.generate_and_split_bill(payload)
    return ApiResponse(message=data["message"], data=data)

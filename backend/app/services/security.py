from fastapi import Request

from app.errors import ApiError


async def require_admin_role(request: Request) -> str:
    role = request.headers.get("X-Role", "").strip().lower()
    if role not in ["admin", "evaluator"]:
        raise ApiError(
            http_status=403,
            error_code="FORBIDDEN",
            message="Yêu cầu quyền Quản trị viên (Admin)",
        )
    return role

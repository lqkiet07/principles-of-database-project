from fastapi import APIRouter, Query

from app.ai.semantic_search import search_available_rooms
from app.schemas import ApiResponse

router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.get("/semantic-search", response_model=ApiResponse[list])
async def semantic_search(
    q: str = Query(
        ..., min_length=1, description="Natural language search prompt for rooms"
    ),
    limit: int = Query(5, ge=1, le=20),
):
    data = await search_available_rooms(query=q, limit=limit)
    return ApiResponse(data=data)

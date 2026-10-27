import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.db import close_pool, fetch_all, fetch_one, get_pool
from app.errors import ApiError, raise_sp1_error
from app.routers import admin, ai, payments, students


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Smart Dormitory & Utility Billing API",
    version="1.0.0",
    description="Backend API for Smart Dormitory Management & Utility Billing (CT221H CTU)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(admin.router)
app.include_router(payments.router)
app.include_router(ai.router)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "success": False,
            "status_code": exc.status_code,
            "error_code": exc.error_code,
            "message": exc.message,
            "data": exc.data,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "status_code": 422,
            "error_code": "VALIDATION_ERROR",
            "message": "Dữ liệu yêu cầu không hợp lệ",
            "data": exc.errors(),
        },
    )


@app.get("/api/test-error", tags=["System"])
async def trigger_test_error():
    raise_sp1_error(2, "Hóa đơn đã tồn tại")


@app.get("/health", tags=["System"])
async def health_check():
    ver_row = await fetch_one("SELECT version() AS ver;")
    db_version = ver_row["ver"] if ver_row else "Unknown"

    proc_rows = await fetch_all(
        """
        SELECT proname 
        FROM pg_proc 
        WHERE proname IN ('sp_generate_and_split_utility_bill', 'sp_pay_student_utility_bill');
        """
    )
    procedures = [r["proname"] for r in proc_rows]

    return {"status": "ok", "db_version": db_version, "procedures": procedures}

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import close_pool, fetch_all, fetch_one, get_pool
from app.errors import register_exception_handlers
from app.routers import (
    admin_access,
    admin_bills,
    admin_contracts,
    admin_maintenance,
    admin_overview,
    admin_rooms,
    admin_settings,
    admin_students,
    admin_transfers,
    auth,
    payments_qr,
    student,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Hệ thống Quản lý Ký túc xá CTU API",
    version="2.0.0",
    description="API cho ứng dụng web quản lý ký túc xá Trường Đại học Cần Thơ (Quản lý & Sinh viên).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(admin_overview.router)
app.include_router(admin_rooms.router)
app.include_router(admin_bills.router)
app.include_router(admin_students.router)
app.include_router(admin_contracts.router)
app.include_router(admin_maintenance.router)
app.include_router(admin_transfers.router)
app.include_router(admin_access.router)
app.include_router(admin_settings.router)
app.include_router(payments_qr.router)
app.include_router(student.router)


@app.get("/health", tags=["Hệ thống"])
async def health():
    ver = await fetch_one("SELECT version() AS db_version, current_user AS db_user")
    procs = await fetch_all(
        """
        SELECT proname FROM pg_proc
        WHERE pronamespace = 'public'::regnamespace
          AND proname LIKE %s
        ORDER BY proname
        """,
        ("sp_%",),
    )
    return {
        "status": "ok",
        "db_version": ver["db_version"] if ver else None,
        "db_user": ver["db_user"] if ver else None,
        "procedures": [p["proname"] for p in procs],
    }

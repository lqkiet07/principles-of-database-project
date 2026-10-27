import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import close_pool, fetch_all, fetch_one, get_pool


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

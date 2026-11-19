import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = (
        "postgresql://ktx_app_user:KtxApp%402026@localhost:5432/smart_dormitory_db"
    )
    jwt_secret: str = "ctu-ktx-super-secret-jwt-key-2026-change-in-production"
    session_timeout_minutes: int = 30
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()

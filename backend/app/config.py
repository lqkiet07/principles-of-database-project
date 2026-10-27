import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = (
        "postgresql://postgres:postgres123@localhost:5432/smart_dormitory_db"
    )
    test_database_url: str = (
        "postgresql://postgres:postgres123@localhost:5432/smart_dormitory_test"
    )
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"
    ai_device: str = "cpu"
    ai_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()

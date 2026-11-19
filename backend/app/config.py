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
    demo_reset_enabled: bool = True
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    benchmark_from_time: str = "2026-09-01 00:00:00"
    benchmark_to_time: str = "2026-10-01 23:59:59"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()

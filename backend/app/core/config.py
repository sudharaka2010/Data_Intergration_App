from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    app_name: str = "DATAC API"
    app_version: str = "1.0.0"
    api_v1_prefix: str = "/api/v1"
    debug: bool = True

    postgres_db: str = "datac_db"
    postgres_user: str = "datac_user"
    postgres_password: str = "datac_password"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    database_url: str | None = None

    seed_admin_username: str = "admin"
    seed_admin_email: str = "admin@datac.io"
    seed_admin_password: str = "datac123"
    seed_admin_full_name: str = "DATAC Administrator"

    storage_directory: Path = BACKEND_DIR / "storage" / "uploads"
    frontend_directory: Path = PROJECT_ROOT / "frontend"

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            return self.database_url

        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def frontend_index_file(self) -> Path:
        return self.frontend_directory / "index.html"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

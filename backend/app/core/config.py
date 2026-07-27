from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EditFlow API"
    app_version: str = "0.1.0"
    environment: str = "development"

    database_url: str = "sqlite:///./editflow.db"
    frontend_origin: str = "http://localhost:5173"

    youtube_api_key: str | None = None
    pexels_api_key: str | None = None
    external_api_timeout_seconds: float = 10
    external_api_cache_ttl_seconds: int = 300
    external_api_cache_max_entries: int = 256
    youtube_default_max_results: int = 12
    youtube_max_results_limit: int = 25
    pexels_default_per_page: int = 12
    pexels_max_per_page: int = 40

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

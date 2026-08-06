from functools import lru_cache

from pydantic import Field
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

    llm_provider: str = "openai"
    llm_model: str = "gpt-5.6-luna"
    llm_api_key: str | None = None
    llm_connect_timeout_seconds: float = Field(default=5, gt=0)
    llm_timeout_seconds: float = Field(default=25, gt=0)
    llm_max_recommendations: int = Field(default=8, ge=1, le=8)
    llm_default_recommendations: int = Field(default=5, ge=1, le=8)
    llm_max_output_tokens: int = Field(default=3000, ge=256)
    llm_prompt_version: str = "v1"
    llm_recommendation_signing_secret: str | None = None
    llm_recommendation_token_ttl_seconds: int = Field(default=900, ge=1)
    llm_rate_limit_requests: int = Field(default=5, ge=1)
    llm_rate_limit_window_seconds: int = Field(default=60, ge=1)
    llm_live_calls_enabled: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

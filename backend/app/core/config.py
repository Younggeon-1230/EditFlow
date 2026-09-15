from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    app_name: str = "EditFlow API"
    app_version: str = "0.1.0"
    environment: str = "development"

    database_url: str = "sqlite:///./editflow.db"
    frontend_origins: Annotated[list[str], NoDecode] = [
        "http://127.0.0.1:5173"
    ]

    auth_session_cookie_name: str = "editflow_session"
    auth_csrf_cookie_name: str = "editflow_csrf"
    auth_csrf_header_name: str = "X-CSRF-Token"
    auth_session_ttl_seconds: int = Field(default=604800, ge=1)
    auth_cookie_secure: bool = False
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_password_min_length: int = Field(default=12, ge=1)
    auth_password_max_length: int = Field(default=128, ge=1)
    auth_login_rate_limit_requests: int = Field(default=5, ge=1)
    auth_login_rate_limit_window_seconds: int = Field(default=60, ge=1)
    auth_signup_rate_limit_requests: int = Field(default=3, ge=1)
    auth_signup_rate_limit_window_seconds: int = Field(default=600, ge=1)

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
    llm_prompt_version: str = "v2"
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

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def parse_frontend_origins(cls, value: object) -> object:
        if isinstance(value, str):
            origins = [origin.strip().rstrip("/") for origin in value.split(",")]
        else:
            origins = value
        if not isinstance(origins, list) or not origins:
            raise ValueError("FRONTEND_ORIGINS must contain at least one origin")
        if any(not origin or origin == "*" for origin in origins):
            raise ValueError("FRONTEND_ORIGINS cannot contain empty or wildcard origins")
        return origins

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        try:
            url = make_url(value)
        except ArgumentError as error:
            raise ValueError("DATABASE_URL must be a valid SQLAlchemy URL") from error
        backend = url.get_backend_name()
        if backend not in {"sqlite", "postgresql"}:
            raise ValueError("DATABASE_URL must use SQLite or PostgreSQL")
        if backend == "postgresql" and url.get_driver_name() != "psycopg":
            raise ValueError("PostgreSQL DATABASE_URL must use postgresql+psycopg")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()

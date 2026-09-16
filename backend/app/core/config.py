from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    app_name: str = "EditFlow API"
    app_version: str = "0.1.0"
    environment: Literal["development", "test", "production"] = "development"

    database_url: str = "sqlite:///./editflow.db"
    frontend_origins: Annotated[list[str], NoDecode] = [
        "http://127.0.0.1:5173"
    ]
    trusted_hosts: Annotated[list[str], NoDecode] = [
        "127.0.0.1",
        "localhost",
        "testserver",
    ]

    db_pool_size: int = Field(default=5, ge=1)
    db_max_overflow: int = Field(default=5, ge=0)
    db_pool_timeout_seconds: float = Field(default=30, gt=0)
    db_pool_recycle_seconds: int = Field(default=1800, ge=0)

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
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.path not in {"", "/"}
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
            ):
                raise ValueError("FRONTEND_ORIGINS must contain exact HTTP(S) origins")
        return origins

    @field_validator("trusted_hosts", mode="before")
    @classmethod
    def parse_trusted_hosts(cls, value: object) -> object:
        hosts = (
            [item.strip() for item in value.split(",")]
            if isinstance(value, str)
            else value
        )
        if not isinstance(hosts, list) or not hosts:
            raise ValueError("TRUSTED_HOSTS must contain at least one host")
        if any(
            not host
            or host == "*"
            or "://" in host
            or "/" in host
            for host in hosts
        ):
            raise ValueError("TRUSTED_HOSTS must contain exact host names")
        return hosts

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

    @field_validator(
        "youtube_api_key",
        "pexels_api_key",
        "llm_api_key",
        "llm_recommendation_signing_secret",
        mode="before",
    )
    @classmethod
    def normalize_optional_secret(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @model_validator(mode="after")
    def validate_environment_policy(self) -> "Settings":
        if self.environment != "production":
            return self

        database = make_url(self.database_url)
        if database.get_backend_name() != "postgresql":
            raise ValueError("Production DATABASE_URL must use PostgreSQL")
        if not all(
            (
                database.username,
                database.password,
                database.host,
                database.database,
            )
        ):
            raise ValueError("Production DATABASE_URL must include complete credentials")
        if database.host.casefold() in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("Production DATABASE_URL cannot use a loopback host")
        if database.password.casefold() in {
            "password",
            "changeme",
            "secret",
            "editflow-local-only",
        }:
            raise ValueError("Production DATABASE_URL contains a placeholder password")
        if not self.auth_cookie_secure:
            raise ValueError("Production requires AUTH_COOKIE_SECURE=true")
        if self.auth_cookie_samesite != "lax":
            raise ValueError("Production requires AUTH_COOKIE_SAMESITE=lax")

        origin_hosts: set[str] = set()
        for origin in self.frontend_origins:
            parsed = urlsplit(origin)
            assert parsed.hostname is not None
            if parsed.scheme != "https":
                raise ValueError("Production FRONTEND_ORIGINS must use HTTPS")
            if parsed.hostname.casefold() in {"localhost", "127.0.0.1", "::1"}:
                raise ValueError("Production FRONTEND_ORIGINS cannot use localhost")
            origin_hosts.add(parsed.hostname.casefold())
        trusted_hosts = {host.casefold() for host in self.trusted_hosts}
        if trusted_hosts & {"localhost", "127.0.0.1", "testserver", "::1"}:
            raise ValueError("Production TRUSTED_HOSTS cannot include local hosts")
        if not origin_hosts <= trusted_hosts:
            raise ValueError("Production frontend hosts must be trusted hosts")

        if self.llm_live_calls_enabled:
            if not self.llm_api_key:
                raise ValueError("LLM_API_KEY is required when live calls are enabled")
            secret = self.llm_recommendation_signing_secret
            if not secret or len(secret.encode("utf-8")) < 32:
                raise ValueError(
                    "LLM_RECOMMENDATION_SIGNING_SECRET must be at least 32 bytes"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

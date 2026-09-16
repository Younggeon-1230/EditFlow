from datetime import timedelta
from uuid import UUID

import pytest
from fastapi import Response
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.core.database import build_engine_options, get_session
from app.core.datetime import utc_now
from app.main import app
from app.models.auth_session import AuthSession
from app.models.user import User
from app.services.auth import AuthResult, AuthTokens, token_digest
from app.services.auth_cookies import clear_auth_cookies, set_auth_cookies


def production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "environment": "production",
        "database_url": (
            "postgresql+psycopg://editflow:strong-production-db-value"
            "@db.example.com/editflow"
        ),
        "frontend_origins": "https://app.example.com",
        "trusted_hosts": "app.example.com",
        "auth_cookie_secure": True,
        "auth_cookie_samesite": "lax",
        "llm_live_calls_enabled": False,
    }
    values.update(overrides)
    return Settings(**values)


def test_valid_production_settings_keep_external_providers_optional() -> None:
    settings = production_settings()

    assert settings.environment == "production"
    assert settings.youtube_api_key is None
    assert settings.pexels_api_key is None
    assert settings.llm_api_key is None
    assert settings.llm_recommendation_signing_secret is None


@pytest.mark.parametrize(
    ("override", "value"),
    [
        ("database_url", "sqlite:///production.db"),
        (
            "database_url",
            "postgresql+psycopg://editflow:strong-value@localhost/editflow",
        ),
        (
            "database_url",
            "postgresql+psycopg://editflow:changeme@db.example.com/editflow",
        ),
        ("auth_cookie_secure", False),
        ("auth_cookie_samesite", "none"),
        ("frontend_origins", "http://app.example.com"),
        ("frontend_origins", "https://localhost"),
        ("trusted_hosts", "localhost"),
        ("trusted_hosts", "api.example.com"),
    ],
)
def test_production_rejects_unsafe_configuration(
    override: str,
    value: object,
) -> None:
    with pytest.raises(ValidationError):
        production_settings(**{override: value})


@pytest.mark.parametrize(
    "environment",
    ["staging", "prod", "local"],
)
def test_environment_rejects_unsupported_names(environment: str) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment=environment)


@pytest.mark.parametrize(
    "origin",
    [
        "https://app.example.com/path",
        "https://app.example.com?debug=true",
        "https://user@app.example.com",
        "*",
    ],
)
def test_frontend_origins_require_exact_origins(origin: str) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, frontend_origins=origin)


def test_live_ai_requires_key_and_strong_signing_secret_in_production() -> None:
    with pytest.raises(ValidationError):
        production_settings(llm_live_calls_enabled=True)
    with pytest.raises(ValidationError):
        production_settings(
            llm_live_calls_enabled=True,
            llm_api_key="provider-key",
            llm_recommendation_signing_secret="too-short",
        )

    settings = production_settings(
        llm_live_calls_enabled=True,
        llm_api_key="provider-key",
        llm_recommendation_signing_secret="x" * 32,
    )
    assert settings.llm_live_calls_enabled is True


def test_production_pool_options_are_explicit_and_sqlite_is_unchanged() -> None:
    postgres_options = build_engine_options(
        "postgresql+psycopg://user:value@db.example.com/editflow",
        "production",
        pool_size=3,
        max_overflow=2,
        pool_timeout=12,
        pool_recycle=900,
    )
    sqlite_options = build_engine_options(
        "sqlite:///test.db",
        "production",
        pool_size=3,
        max_overflow=2,
        pool_timeout=12,
        pool_recycle=900,
    )

    assert postgres_options == {
        "echo": False,
        "hide_parameters": True,
        "pool_pre_ping": True,
        "pool_size": 3,
        "max_overflow": 2,
        "pool_timeout": 12,
        "pool_recycle": 900,
    }
    assert sqlite_options == {
        "echo": False,
        "hide_parameters": True,
        "connect_args": {"check_same_thread": False},
    }


def test_production_auth_cookie_set_and_clear_attributes_match() -> None:
    settings = production_settings()
    created_at = utc_now()
    result = AuthResult(
        user=User(id=1, email="cookie@example.com"),
        auth_session=AuthSession(
            id=1,
            user_id=1,
            token_digest=token_digest("session-value"),
            csrf_token_digest=token_digest("csrf-value"),
            created_at=created_at,
            expires_at=created_at
            + timedelta(seconds=settings.auth_session_ttl_seconds),
        ),
        tokens=AuthTokens(
            session_token="session-value",
            csrf_token="csrf-value",
        ),
    )

    set_response = Response()
    set_auth_cookies(set_response, result, settings)
    set_headers = set_response.headers.getlist("set-cookie")

    assert len(set_headers) == 2
    assert all("Secure" in header for header in set_headers)
    assert all("SameSite=lax" in header for header in set_headers)
    assert all("Path=/" in header for header in set_headers)
    assert all("Domain=" not in header for header in set_headers)
    assert all("Max-Age=604800" in header for header in set_headers)
    session_header = next(
        header
        for header in set_headers
        if header.startswith(f"{settings.auth_session_cookie_name}=")
    )
    csrf_header = next(
        header
        for header in set_headers
        if header.startswith(f"{settings.auth_csrf_cookie_name}=")
    )
    assert "HttpOnly" in session_header
    assert "HttpOnly" not in csrf_header

    clear_response = Response()
    clear_auth_cookies(clear_response, settings)
    clear_headers = clear_response.headers.getlist("set-cookie")

    assert len(clear_headers) == 2
    assert all("Secure" in header for header in clear_headers)
    assert all("SameSite=lax" in header for header in clear_headers)
    assert all("Path=/" in header for header in clear_headers)
    assert all("Domain=" not in header for header in clear_headers)
    assert all("Max-Age=0" in header for header in clear_headers)


def test_health_endpoints_are_minimal_and_ready(raw_client) -> None:
    for path in ("/health", "/health/live", "/health/ready"):
        response = raw_client.get(path)
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_readiness_fails_closed_without_affecting_liveness(raw_client) -> None:
    original_override = app.dependency_overrides[get_session]

    class UnavailableSession:
        def exec(self, _statement: object) -> None:
            raise OperationalError(
                "SELECT 1",
                {},
                Exception("sensitive-internal-detail"),
            )

    def get_unavailable_session():
        yield UnavailableSession()

    app.dependency_overrides[get_session] = get_unavailable_session
    try:
        readiness = raw_client.get("/health/ready")
        liveness = raw_client.get("/health/live")
    finally:
        app.dependency_overrides[get_session] = original_override

    assert readiness.status_code == 503
    assert readiness.json() == {"status": "unavailable"}
    assert "sensitive-internal-detail" not in readiness.text
    assert liveness.status_code == 200
    assert liveness.json() == {"status": "ok"}


def test_request_id_is_server_generated(raw_client) -> None:
    response = raw_client.get(
        "/health/live",
        headers={"X-Request-ID": "attacker-controlled"},
    )

    request_id = response.headers["X-Request-ID"]
    assert request_id != "attacker-controlled"
    assert str(UUID(request_id)) == request_id


def test_unexpected_errors_are_sanitized_and_correlated() -> None:
    path = "/_test/unexpected-production-security-error"
    if not any(getattr(route, "path", None) == path for route in app.routes):

        @app.get(path)
        def raise_unexpected_error() -> None:
            raise RuntimeError("secret-do-not-expose")

    test_client = TestClient(app, raise_server_exceptions=False)
    try:
        response = test_client.get(path)
    finally:
        test_client.close()

    assert response.status_code == 500
    assert "secret-do-not-expose" not in response.text
    detail = response.json()["detail"]
    assert detail["code"] == "internal_server_error"
    assert detail["message"] == "An unexpected error occurred."
    assert detail["request_id"] == response.headers["X-Request-ID"]


def test_trusted_host_middleware_rejects_unknown_hosts(raw_client) -> None:
    response = raw_client.get("/health/live", headers={"Host": "evil.example"})

    assert response.status_code == 400

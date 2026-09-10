import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import Settings
from app.models.auth_session import AuthSession


ORIGIN = "http://127.0.0.1:5173"
PASSWORD = "correct horse battery staple"


def test_frontend_origins_parse_csv_and_reject_wildcard() -> None:
    settings = Settings(
        _env_file=None,
        frontend_origins=f"{ORIGIN},http://127.0.0.1:5174",
    )
    assert settings.frontend_origins == [ORIGIN, "http://127.0.0.1:5174"]

    with pytest.raises(ValueError):
        Settings(_env_file=None, frontend_origins="*")


def _bootstrap(client: TestClient) -> str:
    response = client.get("/api/auth/csrf")
    assert response.status_code == 204
    token = client.cookies.get("editflow_csrf")
    assert token is not None
    return token


def _csrf_headers(token: str, **extra: str) -> dict[str, str]:
    return {"Origin": ORIGIN, "X-CSRF-Token": token, **extra}


def _signup(client: TestClient, token: str, email: str = "person@example.com"):
    return client.post(
        "/api/auth/signup",
        json={"email": email, "password": PASSWORD},
        headers=_csrf_headers(token),
    )


def test_csrf_bootstrap_sets_only_readable_csrf_cookie(raw_client: TestClient) -> None:
    response = raw_client.get("/api/auth/csrf")

    assert response.status_code == 204
    assert response.content == b""
    headers = response.headers.get_list("set-cookie")
    assert len(headers) == 1
    assert headers[0].startswith("editflow_csrf=")
    assert "HttpOnly" not in headers[0]
    assert "SameSite=lax" in headers[0]
    assert "Path=/" in headers[0]
    assert "Max-Age=604800" in headers[0]
    assert "Secure" not in headers[0]
    assert raw_client.cookies.get("editflow_session") is None


@pytest.mark.parametrize(
    "case",
    ["neither", "cookie_only", "header_only", "mismatch"],
)
def test_signup_rejects_missing_or_mismatched_csrf(
    raw_client: TestClient,
    case: str,
) -> None:
    token = _bootstrap(raw_client)
    headers = {"Origin": ORIGIN}
    if case in {"header_only", "mismatch"}:
        headers["X-CSRF-Token"] = token
    if case in {"neither", "header_only"}:
        raw_client.cookies.delete("editflow_csrf")
    if case == "mismatch":
        raw_client.cookies.set("editflow_csrf", "a-different-token")

    response = raw_client.post(
        "/api/auth/signup",
        json={"email": "person@example.com", "password": PASSWORD},
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] in {"csrf_required", "csrf_invalid"}


@pytest.mark.parametrize(
    ("headers", "expected_code"),
    [
        ({"Origin": "http://evil.example"}, "csrf_origin_invalid"),
        ({"Referer": "http://evil.example/form"}, "csrf_origin_invalid"),
        ({"Referer": "not a url"}, "csrf_origin_invalid"),
        ({}, "csrf_origin_invalid"),
    ],
)
def test_signup_rejects_untrusted_or_missing_request_origin(
    raw_client: TestClient,
    headers: dict[str, str],
    expected_code: str,
) -> None:
    token = _bootstrap(raw_client)
    response = raw_client.post(
        "/api/auth/signup",
        json={"email": "person@example.com", "password": PASSWORD},
        headers={"X-CSRF-Token": token, **headers},
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == expected_code


def test_allowed_referer_fallback_and_safe_me_request(raw_client: TestClient) -> None:
    token = _bootstrap(raw_client)
    signup = raw_client.post(
        "/api/auth/signup",
        json={"email": "person@example.com", "password": PASSWORD},
        headers={
            "Referer": f"{ORIGIN}/signup?returnTo=%2Fprojects",
            "X-CSRF-Token": token,
        },
    )

    assert signup.status_code == 201
    assert raw_client.get("/api/auth/me").status_code == 200


def test_session_creation_rotates_and_binds_csrf_digest(
    raw_client: TestClient,
    test_engine,
) -> None:
    pre_auth_token = _bootstrap(raw_client)
    assert _signup(raw_client, pre_auth_token).status_code == 201
    session_token = raw_client.cookies.get("editflow_session")
    session_csrf_token = raw_client.cookies.get("editflow_csrf")

    assert session_csrf_token != pre_auth_token
    with Session(test_engine) as session:
        row = session.exec(
            select(AuthSession).where(
                AuthSession.token_digest
                == hashlib.sha256(session_token.encode()).hexdigest()
            )
        ).one()
        assert row.csrf_token_digest == hashlib.sha256(
            session_csrf_token.encode()
        ).hexdigest()
        assert row.csrf_token_digest != session_csrf_token

    raw_client.cookies.set("editflow_csrf", pre_auth_token)
    rejected = raw_client.post(
        "/api/auth/logout",
        headers=_csrf_headers(pre_auth_token),
    )
    assert rejected.status_code == 403
    assert rejected.json()["detail"]["code"] == "csrf_invalid"


def test_csrf_from_one_session_cannot_be_used_with_another(
    raw_client: TestClient,
) -> None:
    bootstrap_token = _bootstrap(raw_client)
    assert _signup(raw_client, bootstrap_token).status_code == 201
    first_csrf = raw_client.cookies.get("editflow_csrf")

    login = raw_client.post(
        "/api/auth/login",
        json={"email": "person@example.com", "password": PASSWORD},
        headers=_csrf_headers(first_csrf),
    )
    assert login.status_code == 200
    second_session = raw_client.cookies.get("editflow_session")
    second_csrf = raw_client.cookies.get("editflow_csrf")
    assert second_csrf != first_csrf

    raw_client.cookies.set("editflow_session", second_session)
    raw_client.cookies.set("editflow_csrf", first_csrf)
    response = raw_client.post(
        "/api/auth/logout",
        headers=_csrf_headers(first_csrf),
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "csrf_invalid"


def test_logout_requires_csrf_only_for_an_active_session(
    raw_client: TestClient,
) -> None:
    raw_client.cookies.set(
        "editflow_session",
        "invalid-session-token",
        domain="testserver.local",
        path="/",
    )
    assert raw_client.post("/api/auth/logout").status_code == 204

    token = _bootstrap(raw_client)
    assert _signup(raw_client, token).status_code == 201
    without_csrf = raw_client.post(
        "/api/auth/logout",
        headers={"Origin": ORIGIN},
    )
    assert without_csrf.status_code == 403
    assert without_csrf.json()["detail"]["code"] == "csrf_required"

    session_csrf = raw_client.cookies.get("editflow_csrf")
    valid = raw_client.post(
        "/api/auth/logout",
        headers=_csrf_headers(session_csrf),
    )
    assert valid.status_code == 204
    assert raw_client.cookies.get("editflow_session") is None
    assert raw_client.cookies.get("editflow_csrf") is None


def test_authenticated_bootstrap_rotates_bound_token(
    raw_client: TestClient,
    test_engine,
) -> None:
    token = _bootstrap(raw_client)
    assert _signup(raw_client, token).status_code == 201
    old_token = raw_client.cookies.get("editflow_csrf")

    assert raw_client.get("/api/auth/csrf").status_code == 204
    new_token = raw_client.cookies.get("editflow_csrf")
    assert new_token != old_token

    with Session(test_engine) as session:
        row = session.exec(select(AuthSession)).one()
        assert row.csrf_token_digest == hashlib.sha256(new_token.encode()).hexdigest()


def test_cors_preflight_allows_only_explicit_credential_origin(
    raw_client: TestClient,
) -> None:
    allowed = raw_client.options(
        "/api/auth/login",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-csrf-token",
        },
    )
    rejected = raw_client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == ORIGIN
    assert allowed.headers["access-control-allow-credentials"] == "true"
    assert "x-csrf-token" in allowed.headers["access-control-allow-headers"].lower()
    assert rejected.status_code == 400
    assert rejected.headers.get("access-control-allow-origin") is None

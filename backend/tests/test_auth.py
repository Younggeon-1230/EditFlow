import hashlib
import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.database import engine
from app.core.datetime import utc_now
from app.models.auth_session import AuthSession
from app.models.user import User
from app.services.auth import lookup_auth_context, token_digest
from app.services.passwords import hash_password, verify_password
from app.services.users import DEVELOPMENT_USER_EMAIL


VALID_PASSWORD = "correct horse battery staple"
OTHER_PASSWORD = "different horse battery staple"


def test_database_engine_hides_bound_parameters_from_sql_logs() -> None:
    assert engine.hide_parameters is True


def _signup(
    anonymous_client: TestClient,
    *,
    email: str = "person@example.com",
    password: str = VALID_PASSWORD,
):
    return anonymous_client.post(
        "/api/auth/signup",
        json={"email": email, "password": password},
    )


def test_signup_creates_normalized_active_user_session_and_secure_cookies(
    anonymous_client: TestClient,
    test_engine,
) -> None:
    response = _signup(anonymous_client, email="  PERSON@Example.COM  ")

    assert response.status_code == 201
    assert set(response.json()) == {"id", "email", "created_at"}
    assert response.json()["email"] == "person@example.com"
    assert "password" not in response.text
    set_cookie_headers = response.headers.get_list("set-cookie")
    session_cookie_header = next(
        value for value in set_cookie_headers if value.startswith("editflow_session=")
    )
    csrf_cookie_header = next(
        value for value in set_cookie_headers if value.startswith("editflow_csrf=")
    )
    assert "HttpOnly" in session_cookie_header
    assert "HttpOnly" not in csrf_cookie_header
    assert "SameSite=lax" in session_cookie_header
    assert "Path=/" in session_cookie_header
    assert "Max-Age=604800" in session_cookie_header
    assert "Secure" not in session_cookie_header

    raw_session_token = anonymous_client.cookies.get("editflow_session")
    raw_csrf_token = anonymous_client.cookies.get("editflow_csrf")
    assert raw_session_token is not None and len(raw_session_token) >= 43
    assert raw_csrf_token is not None and len(raw_csrf_token) >= 43

    with Session(test_engine) as session:
        user = session.exec(
            select(User).where(User.email == "person@example.com")
        ).one()
        auth_session = session.exec(
            select(AuthSession).where(AuthSession.user_id == user.id)
        ).one()
        assert user.is_active is True
        assert user.password_hash is not None
        assert user.password_hash != VALID_PASSWORD
        assert verify_password(user.password_hash, VALID_PASSWORD)
        assert auth_session.token_digest == token_digest(raw_session_token)
        assert auth_session.csrf_token_digest == token_digest(raw_csrf_token)
        assert raw_session_token not in auth_session.token_digest
        assert re.fullmatch(r"[0-9a-f]{64}", auth_session.token_digest)
        assert auth_session.expires_at - auth_session.created_at == timedelta(days=7)

    assert anonymous_client.get("/api/auth/me").status_code == 200


def test_signup_rejects_canonical_duplicate(anonymous_client: TestClient) -> None:
    assert _signup(anonymous_client, email="Owner@Example.com").status_code == 201

    duplicate = _signup(anonymous_client, email=" owner@example.COM ")

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["code"] == "email_already_registered"


@pytest.mark.parametrize(
    ("email", "expected_code"),
    [
        ("not-an-email", "invalid_email"),
        (f"{'a' * 250}@example.com", "invalid_email"),
    ],
)
def test_signup_rejects_invalid_email(
    anonymous_client: TestClient,
    email: str,
    expected_code: str,
) -> None:
    response = _signup(anonymous_client, email=email)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == expected_code


@pytest.mark.parametrize(
    "password",
    ["a" * 11, "a" * 129, " " * 12],
)
def test_signup_rejects_invalid_password(
    anonymous_client: TestClient,
    password: str,
) -> None:
    response = _signup(anonymous_client, password=password)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_password"
    assert password not in response.text


@pytest.mark.parametrize("password", ["a" * 12, "한" * 128])
def test_signup_accepts_password_boundaries(
    anonymous_client: TestClient,
    password: str,
) -> None:
    assert _signup(anonymous_client, password=password).status_code == 201


def test_password_whitespace_is_preserved(anonymous_client: TestClient) -> None:
    password = "  keep these spaces  "
    assert _signup(anonymous_client, password=password).status_code == 201
    assert anonymous_client.post("/api/auth/logout").status_code == 204

    wrong = anonymous_client.post(
        "/api/auth/login",
        json={"email": "person@example.com", "password": password.strip()},
    )
    correct = anonymous_client.post(
        "/api/auth/login",
        json={"email": " PERSON@example.com ", "password": password},
    )

    assert wrong.status_code == 401
    assert correct.status_code == 200


def test_password_helpers_hash_and_verify_without_plaintext_storage() -> None:
    password_hash = hash_password("유니코드 비밀번호는 그대로 유지")

    assert password_hash.startswith("$argon2id$")
    assert "유니코드 비밀번호" not in password_hash
    assert verify_password(password_hash, "유니코드 비밀번호는 그대로 유지")
    assert not verify_password(password_hash, "틀린 유니코드 비밀번호")


def test_login_failure_is_generic_for_wrong_and_unknown_users(
    anonymous_client: TestClient,
) -> None:
    assert _signup(anonymous_client).status_code == 201
    assert anonymous_client.post("/api/auth/logout").status_code == 204

    wrong_password = anonymous_client.post(
        "/api/auth/login",
        json={"email": "person@example.com", "password": OTHER_PASSWORD},
    )
    unknown_user = anonymous_client.post(
        "/api/auth/login",
        json={"email": "unknown@example.com", "password": OTHER_PASSWORD},
    )

    assert wrong_password.status_code == 401
    assert unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json()
    assert wrong_password.json()["detail"]["code"] == "invalid_credentials"


def test_login_rejects_inactive_passwordless_legacy_user(
    anonymous_client: TestClient,
    test_engine,
) -> None:
    response = anonymous_client.post(
        "/api/auth/login",
        json={"email": DEVELOPMENT_USER_EMAIL, "password": VALID_PASSWORD},
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "invalid_credentials"
    with Session(test_engine) as session:
        legacy = session.exec(
            select(User).where(User.email == DEVELOPMENT_USER_EMAIL)
        ).one()
        assert legacy.password_hash is None
        assert legacy.is_active is False


def test_login_rejects_active_user_without_password_hash(
    anonymous_client: TestClient,
    test_engine,
) -> None:
    with Session(test_engine) as session:
        session.add(
            User(
                email="passwordless@example.com",
                password_hash=None,
                is_active=True,
            )
        )
        session.commit()

    response = anonymous_client.post(
        "/api/auth/login",
        json={"email": "passwordless@example.com", "password": VALID_PASSWORD},
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "invalid_credentials"


def test_login_creates_an_additional_session_and_logout_revokes_only_current(
    anonymous_client: TestClient,
    test_engine,
) -> None:
    assert _signup(anonymous_client).status_code == 201
    first_token = anonymous_client.cookies.get("editflow_session")
    login_response = anonymous_client.post(
        "/api/auth/login",
        json={"email": "person@example.com", "password": VALID_PASSWORD},
    )
    second_token = anonymous_client.cookies.get("editflow_session")

    assert login_response.status_code == 200
    assert first_token != second_token
    assert anonymous_client.post("/api/auth/logout").status_code == 204
    assert anonymous_client.get("/api/auth/me").status_code == 401

    with Session(test_engine) as session:
        rows = session.exec(select(AuthSession)).all()
        assert len(rows) == 2
        by_digest = {row.token_digest: row for row in rows}
        assert by_digest[token_digest(first_token)].revoked_at is None
        assert by_digest[token_digest(second_token)].revoked_at is not None


def test_me_rejects_missing_invalid_expired_revoked_and_inactive_sessions(
    anonymous_client: TestClient,
    test_engine,
) -> None:
    assert anonymous_client.get("/api/auth/me").status_code == 401
    anonymous_client.cookies.set(
        "editflow_session",
        "invalid-session-token",
        domain="testserver.local",
        path="/",
    )
    assert anonymous_client.get("/api/auth/me").status_code == 401

    assert _signup(anonymous_client).status_code == 201
    raw_token = anonymous_client.cookies.get("editflow_session")
    with Session(test_engine) as session:
        row = session.exec(
            select(AuthSession).where(
                AuthSession.token_digest == token_digest(raw_token)
            )
        ).one()
        row.expires_at = utc_now() - timedelta(seconds=1)
        session.add(row)
        session.commit()
    assert anonymous_client.get("/api/auth/me").status_code == 401

    with Session(test_engine) as session:
        row = session.exec(
            select(AuthSession).where(
                AuthSession.token_digest == token_digest(raw_token)
            )
        ).one()
        row.expires_at = utc_now() + timedelta(days=1)
        row.revoked_at = utc_now()
        session.add(row)
        session.commit()
    assert anonymous_client.get("/api/auth/me").status_code == 401

    with Session(test_engine) as session:
        row = session.exec(
            select(AuthSession).where(
                AuthSession.token_digest == token_digest(raw_token)
            )
        ).one()
        row.revoked_at = None
        user = session.get(User, row.user_id)
        assert user is not None
        user.is_active = False
        session.add_all([row, user])
        session.commit()
    response = anonymous_client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "authentication_required"


@pytest.mark.parametrize(
    ("now", "is_valid"),
    [
        (datetime(2026, 9, 15, 11, 59, 59, 999999, tzinfo=timezone.utc), True),
        (datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc), False),
        (datetime(2026, 9, 15, 12, 0, 0, 1, tzinfo=timezone.utc), False),
        (datetime(2026, 9, 15, 21, 0, tzinfo=timezone(timedelta(hours=9))), False),
    ],
)
def test_session_expiration_boundary_is_absolute_utc(
    anonymous_client: TestClient,
    test_engine,
    now: datetime,
    is_valid: bool,
) -> None:
    assert _signup(anonymous_client).status_code == 201
    raw_token = anonymous_client.cookies.get("editflow_session")
    expiration = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)
    with Session(test_engine) as session:
        row = session.exec(
            select(AuthSession).where(
                AuthSession.token_digest == token_digest(raw_token)
            )
        ).one()
        row.expires_at = expiration
        session.add(row)
        session.commit()
        context = lookup_auth_context(session, raw_token, now=now)

    assert (context is not None) is is_valid


def test_logout_is_idempotent_and_clears_invalid_cookie(anonymous_client: TestClient) -> None:
    anonymous_client.cookies.set(
        "editflow_session",
        "invalid-session-token",
        domain="testserver.local",
        path="/",
    )

    first = anonymous_client.post("/api/auth/logout")
    second = anonymous_client.post("/api/auth/logout")

    assert first.status_code == 204
    assert second.status_code == 204
    assert anonymous_client.cookies.get("editflow_session") is None
    assert "Max-Age=0" in first.headers.get("set-cookie", "")


def test_login_rate_limit_is_scoped_to_ip_and_email(anonymous_client: TestClient) -> None:
    for _ in range(5):
        response = anonymous_client.post(
            "/api/auth/login",
            json={"email": "limited@example.com", "password": VALID_PASSWORD},
        )
        assert response.status_code == 401

    limited = anonymous_client.post(
        "/api/auth/login",
        json={"email": "limited@example.com", "password": VALID_PASSWORD},
    )

    assert limited.status_code == 429
    assert limited.json()["detail"]["code"] == "rate_limited"
    assert int(limited.headers["retry-after"]) >= 1


def test_signup_rate_limit_is_scoped_to_ip(anonymous_client: TestClient) -> None:
    for index in range(3):
        response = _signup(anonymous_client, email=f"person{index}@example.com")
        assert response.status_code == 201

    limited = _signup(anonymous_client, email="person3@example.com")

    assert limited.status_code == 429
    assert limited.json()["detail"]["code"] == "rate_limited"


def test_session_digest_has_database_uniqueness(test_engine) -> None:
    with Session(test_engine) as session:
        user = User(
            email="unique@example.com",
            password_hash=hash_password(VALID_PASSWORD),
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        now = utc_now()
        common = {
            "user_id": user.id,
            "token_digest": hashlib.sha256(b"same-token").hexdigest(),
            "csrf_token_digest": hashlib.sha256(b"csrf").hexdigest(),
            "expires_at": now + timedelta(days=7),
        }
        session.add(AuthSession(**common))
        session.commit()
        session.add(AuthSession(**common))

        with pytest.raises(IntegrityError):
            session.commit()

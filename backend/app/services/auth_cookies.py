from datetime import timezone

from fastapi import Response

from app.core.config import Settings
from app.services.auth import AuthResult


def set_auth_cookies(
    response: Response,
    result: AuthResult,
    settings: Settings,
) -> None:
    expires_at = result.auth_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = expires_at.astimezone(timezone.utc)
    common = {
        "max_age": settings.auth_session_ttl_seconds,
        "expires": expires_at,
        "path": "/",
        "secure": settings.auth_cookie_secure,
        "samesite": settings.auth_cookie_samesite,
    }
    response.set_cookie(
        key=settings.auth_session_cookie_name,
        value=result.tokens.session_token,
        httponly=True,
        **common,
    )
    response.set_cookie(
        key=settings.auth_csrf_cookie_name,
        value=result.tokens.csrf_token,
        httponly=False,
        **common,
    )


def clear_auth_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.auth_session_cookie_name,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )
    response.delete_cookie(
        key=settings.auth_csrf_cookie_name,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=False,
        samesite=settings.auth_cookie_samesite,
    )

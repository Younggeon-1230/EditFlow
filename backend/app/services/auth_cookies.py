from fastapi import Response

from app.core.config import Settings
from app.core.datetime import as_utc
from app.services.auth import AuthResult


def set_auth_cookies(
    response: Response,
    result: AuthResult,
    settings: Settings,
) -> None:
    expires_at = as_utc(result.auth_session.expires_at)
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


def set_csrf_cookie(
    response: Response,
    csrf_token: str,
    settings: Settings,
) -> None:
    response.set_cookie(
        key=settings.auth_csrf_cookie_name,
        value=csrf_token,
        max_age=settings.auth_session_ttl_seconds,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=False,
        samesite=settings.auth_cookie_samesite,
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

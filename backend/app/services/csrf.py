import hmac
import secrets
from urllib.parse import urlsplit

from fastapi import HTTPException, Request

from app.core.config import Settings
from app.models.auth_session import AuthSession
from app.services.auth import token_digest


UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
CSRF_MESSAGE = "요청을 확인할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def validate_request_origin(request: Request, settings: Settings) -> None:
    origin = request.headers.get("origin")
    if origin is not None:
        candidate = origin.rstrip("/")
    else:
        referer = request.headers.get("referer")
        candidate = _referer_origin(referer) if referer else None
    if candidate is None or candidate not in settings.frontend_origins:
        raise csrf_error("csrf_origin_invalid")


def validate_csrf_tokens(
    request: Request,
    settings: Settings,
    auth_session: AuthSession | None = None,
) -> None:
    cookie_token = request.cookies.get(settings.auth_csrf_cookie_name)
    header_token = request.headers.get(settings.auth_csrf_header_name)
    if not cookie_token or not header_token:
        raise csrf_error("csrf_required")
    if not hmac.compare_digest(cookie_token, header_token):
        raise csrf_error("csrf_invalid")
    if auth_session is not None and not hmac.compare_digest(
        token_digest(header_token),
        auth_session.csrf_token_digest,
    ):
        raise csrf_error("csrf_invalid")


def csrf_error(code: str) -> HTTPException:
    return HTTPException(
        status_code=403,
        detail={"code": code, "message": CSRF_MESSAGE},
    )


def _referer_origin(referer: str) -> str | None:
    try:
        parsed = urlsplit(referer)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return None
        return f"{parsed.scheme}://{parsed.netloc}"
    except ValueError:
        return None

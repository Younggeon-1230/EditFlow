from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, Request
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.models.auth_session import AuthSession
from app.models.user import User
from app.providers.llm import (
    ContentRecommendationProvider,
    OpenAIContentRecommendationProvider,
)
from app.services.auth import AuthContext, lookup_auth_context
from app.services.csrf import (
    UNSAFE_METHODS,
    validate_csrf_tokens,
    validate_request_origin,
)


SessionDependency = Annotated[Session, Depends(get_session)]


def get_external_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.external_http_client


ExternalHttpClientDependency = Annotated[
    httpx.AsyncClient,
    Depends(get_external_http_client),
]
SettingsDependency = Annotated[Settings, Depends(get_settings)]


def get_optional_auth_context(
    request: Request,
    session: SessionDependency,
    settings: SettingsDependency,
) -> AuthContext | None:
    raw_token = request.cookies.get(settings.auth_session_cookie_name)
    return lookup_auth_context(session, raw_token)


OptionalAuthContextDependency = Annotated[
    AuthContext | None,
    Depends(get_optional_auth_context),
]


def get_current_auth_context(
    context: OptionalAuthContextDependency,
) -> AuthContext:
    if context is None:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "authentication_required",
                "message": "로그인이 필요합니다.",
            },
        )
    return context


CurrentAuthContextDependency = Annotated[
    AuthContext,
    Depends(get_current_auth_context),
]


def get_current_user(context: CurrentAuthContextDependency) -> User:
    return context.user


def get_current_auth_session(
    context: CurrentAuthContextDependency,
) -> AuthSession:
    return context.auth_session


CurrentUserDependency = Annotated[User, Depends(get_current_user)]
CurrentAuthSessionDependency = Annotated[
    AuthSession,
    Depends(get_current_auth_session),
]


def enforce_csrf(
    request: Request,
    session: SessionDependency,
    settings: SettingsDependency,
) -> None:
    if request.method not in UNSAFE_METHODS:
        return

    raw_session_token = request.cookies.get(settings.auth_session_cookie_name)
    context = lookup_auth_context(session, raw_session_token)

    # Logout stays idempotent for missing, expired, revoked, or invalid sessions.
    if request.url.path == "/api/auth/logout" and context is None:
        return

    validate_request_origin(request, settings)
    public_auth_paths = {"/api/auth/signup", "/api/auth/login"}
    if context is None and request.url.path not in public_auth_paths:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "authentication_required",
                "message": "로그인이 필요합니다.",
            },
        )
    validate_csrf_tokens(
        request,
        settings,
        context.auth_session if context is not None else None,
    )


def get_content_recommendation_provider(
    settings: SettingsDependency,
) -> ContentRecommendationProvider:
    return OpenAIContentRecommendationProvider(settings)


ContentRecommendationProviderDependency = Annotated[
    ContentRecommendationProvider,
    Depends(get_content_recommendation_provider),
]

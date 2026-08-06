from typing import Annotated

import httpx
from fastapi import Depends, Request
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.core.database import get_session
from app.models.user import User
from app.providers.llm import (
    ContentRecommendationProvider,
    OpenAIContentRecommendationProvider,
)
from app.services.users import ensure_development_user


SessionDependency = Annotated[Session, Depends(get_session)]


def get_development_user(session: SessionDependency) -> User:
    return ensure_development_user(session)


DevelopmentUserDependency = Annotated[User, Depends(get_development_user)]


def get_external_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.external_http_client


ExternalHttpClientDependency = Annotated[
    httpx.AsyncClient,
    Depends(get_external_http_client),
]
SettingsDependency = Annotated[Settings, Depends(get_settings)]


def get_content_recommendation_provider(
    settings: SettingsDependency,
) -> ContentRecommendationProvider:
    return OpenAIContentRecommendationProvider(settings)


ContentRecommendationProviderDependency = Annotated[
    ContentRecommendationProvider,
    Depends(get_content_recommendation_provider),
]

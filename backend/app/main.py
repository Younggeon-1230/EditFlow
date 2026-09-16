from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import get_session
from app.core.http import request_context_middleware, unexpected_exception_handler
from app.services.users import ensure_development_user


settings = get_settings()


def should_ensure_development_user(environment: str) -> bool:
    return environment.casefold() == "development"


@asynccontextmanager
async def lifespan(app: FastAPI):
    session_provider = app.dependency_overrides.get(get_session, get_session)
    session_generator = session_provider()
    try:
        session = next(session_generator)
        if should_ensure_development_user(settings.environment):
            ensure_development_user(session)
    finally:
        session_generator.close()
    timeout = httpx.Timeout(settings.external_api_timeout_seconds)
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=False,
        trust_env=False,
    ) as external_http_client:
        app.state.external_http_client = external_http_client
        yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="EditFlow AI \ucf58\ud150\uce20 \uae30\ud68d\u00b7\ud3b8\uc9d1 \ubcf4\uc870 \ud50c\ub7ab\ud3fc API",
    lifespan=lifespan,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", settings.auth_csrf_header_name],
)

# Register last so request IDs and access logs wrap every application response.
app.middleware("http")(request_context_middleware)
app.add_exception_handler(Exception, unexpected_exception_handler)

app.include_router(api_router)


@app.get("/", tags=["Root"])
def root() -> dict[str, str]:
    return {
        "message": "EditFlow API",
        "docs": "/docs",
        "health": "/health/live",
    }

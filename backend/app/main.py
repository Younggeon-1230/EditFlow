from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import get_session
from app.services.users import ensure_development_user


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    session_provider = app.dependency_overrides.get(get_session, get_session)
    session_generator = session_provider()
    try:
        session = next(session_generator)
        ensure_development_user(session)
    finally:
        session_generator.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="EditFlow AI \ucf58\ud150\uce20 \uae30\ud68d\u00b7\ud3b8\uc9d1 \ubcf4\uc870 \ud50c\ub7ab\ud3fc API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/", tags=["Root"])
def root() -> dict[str, str]:
    return {
        "message": "EditFlow API",
        "docs": "/docs",
        "health": "/health",
    }

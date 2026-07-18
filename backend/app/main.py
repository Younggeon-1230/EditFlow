from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings


settings = get_settings()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="EditFlow AI \ucf58\ud150\uce20 \uae30\ud68d\u00b7\ud3b8\uc9d1 \ubcf4\uc870 \ud50c\ub7ab\ud3fc API",
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

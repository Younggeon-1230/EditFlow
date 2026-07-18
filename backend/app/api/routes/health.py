from fastapi import APIRouter

from app.core.config import get_settings


router = APIRouter(tags=["Health"])
settings = get_settings()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }

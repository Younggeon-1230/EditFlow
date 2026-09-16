import logging

from fastapi import APIRouter, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies import SessionDependency


router = APIRouter(tags=["Health"])
logger = logging.getLogger(__name__)


@router.get("/health")
@router.get("/health/live")
def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def readiness(response: Response, session: SessionDependency) -> dict[str, str]:
    try:
        session.exec(text("SELECT 1")).one()
    except SQLAlchemyError:
        logger.warning("database_readiness_failed")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable"}
    return {"status": "ok"}

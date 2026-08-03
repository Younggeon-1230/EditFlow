from fastapi import APIRouter

from app.api.routes.checklist_items import router as checklist_items_router
from app.api.routes.content_ideas import router as content_ideas_router
from app.api.routes.content_idea_brolls import router as content_idea_brolls_router
from app.api.routes.content_idea_references import router as content_idea_references_router
from app.api.routes.external import router as external_router
from app.api.routes.health import router as health_router
from app.api.routes.projects import router as projects_router
from app.api.routes.project_memos import router as project_memos_router
from app.api.routes.saved_brolls import router as saved_brolls_router
from app.api.routes.saved_references import router as saved_references_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(projects_router)
api_router.include_router(project_memos_router)
api_router.include_router(checklist_items_router)
api_router.include_router(content_ideas_router)
api_router.include_router(content_idea_references_router)
api_router.include_router(content_idea_brolls_router)
api_router.include_router(saved_references_router)
api_router.include_router(saved_brolls_router)
api_router.include_router(external_router)

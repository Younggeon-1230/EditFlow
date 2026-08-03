"""SQLModel model exports used by the application and Alembic.

Import and re-export new table models from this module so Alembic's
autogenerate process registers them with ``SQLModel.metadata``.
"""

from app.models.checklist_item import ChecklistItem
from app.models.content_idea import (
    ContentIdea,
    ContentIdeaSource,
    ContentIdeaStatus,
    ContentPlatform,
    ContentPriority,
)
from app.models.content_idea_broll import ContentIdeaBroll
from app.models.content_idea_reference import ContentIdeaReference
from app.models.project import Project, ProjectStatus
from app.models.project_memo import ProjectMemo
from app.models.saved_broll import SavedBroll
from app.models.saved_reference import SavedReference
from app.models.user import User


__all__ = [
    "ChecklistItem",
    "ContentIdea",
    "ContentIdeaBroll",
    "ContentIdeaReference",
    "ContentIdeaSource",
    "ContentIdeaStatus",
    "ContentPlatform",
    "ContentPriority",
    "Project",
    "ProjectStatus",
    "ProjectMemo",
    "SavedBroll",
    "SavedReference",
    "User",
]

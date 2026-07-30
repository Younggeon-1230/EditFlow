import json
from typing import Any

from sqlalchemy import or_
from sqlmodel import Session, select

from app.models.content_idea import (
    ContentIdea,
    ContentIdeaSource,
    ContentIdeaStatus,
    ContentPlatform,
    ContentPriority,
)
from app.models.user import utc_now
from app.schemas.content_idea import (
    ContentIdeaCreate,
    ContentIdeaRead,
    ContentIdeaUpdate,
    normalize_tags as _normalize_tags,
)


def normalize_tags(tags: Any) -> Any:
    return _normalize_tags(tags)


def serialize_tags(tags: list[str]) -> str | None:
    if not tags:
        return None
    return json.dumps(tags, ensure_ascii=False)


def deserialize_tags(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(parsed, list):
        return []
    return [tag for tag in parsed if isinstance(tag, str)]


def to_content_idea_read(idea: ContentIdea) -> ContentIdeaRead:
    assert idea.id is not None
    return ContentIdeaRead(
        id=idea.id,
        user_id=idea.user_id,
        title=idea.title,
        description=idea.description,
        platform=ContentPlatform(idea.platform),
        status=ContentIdeaStatus(idea.status),
        priority=ContentPriority(idea.priority),
        tags=deserialize_tags(idea.tags),
        target_audience=idea.target_audience,
        content_format=idea.content_format,
        source=ContentIdeaSource(idea.source),
        converted_project_id=idea.converted_project_id,
        created_at=idea.created_at,
        updated_at=idea.updated_at,
    )


def _normalize_nullable_text_fields(data: dict[str, Any]) -> None:
    for field_name in ("description", "target_audience", "content_format"):
        if field_name in data and data[field_name] == "":
            data[field_name] = None


def list_content_ideas(
    session: Session,
    user_id: int,
    *,
    status: ContentIdeaStatus | None = None,
    platform: ContentPlatform | None = None,
    priority: ContentPriority | None = None,
    source: ContentIdeaSource | None = None,
    search: str | None = None,
) -> list[ContentIdeaRead]:
    statement = select(ContentIdea).where(ContentIdea.user_id == user_id)
    if status is not None:
        statement = statement.where(ContentIdea.status == status)
    if platform is not None:
        statement = statement.where(ContentIdea.platform == platform)
    if priority is not None:
        statement = statement.where(ContentIdea.priority == priority)
    if source is not None:
        statement = statement.where(ContentIdea.source == source)
    if search and (term := search.strip()):
        escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        statement = statement.where(
            or_(
                ContentIdea.title.ilike(pattern, escape="\\"),
                ContentIdea.description.ilike(pattern, escape="\\"),
            )
        )

    statement = statement.order_by(
        ContentIdea.created_at.desc(),
        ContentIdea.id.desc(),
    )
    return [to_content_idea_read(idea) for idea in session.exec(statement).all()]


def create_content_idea(
    session: Session,
    user_id: int,
    idea_create: ContentIdeaCreate,
) -> ContentIdeaRead:
    data = idea_create.model_dump(exclude={"tags"})
    _normalize_nullable_text_fields(data)
    idea = ContentIdea(
        user_id=user_id,
        source=ContentIdeaSource.MANUAL,
        tags=serialize_tags(idea_create.tags),
        **data,
    )
    session.add(idea)
    session.commit()
    session.refresh(idea)
    return to_content_idea_read(idea)


def get_content_idea(
    session: Session,
    user_id: int,
    idea_id: int,
) -> ContentIdea | None:
    statement = select(ContentIdea).where(
        ContentIdea.id == idea_id,
        ContentIdea.user_id == user_id,
    )
    return session.exec(statement).one_or_none()


def update_content_idea(
    session: Session,
    idea: ContentIdea,
    idea_update: ContentIdeaUpdate,
) -> ContentIdeaRead:
    data = idea_update.model_dump(exclude_unset=True, exclude={"tags"})
    _normalize_nullable_text_fields(data)
    idea.sqlmodel_update(data)
    if "tags" in idea_update.model_fields_set:
        idea.tags = serialize_tags(idea_update.tags or [])
    idea.updated_at = utc_now()
    session.add(idea)
    session.commit()
    session.refresh(idea)
    return to_content_idea_read(idea)


def delete_content_idea(session: Session, idea: ContentIdea) -> None:
    session.delete(idea)
    session.commit()

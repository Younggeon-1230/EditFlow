import json
from typing import Any

from sqlalchemy import case, delete, exists, func, or_
from sqlmodel import Session, select

from app.models.content_idea import (
    ContentIdea,
    ContentIdeaSource,
    ContentIdeaSort,
    ContentIdeaStatus,
    ContentPlatform,
    ContentPriority,
)
from app.models.content_idea_broll import ContentIdeaBroll
from app.models.content_idea_reference import ContentIdeaReference
from app.models.user import utc_now
from app.models.project import Project
from app.models.saved_broll import SavedBroll
from app.models.saved_reference import SavedReference
from app.schemas.content_idea import (
    ContentIdeaCreate,
    ContentIdeaConversionCreate,
    ContentIdeaRead,
    ContentIdeaPriorityCounts,
    ContentIdeaPlatformCounts,
    ContentIdeaSourceCounts,
    ContentIdeaStatusCounts,
    ContentIdeaSummaryRead,
    ContentIdeaUpdate,
    normalize_tags as _normalize_tags,
)
from app.schemas.project import ProjectRead


class ContentIdeaNotFoundError(Exception):
    pass


class ContentIdeaConversionConflictError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


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
    sort: ContentIdeaSort = ContentIdeaSort.CREATED_DESC,
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

    order_by = {
        ContentIdeaSort.CREATED_DESC: (ContentIdea.created_at.desc(), ContentIdea.id.desc()),
        ContentIdeaSort.CREATED_ASC: (ContentIdea.created_at.asc(), ContentIdea.id.asc()),
        ContentIdeaSort.UPDATED_DESC: (ContentIdea.updated_at.desc(), ContentIdea.id.desc()),
        ContentIdeaSort.UPDATED_ASC: (ContentIdea.updated_at.asc(), ContentIdea.id.asc()),
        ContentIdeaSort.TITLE_ASC: (ContentIdea.title.asc(), ContentIdea.id.asc()),
        ContentIdeaSort.TITLE_DESC: (ContentIdea.title.desc(), ContentIdea.id.desc()),
    }
    if sort in (ContentIdeaSort.PRIORITY_DESC, ContentIdeaSort.PRIORITY_ASC):
        priority_rank = case(
            (ContentIdea.priority == ContentPriority.LOW, 1),
            (ContentIdea.priority == ContentPriority.MEDIUM, 2),
            (ContentIdea.priority == ContentPriority.HIGH, 3),
            else_=0,
        )
        priority_order = (
            priority_rank.desc()
            if sort == ContentIdeaSort.PRIORITY_DESC
            else priority_rank.asc()
        )
        statement = statement.order_by(
            priority_order,
            ContentIdea.updated_at.desc(),
            ContentIdea.id.desc(),
        )
    else:
        statement = statement.order_by(*order_by[sort])
    return [to_content_idea_read(idea) for idea in session.exec(statement).all()]


def _enum_counts(
    session: Session,
    user_id: int,
    column: Any,
) -> dict[str, int]:
    statement = (
        select(column, func.count(ContentIdea.id))
        .where(ContentIdea.user_id == user_id)
        .group_by(column)
    )
    return {str(value): count for value, count in session.exec(statement).all()}


def get_content_idea_summary(
    session: Session,
    user_id: int,
) -> ContentIdeaSummaryRead:
    total, latest_updated_at = session.exec(
        select(func.count(ContentIdea.id), func.max(ContentIdea.updated_at)).where(
            ContentIdea.user_id == user_id
        )
    ).one()
    by_status = _enum_counts(session, user_id, ContentIdea.status)
    by_priority = _enum_counts(session, user_id, ContentIdea.priority)
    by_platform = _enum_counts(session, user_id, ContentIdea.platform)
    by_source = _enum_counts(session, user_id, ContentIdea.source)

    reference_exists = exists().where(
        ContentIdeaReference.content_idea_id == ContentIdea.id
    )
    broll_exists = exists().where(ContentIdeaBroll.content_idea_id == ContentIdea.id)

    def count_where(*conditions: Any) -> int:
        return session.exec(
            select(func.count(ContentIdea.id)).where(
                ContentIdea.user_id == user_id,
                *conditions,
            )
        ).one()

    return ContentIdeaSummaryRead(
        total=total,
        by_status=ContentIdeaStatusCounts(**by_status),
        by_priority=ContentIdeaPriorityCounts(**by_priority),
        by_platform=ContentIdeaPlatformCounts(**by_platform),
        by_source=ContentIdeaSourceCounts(**by_source),
        converted_count=count_where(ContentIdea.converted_project_id.is_not(None)),
        ready_count=by_status.get(ContentIdeaStatus.READY, 0),
        active_count=sum(
            by_status.get(status, 0)
            for status in (
                ContentIdeaStatus.IDEA,
                ContentIdeaStatus.RESEARCHING,
                ContentIdeaStatus.READY,
            )
        ),
        with_reference_count=count_where(reference_exists),
        with_broll_count=count_where(broll_exists),
        with_any_media_count=count_where(or_(reference_exists, broll_exists)),
        latest_updated_at=latest_updated_at,
    )


def create_content_idea(
    session: Session,
    user_id: int,
    idea_create: ContentIdeaCreate,
) -> ContentIdeaRead:
    return create_content_idea_with_source(
        session,
        user_id,
        idea_create,
        source=ContentIdeaSource.MANUAL,
    )


def create_content_idea_with_source(
    session: Session,
    user_id: int,
    idea_create: ContentIdeaCreate,
    *,
    source: ContentIdeaSource,
) -> ContentIdeaRead:
    data = idea_create.model_dump(exclude={"tags"})
    _normalize_nullable_text_fields(data)
    idea = ContentIdea(
        user_id=user_id,
        source=source,
        tags=serialize_tags(idea_create.tags),
        **data,
    )
    try:
        session.add(idea)
        session.commit()
        session.refresh(idea)
    except Exception:
        session.rollback()
        raise
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
    assert idea.id is not None
    try:
        session.exec(
            delete(ContentIdeaReference).where(
                ContentIdeaReference.content_idea_id == idea.id
            )
        )
        session.exec(
            delete(ContentIdeaBroll).where(
                ContentIdeaBroll.content_idea_id == idea.id
            )
        )
        session.delete(idea)
        session.commit()
    except Exception:
        session.rollback()
        raise


def convert_content_idea_to_project(
    session: Session,
    user_id: int,
    idea_id: int,
    data: ContentIdeaConversionCreate,
) -> tuple[ProjectRead, ContentIdeaRead]:
    idea = get_content_idea(session, user_id, idea_id)
    if idea is None:
        raise ContentIdeaNotFoundError
    if (
        idea.converted_project_id is not None
        or idea.status == ContentIdeaStatus.CONVERTED
    ):
        raise ContentIdeaConversionConflictError("converted")
    if idea.status == ContentIdeaStatus.ARCHIVED:
        raise ContentIdeaConversionConflictError("archived")

    project_data = data.model_dump()
    if project_data.get("description") == "":
        project_data["description"] = None
    project = Project(user_id=user_id, client_name=None, **project_data)

    try:
        session.add(project)
        session.flush()
        assert project.id is not None
        idea_references = list(
            session.exec(
                select(ContentIdeaReference).where(
                    ContentIdeaReference.content_idea_id == idea.id
                )
            ).all()
        )
        idea_brolls = list(
            session.exec(
                select(ContentIdeaBroll).where(ContentIdeaBroll.content_idea_id == idea.id)
            ).all()
        )
        for reference in idea_references:
            session.add(
                SavedReference(
                    project_id=project.id,
                    provider=reference.provider,
                    external_id=reference.external_id,
                    title=reference.title,
                    url=reference.url,
                    thumbnail_url=reference.thumbnail_url,
                    channel_title=reference.channel_title,
                    published_at=reference.published_at,
                    note=reference.note,
                )
            )
        for broll in idea_brolls:
            session.add(
                SavedBroll(
                    project_id=project.id,
                    provider=broll.provider,
                    external_id=broll.external_id,
                    title=broll.title,
                    url=broll.url,
                    preview_url=broll.preview_url,
                    thumbnail_url=broll.thumbnail_url,
                    creator_name=broll.creator_name,
                    duration_seconds=broll.duration_seconds,
                    width=broll.width,
                    height=broll.height,
                    note=broll.note,
                )
            )
        idea.status = ContentIdeaStatus.CONVERTED
        idea.converted_project_id = project.id
        idea.updated_at = utc_now()
        session.add(idea)
        session.commit()
        session.refresh(project)
        session.refresh(idea)
    except Exception:
        session.rollback()
        raise

    return (
        ProjectRead.model_validate(
            {
                **project.model_dump(),
                "reference_count": len(idea_references),
                "broll_count": len(idea_brolls),
                "checklist_total": 0,
                "checklist_completed": 0,
            }
        ),
        to_content_idea_read(idea),
    )

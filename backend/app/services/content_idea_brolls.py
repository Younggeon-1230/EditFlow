from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.content_idea import ContentIdea
from app.models.content_idea_broll import ContentIdeaBroll
from app.models.user import utc_now
from app.schemas.content_idea_broll import ContentIdeaBrollCreate, ContentIdeaBrollUpdate


class DuplicateContentIdeaBrollError(Exception):
    pass


def list_content_idea_brolls(session: Session, idea_id: int) -> list[ContentIdeaBroll]:
    statement = (
        select(ContentIdeaBroll)
        .where(ContentIdeaBroll.content_idea_id == idea_id)
        .order_by(ContentIdeaBroll.created_at.desc(), ContentIdeaBroll.id.desc())
    )
    return list(session.exec(statement).all())


def _exists(session: Session, idea_id: int, external_id: str) -> bool:
    statement = select(ContentIdeaBroll.id).where(
        ContentIdeaBroll.content_idea_id == idea_id,
        ContentIdeaBroll.provider == "pexels",
        ContentIdeaBroll.external_id == external_id,
    )
    return session.exec(statement).first() is not None


def create_content_idea_broll(
    session: Session,
    idea_id: int,
    data: ContentIdeaBrollCreate,
) -> ContentIdeaBroll:
    if _exists(session, idea_id, data.external_id):
        raise DuplicateContentIdeaBrollError
    values = data.model_dump()
    for field_name in ("url", "preview_url", "thumbnail_url"):
        value = getattr(data, field_name)
        values[field_name] = str(value) if value is not None else None
    values["note"] = data.note or None
    broll = ContentIdeaBroll(
        content_idea_id=idea_id,
        provider="pexels",
        **values,
    )
    session.add(broll)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if _exists(session, idea_id, data.external_id):
            raise DuplicateContentIdeaBrollError from error
        raise
    session.refresh(broll)
    return broll


def get_owned_content_idea_broll(
    session: Session,
    user_id: int,
    broll_id: int,
) -> ContentIdeaBroll | None:
    statement = (
        select(ContentIdeaBroll)
        .join(ContentIdea, ContentIdea.id == ContentIdeaBroll.content_idea_id)
        .where(ContentIdeaBroll.id == broll_id, ContentIdea.user_id == user_id)
    )
    return session.exec(statement).one_or_none()


def update_content_idea_broll(
    session: Session,
    broll: ContentIdeaBroll,
    data: ContentIdeaBrollUpdate,
) -> ContentIdeaBroll:
    broll.note = data.note or None
    broll.updated_at = utc_now()
    session.add(broll)
    session.commit()
    session.refresh(broll)
    return broll


def delete_content_idea_broll(session: Session, broll: ContentIdeaBroll) -> None:
    session.delete(broll)
    session.commit()

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.content_idea import ContentIdea
from app.models.content_idea_reference import ContentIdeaReference
from app.models.user import utc_now
from app.schemas.content_idea_reference import (
    ContentIdeaReferenceCreate,
    ContentIdeaReferenceUpdate,
)


class DuplicateContentIdeaReferenceError(Exception):
    pass


def list_content_idea_references(session: Session, idea_id: int) -> list[ContentIdeaReference]:
    statement = (
        select(ContentIdeaReference)
        .where(ContentIdeaReference.content_idea_id == idea_id)
        .order_by(ContentIdeaReference.created_at.desc(), ContentIdeaReference.id.desc())
    )
    return list(session.exec(statement).all())


def _exists(session: Session, idea_id: int, external_id: str) -> bool:
    statement = select(ContentIdeaReference.id).where(
        ContentIdeaReference.content_idea_id == idea_id,
        ContentIdeaReference.provider == "youtube",
        ContentIdeaReference.external_id == external_id,
    )
    return session.exec(statement).first() is not None


def create_content_idea_reference(
    session: Session,
    idea_id: int,
    data: ContentIdeaReferenceCreate,
) -> ContentIdeaReference:
    if _exists(session, idea_id, data.external_id):
        raise DuplicateContentIdeaReferenceError
    values = data.model_dump()
    values["url"] = str(data.url)
    values["thumbnail_url"] = str(data.thumbnail_url) if data.thumbnail_url else None
    values["note"] = data.note or None
    reference = ContentIdeaReference(
        content_idea_id=idea_id,
        provider="youtube",
        **values,
    )
    session.add(reference)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if _exists(session, idea_id, data.external_id):
            raise DuplicateContentIdeaReferenceError from error
        raise
    session.refresh(reference)
    return reference


def get_owned_content_idea_reference(
    session: Session,
    user_id: int,
    reference_id: int,
) -> ContentIdeaReference | None:
    statement = (
        select(ContentIdeaReference)
        .join(ContentIdea, ContentIdea.id == ContentIdeaReference.content_idea_id)
        .where(ContentIdeaReference.id == reference_id, ContentIdea.user_id == user_id)
    )
    return session.exec(statement).one_or_none()


def update_content_idea_reference(
    session: Session,
    reference: ContentIdeaReference,
    data: ContentIdeaReferenceUpdate,
) -> ContentIdeaReference:
    reference.note = data.note or None
    reference.updated_at = utc_now()
    session.add(reference)
    session.commit()
    session.refresh(reference)
    return reference


def delete_content_idea_reference(session: Session, reference: ContentIdeaReference) -> None:
    session.delete(reference)
    session.commit()

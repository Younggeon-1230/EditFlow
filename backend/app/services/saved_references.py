from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.project import Project
from app.models.saved_reference import SavedReference
from app.models.user import utc_now
from app.schemas.saved_reference import (
    SavedReferenceCreate,
    SavedReferenceUpdate,
)


class DuplicateSavedReferenceError(Exception):
    pass


def list_saved_references(
    session: Session,
    project_id: int,
) -> list[SavedReference]:
    statement = (
        select(SavedReference)
        .where(SavedReference.project_id == project_id)
        .order_by(SavedReference.created_at.desc(), SavedReference.id.desc())
    )
    return list(session.exec(statement).all())


def _saved_reference_exists(
    session: Session,
    project_id: int,
    external_id: str,
) -> bool:
    statement = select(SavedReference.id).where(
        SavedReference.project_id == project_id,
        SavedReference.provider == "youtube",
        SavedReference.external_id == external_id,
    )
    return session.exec(statement).first() is not None


def create_saved_reference(
    session: Session,
    project_id: int,
    reference_create: SavedReferenceCreate,
) -> SavedReference:
    if _saved_reference_exists(session, project_id, reference_create.external_id):
        raise DuplicateSavedReferenceError

    reference_data = reference_create.model_dump()
    reference_data["url"] = str(reference_create.url)
    reference_data["thumbnail_url"] = (
        str(reference_create.thumbnail_url)
        if reference_create.thumbnail_url is not None
        else None
    )
    reference = SavedReference(
        project_id=project_id,
        provider="youtube",
        **reference_data,
    )
    session.add(reference)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        if _saved_reference_exists(
            session,
            project_id,
            reference_create.external_id,
        ):
            raise DuplicateSavedReferenceError from exc
        raise
    session.refresh(reference)
    return reference


def get_owned_saved_reference(
    session: Session,
    user_id: int,
    reference_id: int,
) -> SavedReference | None:
    statement = (
        select(SavedReference)
        .join(Project, Project.id == SavedReference.project_id)
        .where(
            SavedReference.id == reference_id,
            Project.user_id == user_id,
        )
    )
    return session.exec(statement).one_or_none()


def update_saved_reference(
    session: Session,
    reference: SavedReference,
    reference_update: SavedReferenceUpdate,
) -> SavedReference:
    reference.sqlmodel_update(reference_update.model_dump(exclude_unset=True))
    reference.updated_at = utc_now()
    session.add(reference)
    session.commit()
    session.refresh(reference)
    return reference


def delete_saved_reference(
    session: Session,
    reference: SavedReference,
) -> None:
    session.delete(reference)
    session.commit()

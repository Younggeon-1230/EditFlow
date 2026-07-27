from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.project import Project
from app.models.saved_broll import SavedBroll
from app.models.user import utc_now
from app.schemas.saved_broll import SavedBrollCreate, SavedBrollUpdate


class DuplicateSavedBrollError(Exception):
    pass


def list_saved_brolls(
    session: Session,
    project_id: int,
) -> list[SavedBroll]:
    statement = (
        select(SavedBroll)
        .where(SavedBroll.project_id == project_id)
        .order_by(SavedBroll.created_at.desc(), SavedBroll.id.desc())
    )
    return list(session.exec(statement).all())


def _saved_broll_exists(
    session: Session,
    project_id: int,
    external_id: str,
) -> bool:
    statement = select(SavedBroll.id).where(
        SavedBroll.project_id == project_id,
        SavedBroll.provider == "pexels",
        SavedBroll.external_id == external_id,
    )
    return session.exec(statement).first() is not None


def create_saved_broll(
    session: Session,
    project_id: int,
    broll_create: SavedBrollCreate,
) -> SavedBroll:
    if _saved_broll_exists(session, project_id, broll_create.external_id):
        raise DuplicateSavedBrollError

    broll_data = broll_create.model_dump()
    for field_name in ("url", "preview_url", "thumbnail_url"):
        value = getattr(broll_create, field_name)
        broll_data[field_name] = str(value) if value is not None else None
    broll = SavedBroll(
        project_id=project_id,
        provider="pexels",
        **broll_data,
    )
    session.add(broll)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        if _saved_broll_exists(
            session,
            project_id,
            broll_create.external_id,
        ):
            raise DuplicateSavedBrollError from exc
        raise
    session.refresh(broll)
    return broll


def get_owned_saved_broll(
    session: Session,
    user_id: int,
    broll_id: int,
) -> SavedBroll | None:
    statement = (
        select(SavedBroll)
        .join(Project, Project.id == SavedBroll.project_id)
        .where(
            SavedBroll.id == broll_id,
            Project.user_id == user_id,
        )
    )
    return session.exec(statement).one_or_none()


def update_saved_broll(
    session: Session,
    broll: SavedBroll,
    broll_update: SavedBrollUpdate,
) -> SavedBroll:
    broll.sqlmodel_update(broll_update.model_dump(exclude_unset=True))
    broll.updated_at = utc_now()
    session.add(broll)
    session.commit()
    session.refresh(broll)
    return broll


def delete_saved_broll(session: Session, broll: SavedBroll) -> None:
    session.delete(broll)
    session.commit()

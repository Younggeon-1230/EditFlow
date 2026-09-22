from sqlalchemy import func
from sqlmodel import Session, select

from app.models.checklist_item import ChecklistItem
from app.models.project import Project
from app.core.datetime import utc_now
from app.schemas.checklist_item import ChecklistItemCreate, ChecklistItemUpdate
from app.services.default_checklist import add_default_checklist_items


class ChecklistNotEmptyError(Exception):
    pass


def list_checklist_items(
    session: Session,
    project_id: int,
) -> list[ChecklistItem]:
    statement = (
        select(ChecklistItem)
        .where(ChecklistItem.project_id == project_id)
        .order_by(ChecklistItem.position.asc(), ChecklistItem.id.asc())
    )
    return list(session.exec(statement).all())


def create_checklist_item(
    session: Session,
    project_id: int,
    item_create: ChecklistItemCreate,
) -> ChecklistItem:
    # Coordinate manual creates with a concurrent default-template import.
    session.exec(
        select(Project)
        .where(Project.id == project_id)
        .with_for_update()
    ).one()
    item_data = item_create.model_dump(exclude={"position"})
    position = item_create.position
    if position is None:
        statement = select(func.max(ChecklistItem.position)).where(
            ChecklistItem.project_id == project_id
        )
        last_position = session.exec(statement).one()
        position = 0 if last_position is None else last_position + 1

    item = ChecklistItem(
        project_id=project_id,
        position=position,
        **item_data,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def create_default_checklist(
    session: Session,
    project_id: int,
) -> list[ChecklistItem]:
    # Lock the parent row so concurrent imports for the same project serialize.
    session.exec(
        select(Project)
        .where(Project.id == project_id)
        .with_for_update()
    ).one()
    existing_item = session.exec(
        select(ChecklistItem.id)
        .where(ChecklistItem.project_id == project_id)
        .limit(1)
    ).first()
    if existing_item is not None:
        session.rollback()
        raise ChecklistNotEmptyError

    try:
        items = add_default_checklist_items(session, project_id)
        session.commit()
        for item in items:
            session.refresh(item)
        return items
    except Exception:
        session.rollback()
        raise


def get_owned_checklist_item(
    session: Session,
    user_id: int,
    item_id: int,
) -> ChecklistItem | None:
    statement = (
        select(ChecklistItem)
        .join(Project, Project.id == ChecklistItem.project_id)
        .where(
            ChecklistItem.id == item_id,
            Project.user_id == user_id,
        )
    )
    return session.exec(statement).one_or_none()


def update_checklist_item(
    session: Session,
    item: ChecklistItem,
    item_update: ChecklistItemUpdate,
) -> ChecklistItem:
    item.sqlmodel_update(item_update.model_dump(exclude_unset=True))
    item.updated_at = utc_now()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def delete_checklist_item(session: Session, item: ChecklistItem) -> None:
    session.delete(item)
    session.commit()

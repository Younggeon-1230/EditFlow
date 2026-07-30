from sqlalchemy import delete, func
from sqlmodel import Session, select

from app.models.checklist_item import ChecklistItem
from app.models.project import Project
from app.models.saved_broll import SavedBroll
from app.models.saved_reference import SavedReference
from app.models.user import utc_now
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate


def _project_summary_statement(user_id: int, project_id: int | None = None):
    reference_counts = (
        select(
            SavedReference.project_id,
            func.count(SavedReference.id).label("reference_count"),
        )
        .group_by(SavedReference.project_id)
        .subquery()
    )
    broll_counts = (
        select(
            SavedBroll.project_id,
            func.count(SavedBroll.id).label("broll_count"),
        )
        .group_by(SavedBroll.project_id)
        .subquery()
    )
    checklist_counts = (
        select(
            ChecklistItem.project_id,
            func.count(ChecklistItem.id).label("checklist_total"),
            func.count(ChecklistItem.id)
            .filter(ChecklistItem.is_completed.is_(True))
            .label("checklist_completed"),
        )
        .group_by(ChecklistItem.project_id)
        .subquery()
    )

    statement = (
        select(
            Project,
            func.coalesce(reference_counts.c.reference_count, 0),
            func.coalesce(broll_counts.c.broll_count, 0),
            func.coalesce(checklist_counts.c.checklist_total, 0),
            func.coalesce(checklist_counts.c.checklist_completed, 0),
        )
        .outerjoin(
            reference_counts,
            reference_counts.c.project_id == Project.id,
        )
        .outerjoin(
            broll_counts,
            broll_counts.c.project_id == Project.id,
        )
        .outerjoin(
            checklist_counts,
            checklist_counts.c.project_id == Project.id,
        )
        .where(Project.user_id == user_id)
    )
    if project_id is not None:
        statement = statement.where(Project.id == project_id)
    return statement


def _to_project_read(row: tuple[Project, int, int, int, int]) -> ProjectRead:
    project, reference_count, broll_count, checklist_total, checklist_completed = row
    return ProjectRead.model_validate(
        {
            **project.model_dump(),
            "reference_count": reference_count,
            "broll_count": broll_count,
            "checklist_total": checklist_total,
            "checklist_completed": checklist_completed,
        }
    )


def list_projects(session: Session, user_id: int) -> list[ProjectRead]:
    statement = _project_summary_statement(user_id).order_by(
        Project.created_at.desc(),
        Project.id.desc(),
    )
    return [_to_project_read(row) for row in session.exec(statement).all()]


def get_project_summary(
    session: Session, user_id: int, project_id: int
) -> ProjectRead | None:
    row = session.exec(
        _project_summary_statement(user_id, project_id)
    ).one_or_none()
    return _to_project_read(row) if row is not None else None


def create_project(
    session: Session, user_id: int, project_create: ProjectCreate
) -> Project:
    project = Project(
        user_id=user_id,
        **project_create.model_dump(),
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def get_project(session: Session, user_id: int, project_id: int) -> Project | None:
    statement = select(Project).where(
        Project.id == project_id,
        Project.user_id == user_id,
    )
    return session.exec(statement).one_or_none()


def update_project(
    session: Session, project: Project, project_update: ProjectUpdate
) -> Project:
    project.sqlmodel_update(project_update.model_dump(exclude_unset=True))
    project.updated_at = utc_now()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def delete_project(session: Session, project: Project) -> None:
    assert project.id is not None
    for child_model in (ChecklistItem, SavedReference, SavedBroll):
        session.exec(
            delete(child_model).where(child_model.project_id == project.id)
        )
    session.delete(project)
    session.commit()

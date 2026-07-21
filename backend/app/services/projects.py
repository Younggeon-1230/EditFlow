from sqlmodel import Session, select

from app.models.project import Project
from app.models.user import utc_now
from app.schemas.project import ProjectCreate, ProjectUpdate


def list_projects(session: Session, user_id: int) -> list[Project]:
    statement = (
        select(Project)
        .where(Project.user_id == user_id)
        .order_by(Project.created_at.desc(), Project.id.desc())
    )
    return list(session.exec(statement).all())


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
    session.delete(project)
    session.commit()

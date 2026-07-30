from sqlalchemy import func
from sqlmodel import Session, select

from app.models.project import Project
from app.models.project_memo import ProjectMemo
from app.models.user import utc_now
from app.schemas.project_memo import ProjectMemoCreate, ProjectMemoUpdate


def list_project_memos(
    session: Session,
    project_id: int,
) -> list[ProjectMemo]:
    statement = (
        select(ProjectMemo)
        .where(ProjectMemo.project_id == project_id)
        .order_by(ProjectMemo.position.asc(), ProjectMemo.id.asc())
    )
    return list(session.exec(statement).all())


def create_project_memo(
    session: Session,
    project_id: int,
    memo_create: ProjectMemoCreate,
) -> ProjectMemo:
    memo_data = memo_create.model_dump(exclude={"position"})
    position = memo_create.position
    if position is None:
        statement = select(func.max(ProjectMemo.position)).where(
            ProjectMemo.project_id == project_id
        )
        last_position = session.exec(statement).one()
        position = 0 if last_position is None else last_position + 1

    memo = ProjectMemo(
        project_id=project_id,
        position=position,
        **memo_data,
    )
    session.add(memo)
    session.commit()
    session.refresh(memo)
    return memo


def get_owned_project_memo(
    session: Session,
    user_id: int,
    memo_id: int,
) -> ProjectMemo | None:
    statement = (
        select(ProjectMemo)
        .join(Project, Project.id == ProjectMemo.project_id)
        .where(
            ProjectMemo.id == memo_id,
            Project.user_id == user_id,
        )
    )
    return session.exec(statement).one_or_none()


def update_project_memo(
    session: Session,
    memo: ProjectMemo,
    memo_update: ProjectMemoUpdate,
) -> ProjectMemo:
    memo.sqlmodel_update(memo_update.model_dump(exclude_unset=True))
    memo.updated_at = utc_now()
    session.add(memo)
    session.commit()
    session.refresh(memo)
    return memo


def delete_project_memo(session: Session, memo: ProjectMemo) -> None:
    session.delete(memo)
    session.commit()

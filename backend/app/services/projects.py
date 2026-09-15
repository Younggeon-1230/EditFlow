from sqlalchemy import delete, func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.checklist_item import ChecklistItem
from app.models.content_idea import ContentIdea, ContentIdeaStatus
from app.models.project import Project
from app.models.project_memo import ProjectMemo
from app.models.saved_broll import SavedBroll
from app.models.saved_reference import SavedReference
from app.core.datetime import utc_now
from app.schemas.content_idea import ContentIdeaRead
from app.schemas.project import (
    LocalProjectImport,
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
)
from app.services.content_ideas import to_content_idea_read


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
            **project.model_dump(exclude={"source_local_id"}),
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


def get_project_by_source_local_id(
    session: Session,
    user_id: int,
    source_local_id: str,
) -> Project | None:
    return session.exec(
        select(Project).where(
            Project.user_id == user_id,
            Project.source_local_id == source_local_id,
        )
    ).one_or_none()


def _add_import_checklist_items(
    session: Session,
    project_id: int,
    import_data: LocalProjectImport,
) -> None:
    for item in import_data.checklist_items:
        session.add(
            ChecklistItem(
                project_id=project_id,
                **item.model_dump(),
            )
        )


def _add_import_memos(
    session: Session,
    project_id: int,
    import_data: LocalProjectImport,
) -> None:
    for memo in import_data.memos:
        session.add(
            ProjectMemo(
                project_id=project_id,
                **memo.model_dump(),
            )
        )


def import_local_project(
    session: Session,
    user_id: int,
    import_data: LocalProjectImport,
) -> tuple[ProjectRead, bool]:
    existing = get_project_by_source_local_id(
        session,
        user_id,
        import_data.source_local_id,
    )
    if existing is not None:
        assert existing.id is not None
        summary = get_project_summary(session, user_id, existing.id)
        assert summary is not None
        return summary, False

    project_fields = import_data.model_dump(
        exclude={"source_local_id", "checklist_items", "memos"}
    )
    project = Project(
        user_id=user_id,
        source_local_id=import_data.source_local_id,
        **project_fields,
    )

    try:
        session.add(project)
        session.flush()
        assert project.id is not None
        _add_import_checklist_items(session, project.id, import_data)
        _add_import_memos(session, project.id, import_data)
        session.commit()
        session.refresh(project)
    except IntegrityError:
        session.rollback()
        existing = get_project_by_source_local_id(
            session,
            user_id,
            import_data.source_local_id,
        )
        if existing is None:
            raise
        assert existing.id is not None
        summary = get_project_summary(session, user_id, existing.id)
        assert summary is not None
        return summary, False
    except Exception:
        session.rollback()
        raise

    assert project.id is not None
    summary = get_project_summary(session, user_id, project.id)
    assert summary is not None
    return summary, True


def get_project(session: Session, user_id: int, project_id: int) -> Project | None:
    statement = select(Project).where(
        Project.id == project_id,
        Project.user_id == user_id,
    )
    return session.exec(statement).one_or_none()


def get_source_content_idea(
    session: Session,
    user_id: int,
    project_id: int,
) -> ContentIdeaRead | None:
    idea = session.exec(
        select(ContentIdea).where(
            ContentIdea.user_id == user_id,
            ContentIdea.converted_project_id == project_id,
        )
    ).one_or_none()
    return to_content_idea_read(idea) if idea is not None else None


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
    linked_ideas = session.exec(
        select(ContentIdea).where(
            ContentIdea.user_id == project.user_id,
            ContentIdea.converted_project_id == project.id,
        )
    ).all()
    for idea in linked_ideas:
        idea.converted_project_id = None
        idea.status = ContentIdeaStatus.READY
        idea.updated_at = utc_now()
        session.add(idea)
    for child_model in (ChecklistItem, SavedReference, SavedBroll, ProjectMemo):
        session.exec(
            delete(child_model).where(child_model.project_id == project.id)
        )
    session.delete(project)
    session.commit()

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import DevelopmentUserDependency, SessionDependency
from app.api.routes.projects import OwnedProjectDependency
from app.models.project_memo import ProjectMemo
from app.schemas.project_memo import (
    ProjectMemoCreate,
    ProjectMemoRead,
    ProjectMemoUpdate,
)
from app.services import project_memos as project_memo_service


router = APIRouter(tags=["Project Memos"])


def get_owned_project_memo_or_404(
    memo_id: int,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> ProjectMemo:
    assert user.id is not None
    memo = project_memo_service.get_owned_project_memo(
        session,
        user.id,
        memo_id,
    )
    if memo is None:
        raise HTTPException(status_code=404, detail="Project memo not found")
    return memo


OwnedProjectMemoDependency = Annotated[
    ProjectMemo,
    Depends(get_owned_project_memo_or_404),
]


@router.get(
    "/api/projects/{project_id}/memos",
    response_model=list[ProjectMemoRead],
)
def read_project_memos(
    project: OwnedProjectDependency,
    session: SessionDependency,
) -> list[ProjectMemo]:
    assert project.id is not None
    return project_memo_service.list_project_memos(session, project.id)


@router.post(
    "/api/projects/{project_id}/memos",
    response_model=ProjectMemoRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_memo(
    memo_create: ProjectMemoCreate,
    project: OwnedProjectDependency,
    session: SessionDependency,
) -> ProjectMemo:
    assert project.id is not None
    return project_memo_service.create_project_memo(
        session,
        project.id,
        memo_create,
    )


@router.patch(
    "/api/project-memos/{memo_id}",
    response_model=ProjectMemoRead,
)
def update_project_memo(
    memo_update: ProjectMemoUpdate,
    session: SessionDependency,
    memo: OwnedProjectMemoDependency,
) -> ProjectMemo:
    if not memo_update.model_fields_set:
        raise HTTPException(status_code=400, detail="Request body must not be empty")
    return project_memo_service.update_project_memo(
        session,
        memo,
        memo_update,
    )


@router.delete(
    "/api/project-memos/{memo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_memo(
    session: SessionDependency,
    memo: OwnedProjectMemoDependency,
) -> Response:
    project_memo_service.delete_project_memo(session, memo)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

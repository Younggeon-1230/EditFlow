from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import DevelopmentUserDependency, SessionDependency
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services import projects as project_service


router = APIRouter(prefix="/api/projects", tags=["Projects"])


def get_owned_project_or_404(
    project_id: int,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> Project:
    assert user.id is not None
    project = project_service.get_project(session, user.id, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


OwnedProjectDependency = Annotated[Project, Depends(get_owned_project_or_404)]


@router.get("", response_model=list[ProjectRead])
def read_projects(
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> list[Project]:
    assert user.id is not None
    return project_service.list_projects(session, user.id)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    project_create: ProjectCreate,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> Project:
    assert user.id is not None
    return project_service.create_project(session, user.id, project_create)


@router.get("/{project_id}", response_model=ProjectRead)
def read_project(project: OwnedProjectDependency) -> Project:
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_update: ProjectUpdate,
    session: SessionDependency,
    project: OwnedProjectDependency,
) -> Project:
    if not project_update.model_fields_set:
        raise HTTPException(status_code=400, detail="Request body must not be empty")
    return project_service.update_project(session, project, project_update)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    session: SessionDependency,
    project: OwnedProjectDependency,
) -> Response:
    project_service.delete_project(session, project)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

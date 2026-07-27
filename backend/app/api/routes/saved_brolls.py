from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import DevelopmentUserDependency, SessionDependency
from app.api.routes.projects import OwnedProjectDependency
from app.models.saved_broll import SavedBroll
from app.schemas.saved_broll import (
    SavedBrollCreate,
    SavedBrollRead,
    SavedBrollUpdate,
)
from app.services import saved_brolls as saved_broll_service


router = APIRouter(tags=["Saved B-rolls"])


def get_owned_saved_broll_or_404(
    broll_id: int,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> SavedBroll:
    assert user.id is not None
    broll = saved_broll_service.get_owned_saved_broll(
        session,
        user.id,
        broll_id,
    )
    if broll is None:
        raise HTTPException(status_code=404, detail="Saved B-roll not found")
    return broll


OwnedSavedBrollDependency = Annotated[
    SavedBroll,
    Depends(get_owned_saved_broll_or_404),
]


@router.get(
    "/api/projects/{project_id}/brolls",
    response_model=list[SavedBrollRead],
)
def read_saved_brolls(
    project: OwnedProjectDependency,
    session: SessionDependency,
) -> list[SavedBroll]:
    assert project.id is not None
    return saved_broll_service.list_saved_brolls(session, project.id)


@router.post(
    "/api/projects/{project_id}/brolls",
    response_model=SavedBrollRead,
    status_code=status.HTTP_201_CREATED,
)
def create_saved_broll(
    broll_create: SavedBrollCreate,
    project: OwnedProjectDependency,
    session: SessionDependency,
) -> SavedBroll:
    assert project.id is not None
    try:
        return saved_broll_service.create_saved_broll(
            session,
            project.id,
            broll_create,
        )
    except saved_broll_service.DuplicateSavedBrollError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="B-roll already saved for this project",
        ) from exc


@router.patch(
    "/api/brolls/{broll_id}",
    response_model=SavedBrollRead,
)
def update_saved_broll(
    broll_update: SavedBrollUpdate,
    session: SessionDependency,
    broll: OwnedSavedBrollDependency,
) -> SavedBroll:
    if not broll_update.model_fields_set:
        raise HTTPException(status_code=400, detail="Request body must not be empty")
    return saved_broll_service.update_saved_broll(
        session,
        broll,
        broll_update,
    )


@router.delete(
    "/api/brolls/{broll_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_saved_broll(
    session: SessionDependency,
    broll: OwnedSavedBrollDependency,
) -> Response:
    saved_broll_service.delete_saved_broll(session, broll)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

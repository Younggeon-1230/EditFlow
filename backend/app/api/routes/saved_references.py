from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import DevelopmentUserDependency, SessionDependency
from app.api.routes.projects import OwnedProjectDependency
from app.models.saved_reference import SavedReference
from app.schemas.saved_reference import (
    SavedReferenceCreate,
    SavedReferenceRead,
    SavedReferenceUpdate,
)
from app.services import saved_references as saved_reference_service


router = APIRouter(tags=["Saved References"])


def get_owned_saved_reference_or_404(
    reference_id: int,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> SavedReference:
    assert user.id is not None
    reference = saved_reference_service.get_owned_saved_reference(
        session,
        user.id,
        reference_id,
    )
    if reference is None:
        raise HTTPException(status_code=404, detail="Saved reference not found")
    return reference


OwnedSavedReferenceDependency = Annotated[
    SavedReference,
    Depends(get_owned_saved_reference_or_404),
]


@router.get(
    "/api/projects/{project_id}/references",
    response_model=list[SavedReferenceRead],
)
def read_saved_references(
    project: OwnedProjectDependency,
    session: SessionDependency,
) -> list[SavedReference]:
    assert project.id is not None
    return saved_reference_service.list_saved_references(session, project.id)


@router.post(
    "/api/projects/{project_id}/references",
    response_model=SavedReferenceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_saved_reference(
    reference_create: SavedReferenceCreate,
    project: OwnedProjectDependency,
    session: SessionDependency,
) -> SavedReference:
    assert project.id is not None
    try:
        return saved_reference_service.create_saved_reference(
            session,
            project.id,
            reference_create,
        )
    except saved_reference_service.DuplicateSavedReferenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reference already saved for this project",
        ) from exc


@router.patch(
    "/api/references/{reference_id}",
    response_model=SavedReferenceRead,
)
def update_saved_reference(
    reference_update: SavedReferenceUpdate,
    session: SessionDependency,
    reference: OwnedSavedReferenceDependency,
) -> SavedReference:
    if not reference_update.model_fields_set:
        raise HTTPException(status_code=400, detail="Request body must not be empty")
    return saved_reference_service.update_saved_reference(
        session,
        reference,
        reference_update,
    )


@router.delete(
    "/api/references/{reference_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_saved_reference(
    session: SessionDependency,
    reference: OwnedSavedReferenceDependency,
) -> Response:
    saved_reference_service.delete_saved_reference(session, reference)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

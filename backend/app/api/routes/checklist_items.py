from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import DevelopmentUserDependency, SessionDependency
from app.api.routes.projects import OwnedProjectDependency
from app.models.checklist_item import ChecklistItem
from app.schemas.checklist_item import (
    ChecklistItemCreate,
    ChecklistItemRead,
    ChecklistItemUpdate,
)
from app.services import checklist_items as checklist_item_service


router = APIRouter(tags=["Checklist Items"])


def get_owned_checklist_item_or_404(
    item_id: int,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> ChecklistItem:
    assert user.id is not None
    item = checklist_item_service.get_owned_checklist_item(
        session,
        user.id,
        item_id,
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return item


OwnedChecklistItemDependency = Annotated[
    ChecklistItem,
    Depends(get_owned_checklist_item_or_404),
]


@router.get(
    "/api/projects/{project_id}/checklist-items",
    response_model=list[ChecklistItemRead],
)
def read_checklist_items(
    project: OwnedProjectDependency,
    session: SessionDependency,
) -> list[ChecklistItem]:
    assert project.id is not None
    return checklist_item_service.list_checklist_items(session, project.id)


@router.post(
    "/api/projects/{project_id}/checklist-items",
    response_model=ChecklistItemRead,
    status_code=status.HTTP_201_CREATED,
)
def create_checklist_item(
    item_create: ChecklistItemCreate,
    project: OwnedProjectDependency,
    session: SessionDependency,
) -> ChecklistItem:
    assert project.id is not None
    return checklist_item_service.create_checklist_item(
        session,
        project.id,
        item_create,
    )


@router.patch(
    "/api/checklist-items/{item_id}",
    response_model=ChecklistItemRead,
)
def update_checklist_item(
    item_update: ChecklistItemUpdate,
    session: SessionDependency,
    item: OwnedChecklistItemDependency,
) -> ChecklistItem:
    if not item_update.model_fields_set:
        raise HTTPException(status_code=400, detail="Request body must not be empty")
    return checklist_item_service.update_checklist_item(
        session,
        item,
        item_update,
    )


@router.delete(
    "/api/checklist-items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_checklist_item(
    session: SessionDependency,
    item: OwnedChecklistItemDependency,
) -> Response:
    checklist_item_service.delete_checklist_item(session, item)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

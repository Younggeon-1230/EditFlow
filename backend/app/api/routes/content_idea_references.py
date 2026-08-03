from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import DevelopmentUserDependency, SessionDependency
from app.api.routes.content_ideas import OwnedContentIdeaDependency
from app.models.content_idea_reference import ContentIdeaReference
from app.schemas.content_idea_reference import (
    ContentIdeaReferenceCreate,
    ContentIdeaReferenceRead,
    ContentIdeaReferenceUpdate,
)
from app.services import content_idea_references as service


router = APIRouter(tags=["Content Idea References"])


def get_owned_reference_or_404(
    reference_id: int,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> ContentIdeaReference:
    assert user.id is not None
    reference = service.get_owned_content_idea_reference(session, user.id, reference_id)
    if reference is None:
        raise HTTPException(status_code=404, detail="Content idea reference not found")
    return reference


OwnedReferenceDependency = Annotated[ContentIdeaReference, Depends(get_owned_reference_or_404)]


@router.get("/api/content-ideas/{idea_id}/references", response_model=list[ContentIdeaReferenceRead])
def read_references(
    idea: OwnedContentIdeaDependency,
    session: SessionDependency,
) -> list[ContentIdeaReference]:
    assert idea.id is not None
    return service.list_content_idea_references(session, idea.id)


@router.post(
    "/api/content-ideas/{idea_id}/references",
    response_model=ContentIdeaReferenceRead,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"description": "Reference already saved for this content idea"}},
)
def create_reference(
    data: ContentIdeaReferenceCreate,
    idea: OwnedContentIdeaDependency,
    session: SessionDependency,
) -> ContentIdeaReference:
    assert idea.id is not None
    try:
        return service.create_content_idea_reference(session, idea.id, data)
    except service.DuplicateContentIdeaReferenceError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 이 콘텐츠 소재에 저장된 레퍼런스입니다.",
        ) from error


@router.patch("/api/content-idea-references/{reference_id}", response_model=ContentIdeaReferenceRead)
def update_reference(
    data: ContentIdeaReferenceUpdate,
    session: SessionDependency,
    reference: OwnedReferenceDependency,
) -> ContentIdeaReference:
    if not data.model_fields_set:
        raise HTTPException(status_code=400, detail="Request body must not be empty")
    return service.update_content_idea_reference(session, reference, data)


@router.delete("/api/content-idea-references/{reference_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reference(
    session: SessionDependency,
    reference: OwnedReferenceDependency,
) -> Response:
    service.delete_content_idea_reference(session, reference)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

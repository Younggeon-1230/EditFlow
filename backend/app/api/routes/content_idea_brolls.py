from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import DevelopmentUserDependency, SessionDependency
from app.api.routes.content_ideas import OwnedContentIdeaDependency
from app.models.content_idea_broll import ContentIdeaBroll
from app.schemas.content_idea_broll import (
    ContentIdeaBrollCreate,
    ContentIdeaBrollRead,
    ContentIdeaBrollUpdate,
)
from app.services import content_idea_brolls as service


router = APIRouter(tags=["Content Idea B-rolls"])


def get_owned_broll_or_404(
    broll_id: int,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> ContentIdeaBroll:
    assert user.id is not None
    broll = service.get_owned_content_idea_broll(session, user.id, broll_id)
    if broll is None:
        raise HTTPException(status_code=404, detail="Content idea B-roll not found")
    return broll


OwnedBrollDependency = Annotated[ContentIdeaBroll, Depends(get_owned_broll_or_404)]


@router.get("/api/content-ideas/{idea_id}/brolls", response_model=list[ContentIdeaBrollRead])
def read_brolls(
    idea: OwnedContentIdeaDependency,
    session: SessionDependency,
) -> list[ContentIdeaBroll]:
    assert idea.id is not None
    return service.list_content_idea_brolls(session, idea.id)


@router.post(
    "/api/content-ideas/{idea_id}/brolls",
    response_model=ContentIdeaBrollRead,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"description": "B-roll already saved for this content idea"}},
)
def create_broll(
    data: ContentIdeaBrollCreate,
    idea: OwnedContentIdeaDependency,
    session: SessionDependency,
) -> ContentIdeaBroll:
    assert idea.id is not None
    try:
        return service.create_content_idea_broll(session, idea.id, data)
    except service.DuplicateContentIdeaBrollError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 이 콘텐츠 소재에 저장된 B-roll입니다.",
        ) from error


@router.patch("/api/content-idea-brolls/{broll_id}", response_model=ContentIdeaBrollRead)
def update_broll(
    data: ContentIdeaBrollUpdate,
    session: SessionDependency,
    broll: OwnedBrollDependency,
) -> ContentIdeaBroll:
    if not data.model_fields_set:
        raise HTTPException(status_code=400, detail="Request body must not be empty")
    return service.update_content_idea_broll(session, broll, data)


@router.delete("/api/content-idea-brolls/{broll_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_broll(
    session: SessionDependency,
    broll: OwnedBrollDependency,
) -> Response:
    service.delete_content_idea_broll(session, broll)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

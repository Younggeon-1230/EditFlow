from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.dependencies import DevelopmentUserDependency, SessionDependency
from app.models.content_idea import (
    ContentIdea,
    ContentIdeaSource,
    ContentIdeaStatus,
    ContentPlatform,
    ContentPriority,
)
from app.schemas.content_idea import (
    ContentIdeaCreate,
    ContentIdeaRead,
    ContentIdeaUpdate,
)
from app.services import content_ideas as content_idea_service


router = APIRouter(prefix="/api/content-ideas", tags=["Content Ideas"])


def get_owned_content_idea_or_404(
    idea_id: int,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> ContentIdea:
    assert user.id is not None
    idea = content_idea_service.get_content_idea(
        session,
        user.id,
        idea_id,
    )
    if idea is None:
        raise HTTPException(status_code=404, detail="콘텐츠 소재를 찾을 수 없습니다.")
    return idea


OwnedContentIdeaDependency = Annotated[
    ContentIdea,
    Depends(get_owned_content_idea_or_404),
]


@router.get("", response_model=list[ContentIdeaRead])
def read_content_ideas(
    session: SessionDependency,
    user: DevelopmentUserDependency,
    status_filter: Annotated[
        ContentIdeaStatus | None,
        Query(alias="status"),
    ] = None,
    platform: ContentPlatform | None = None,
    priority: ContentPriority | None = None,
    source: ContentIdeaSource | None = None,
    search: Annotated[str | None, Query(max_length=5000)] = None,
) -> list[ContentIdeaRead]:
    assert user.id is not None
    return content_idea_service.list_content_ideas(
        session,
        user.id,
        status=status_filter,
        platform=platform,
        priority=priority,
        source=source,
        search=search,
    )


@router.post(
    "",
    response_model=ContentIdeaRead,
    status_code=status.HTTP_201_CREATED,
)
def create_content_idea(
    idea_create: ContentIdeaCreate,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> ContentIdeaRead:
    assert user.id is not None
    return content_idea_service.create_content_idea(
        session,
        user.id,
        idea_create,
    )


@router.get("/{idea_id}", response_model=ContentIdeaRead)
def read_content_idea(
    idea: OwnedContentIdeaDependency,
) -> ContentIdeaRead:
    return content_idea_service.to_content_idea_read(idea)


@router.patch("/{idea_id}", response_model=ContentIdeaRead)
def update_content_idea(
    idea_update: ContentIdeaUpdate,
    session: SessionDependency,
    idea: OwnedContentIdeaDependency,
) -> ContentIdeaRead:
    if not idea_update.model_fields_set:
        raise HTTPException(
            status_code=400,
            detail="수정할 콘텐츠 소재 내용이 없습니다.",
        )
    return content_idea_service.update_content_idea(
        session,
        idea,
        idea_update,
    )


@router.delete("/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_content_idea(
    session: SessionDependency,
    idea: OwnedContentIdeaDependency,
) -> Response:
    content_idea_service.delete_content_idea(session, idea)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

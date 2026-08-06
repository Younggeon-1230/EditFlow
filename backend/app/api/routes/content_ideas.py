import logging
import time
from typing import Annotated

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.dependencies import (
    ContentRecommendationProviderDependency,
    DevelopmentUserDependency,
    SessionDependency,
    SettingsDependency,
)
from app.models.content_idea import (
    ContentIdea,
    ContentIdeaSource,
    ContentIdeaSort,
    ContentIdeaStatus,
    ContentPlatform,
    ContentPriority,
)
from app.schemas.content_idea import (
    ContentIdeaCreate,
    ContentIdeaConversionCreate,
    ContentIdeaConversionRead,
    ContentIdeaRead,
    ContentIdeaSummaryRead,
    ContentIdeaUpdate,
)
from app.schemas.content_idea_recommendation import (
    ContentIdeaRecommendationRequest,
    ContentIdeaRecommendationResponse,
    SaveContentIdeaRecommendationRequest,
)
from app.services import content_ideas as content_idea_service
from app.services import content_idea_recommendations as recommendation_service


router = APIRouter(prefix="/api/content-ideas", tags=["Content Ideas"])
logger = logging.getLogger(__name__)


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
    sort: ContentIdeaSort = ContentIdeaSort.CREATED_DESC,
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
        sort=sort,
    )


@router.get("/summary", response_model=ContentIdeaSummaryRead)
def read_content_idea_summary(
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> ContentIdeaSummaryRead:
    assert user.id is not None
    return content_idea_service.get_content_idea_summary(session, user.id)


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


@router.post(
    "/recommendations",
    response_model=ContentIdeaRecommendationResponse,
)
async def recommend_content_ideas(
    recommendation_request: ContentIdeaRecommendationRequest,
    session: SessionDependency,
    user: DevelopmentUserDependency,
    provider: ContentRecommendationProviderDependency,
    settings: SettingsDependency,
) -> ContentIdeaRecommendationResponse:
    assert user.id is not None
    request_id = uuid4()
    started_at = time.monotonic()
    try:
        result = await recommendation_service.generate_recommendations(
            session,
            user.id,
            recommendation_request,
            provider,
            settings,
            request_id,
        )
    except recommendation_service.RecommendationServiceError as error:
        logger.warning(
            "content idea recommendation request failed",
            extra={
                "request_id": str(request_id),
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "prompt_version": settings.llm_prompt_version,
                "duration_ms": round((time.monotonic() - started_at) * 1000),
                "error_code": error.code,
            },
        )
        raise HTTPException(
            status_code=error.status_code,
            detail={
                "code": error.code,
                "message": error.message,
                "retryable": error.retryable,
                "request_id": str(request_id),
            },
        ) from error
    logger.info(
        "content idea recommendations generated",
        extra={
            "request_id": str(request_id),
            "provider": settings.llm_provider,
            "model": settings.llm_model,
            "prompt_version": settings.llm_prompt_version,
            "duration_ms": round((time.monotonic() - started_at) * 1000),
            "generated_count": result.generated_count,
            "discarded_count": result.discarded_count,
        },
    )
    return result


@router.post(
    "/recommendations/save",
    response_model=ContentIdeaRead,
    status_code=status.HTTP_201_CREATED,
)
def save_content_idea_recommendation(
    save_request: SaveContentIdeaRecommendationRequest,
    session: SessionDependency,
    user: DevelopmentUserDependency,
    settings: SettingsDependency,
) -> ContentIdeaRead:
    assert user.id is not None
    request_id = uuid4()
    try:
        return recommendation_service.save_recommendation(
            session,
            user.id,
            save_request.save_token,
            settings,
        )
    except recommendation_service.RecommendationServiceError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={
                "code": error.code,
                "message": error.message,
                "retryable": error.retryable,
                "request_id": str(request_id),
            },
        ) from error


@router.post(
    "/{idea_id}/convert-to-project",
    response_model=ContentIdeaConversionRead,
    status_code=status.HTTP_201_CREATED,
)
def convert_content_idea_to_project(
    idea_id: int,
    conversion: ContentIdeaConversionCreate,
    session: SessionDependency,
    user: DevelopmentUserDependency,
) -> ContentIdeaConversionRead:
    assert user.id is not None
    try:
        project, idea = content_idea_service.convert_content_idea_to_project(
            session,
            user.id,
            idea_id,
            conversion,
        )
    except content_idea_service.ContentIdeaNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail="콘텐츠 소재를 찾을 수 없습니다.",
        ) from error
    except content_idea_service.ContentIdeaConversionConflictError as error:
        message = (
            "보관된 콘텐츠 소재는 프로젝트로 전환할 수 없습니다."
            if error.reason == "archived"
            else "이미 프로젝트로 전환된 콘텐츠 소재입니다."
        )
        raise HTTPException(status_code=409, detail=message) from error
    return ContentIdeaConversionRead(project=project, content_idea=idea)


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

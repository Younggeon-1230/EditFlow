from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies import (
    ExternalHttpClientDependency,
    SettingsDependency,
)
from app.schemas.external import (
    PexelsSearchParams,
    PexelsSearchResponse,
    YouTubeSearchParams,
    YouTubeSearchResponse,
)
from app.services import pexels as pexels_service
from app.services import youtube as youtube_service


router = APIRouter(prefix="/api/external", tags=["External"])


@router.get(
    "/youtube/search",
    response_model=YouTubeSearchResponse,
)
async def search_youtube(
    search_params: Annotated[YouTubeSearchParams, Query()],
    client: ExternalHttpClientDependency,
    settings: SettingsDependency,
) -> YouTubeSearchResponse:
    try:
        return await youtube_service.search_youtube(
            client,
            settings,
            search_params,
        )
    except youtube_service.YouTubeConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YouTube API 키가 설정되지 않았습니다.",
        ) from exc
    except youtube_service.YouTubeTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="YouTube 검색 요청 시간이 초과되었습니다.",
        ) from exc
    except youtube_service.YouTubeConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="YouTube 검색 서비스에 연결할 수 없습니다.",
        ) from exc
    except youtube_service.YouTubeQuotaError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="YouTube API 할당량을 초과했습니다.",
        ) from exc
    except youtube_service.YouTubeAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="YouTube 검색 서비스가 올바르게 응답하지 않았습니다.",
        ) from exc


@router.get(
    "/pexels/search",
    response_model=PexelsSearchResponse,
)
async def search_pexels(
    search_params: Annotated[PexelsSearchParams, Query()],
    client: ExternalHttpClientDependency,
    settings: SettingsDependency,
) -> PexelsSearchResponse:
    try:
        return await pexels_service.search_pexels(
            client,
            settings,
            search_params,
        )
    except pexels_service.PexelsConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pexels API 키가 설정되지 않았습니다.",
        ) from exc
    except pexels_service.PexelsTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Pexels 검색 요청 시간이 초과되었습니다.",
        ) from exc
    except pexels_service.PexelsConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Pexels 검색 서비스에 연결할 수 없습니다.",
        ) from exc
    except pexels_service.PexelsAuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pexels API 키 설정 또는 권한을 확인해 주세요.",
        ) from exc
    except pexels_service.PexelsRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Pexels API 요청 한도를 초과했습니다.",
        ) from exc
    except pexels_service.PexelsAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Pexels 검색 서비스가 올바르게 응답하지 않았습니다.",
        ) from exc

import logging
from html import unescape
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx

from app.core.cache import TTLCache
from app.core.config import Settings, get_settings
from app.schemas.external import (
    PexelsSearchParams,
    PexelsSearchResponse,
    PexelsVideoItem,
)


logger = logging.getLogger(__name__)
PEXELS_VIDEO_SEARCH_URL = "https://api.pexels.com/v1/videos/search"


class PexelsConfigurationError(Exception):
    pass


class PexelsTimeoutError(Exception):
    pass


class PexelsConnectionError(Exception):
    pass


class PexelsAuthenticationError(Exception):
    pass


class PexelsRateLimitError(Exception):
    pass


class PexelsAPIError(Exception):
    pass


_initial_settings = get_settings()
pexels_search_cache: TTLCache[tuple[object, ...], PexelsSearchResponse] = TTLCache(
    max_entries=_initial_settings.external_api_cache_max_entries
)


async def search_pexels(
    client: httpx.AsyncClient,
    settings: Settings,
    search_params: PexelsSearchParams,
) -> PexelsSearchResponse:
    api_key = (settings.pexels_api_key or "").strip()
    if not api_key:
        raise PexelsConfigurationError

    cache_key = (
        "pexels",
        search_params.query.casefold(),
        search_params.per_page,
        search_params.page,
        search_params.orientation,
        search_params.size,
    )
    cached_response = pexels_search_cache.get(cache_key)
    if cached_response is not None:
        return cached_response.model_copy(
            update={"cached": True},
            deep=True,
        )

    request_params: dict[str, str | int] = {
        "query": search_params.query,
        "per_page": search_params.per_page,
        "page": search_params.page,
    }
    if search_params.orientation is not None:
        request_params["orientation"] = search_params.orientation
    if search_params.size is not None:
        request_params["size"] = search_params.size

    try:
        response = await client.get(
            PEXELS_VIDEO_SEARCH_URL,
            params=request_params,
            headers={"Authorization": api_key},
        )
    except httpx.TimeoutException as exc:
        logger.warning("Pexels request failed exception=timeout")
        raise PexelsTimeoutError from exc
    except httpx.RequestError as exc:
        logger.warning(
            "Pexels request failed exception=%s",
            type(exc).__name__,
        )
        raise PexelsConnectionError from exc

    if response.status_code >= 400:
        logger.warning("Pexels request failed status=%s", response.status_code)
        if response.status_code in (401, 403):
            raise PexelsAuthenticationError
        if response.status_code == 429:
            raise PexelsRateLimitError
        raise PexelsAPIError

    try:
        payload = response.json()
    except ValueError as exc:
        logger.warning("Pexels response parsing failed exception=invalid_json")
        raise PexelsAPIError from exc
    if not isinstance(payload, dict):
        raise PexelsAPIError

    search_response = _transform_pexels_response(payload, search_params)
    pexels_search_cache.set(
        cache_key,
        search_response.model_copy(deep=True),
        settings.external_api_cache_ttl_seconds,
    )
    return search_response


def _transform_pexels_response(
    payload: dict[str, Any],
    search_params: PexelsSearchParams,
) -> PexelsSearchResponse:
    items: list[PexelsVideoItem] = []
    raw_videos = payload.get("videos")
    if isinstance(raw_videos, list):
        for raw_video in raw_videos:
            parsed_video = _parse_pexels_video(raw_video)
            if parsed_video is not None:
                items.append(parsed_video)

    page = _positive_int(payload.get("page")) or search_params.page
    per_page = _positive_int(payload.get("per_page")) or search_params.per_page
    return PexelsSearchResponse(
        items=items,
        page=page,
        per_page=per_page,
        total_results=_nonnegative_int(payload.get("total_results")),
        next_page=_page_from_link(payload.get("next_page"), page + 1),
        prev_page=_page_from_link(payload.get("prev_page"), max(page - 1, 1)),
        cached=False,
    )


def _parse_pexels_video(raw_video: object) -> PexelsVideoItem | None:
    if not isinstance(raw_video, dict):
        return None
    raw_id = raw_video.get("id")
    if isinstance(raw_id, bool) or not isinstance(raw_id, (int, str)):
        return None
    external_id = str(raw_id).strip()
    url = _https_url(raw_video.get("url"))
    if not external_id or url is None:
        return None

    user = raw_video.get("user")
    creator_name = (
        _optional_text(user.get("name")) if isinstance(user, dict) else None
    )
    title = _optional_text(raw_video.get("title"))
    return PexelsVideoItem(
        external_id=external_id,
        title=unescape(title) if title is not None else None,
        url=url,
        preview_url=_select_preview_url(raw_video.get("video_files")),
        thumbnail_url=_https_url(raw_video.get("image")),
        creator_name=(
            unescape(creator_name) if creator_name is not None else None
        ),
        duration_seconds=_nonnegative_int(raw_video.get("duration")),
        width=_positive_int(raw_video.get("width")),
        height=_positive_int(raw_video.get("height")),
    )


def _select_preview_url(raw_files: object) -> str | None:
    if not isinstance(raw_files, list):
        return None
    candidates: list[tuple[str, int | None, int | None]] = []
    for raw_file in raw_files:
        if not isinstance(raw_file, dict):
            continue
        file_type = raw_file.get("file_type")
        if not isinstance(file_type, str) or file_type.casefold() != "video/mp4":
            continue
        link = _https_url(raw_file.get("link"))
        if link is None:
            continue
        candidates.append(
            (
                link,
                _positive_int(raw_file.get("width")),
                _positive_int(raw_file.get("height")),
            )
        )
    if not candidates:
        return None

    reasonable = [
        candidate
        for candidate in candidates
        if candidate[1] is not None
        and candidate[2] is not None
        and candidate[1] <= 1920
        and candidate[2] <= 1080
    ]
    if reasonable:
        return max(reasonable, key=_pixel_count)[0]

    measured = [
        candidate
        for candidate in candidates
        if candidate[1] is not None and candidate[2] is not None
    ]
    if measured:
        return min(measured, key=_pixel_count)[0]
    return candidates[0][0]


def _pixel_count(candidate: tuple[str, int | None, int | None]) -> int:
    return (candidate[1] or 0) * (candidate[2] or 0)


def _page_from_link(value: object, fallback: int) -> int | None:
    text = _optional_text(value)
    if text is None:
        return None
    parsed_page = parse_qs(urlparse(text).query).get("page")
    if parsed_page:
        try:
            page = int(parsed_page[0])
        except ValueError:
            page = 0
        if page >= 1:
            return page
    return fallback


def _optional_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _https_url(value: object) -> str | None:
    text = _optional_text(value)
    if text is None:
        return None
    parsed = urlparse(text)
    return text if parsed.scheme == "https" and parsed.netloc else None


def _nonnegative_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    return None


def _positive_int(value: object) -> int | None:
    parsed = _nonnegative_int(value)
    return parsed if parsed is not None and parsed >= 1 else None

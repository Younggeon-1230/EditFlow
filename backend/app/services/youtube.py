import logging
from datetime import datetime
from html import unescape
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.cache import TTLCache
from app.core.config import Settings, get_settings
from app.schemas.external import (
    YouTubeSearchItem,
    YouTubeSearchParams,
    YouTubeSearchResponse,
)


logger = logging.getLogger(__name__)
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


class YouTubeConfigurationError(Exception):
    pass


class YouTubeTimeoutError(Exception):
    pass


class YouTubeConnectionError(Exception):
    pass


class YouTubeQuotaError(Exception):
    pass


class YouTubeAPIError(Exception):
    pass


_initial_settings = get_settings()
youtube_search_cache: TTLCache[tuple[object, ...], YouTubeSearchResponse] = TTLCache(
    max_entries=_initial_settings.external_api_cache_max_entries
)


async def search_youtube(
    client: httpx.AsyncClient,
    settings: Settings,
    search_params: YouTubeSearchParams,
) -> YouTubeSearchResponse:
    api_key = (settings.youtube_api_key or "").strip()
    if not api_key:
        raise YouTubeConfigurationError

    cache_key = (
        "youtube",
        search_params.query.casefold(),
        search_params.order,
        search_params.max_results,
        search_params.page_token,
    )
    cached_response = youtube_search_cache.get(cache_key)
    if cached_response is not None:
        return cached_response.model_copy(
            update={"cached": True},
            deep=True,
        )

    request_params: dict[str, str | int] = {
        "part": "snippet",
        "type": "video",
        "q": search_params.query,
        "order": search_params.order,
        "maxResults": search_params.max_results,
        "key": api_key,
    }
    if search_params.page_token is not None:
        request_params["pageToken"] = search_params.page_token

    try:
        response = await client.get(
            YOUTUBE_SEARCH_URL,
            params=request_params,
        )
    except httpx.TimeoutException as exc:
        logger.warning("YouTube request failed exception=timeout")
        raise YouTubeTimeoutError from exc
    except httpx.RequestError as exc:
        logger.warning(
            "YouTube request failed exception=%s",
            type(exc).__name__,
        )
        raise YouTubeConnectionError from exc

    if response.status_code >= 400:
        logger.warning("YouTube request failed status=%s", response.status_code)
        if response.status_code == 429 or (
            response.status_code == 403 and _is_quota_error(response)
        ):
            raise YouTubeQuotaError
        raise YouTubeAPIError

    try:
        payload = response.json()
    except ValueError as exc:
        logger.warning("YouTube response parsing failed exception=invalid_json")
        raise YouTubeAPIError from exc
    if not isinstance(payload, dict):
        raise YouTubeAPIError

    search_response = _transform_youtube_response(payload)
    youtube_search_cache.set(
        cache_key,
        search_response.model_copy(deep=True),
        settings.external_api_cache_ttl_seconds,
    )
    return search_response


def _transform_youtube_response(payload: dict[str, Any]) -> YouTubeSearchResponse:
    items: list[YouTubeSearchItem] = []
    raw_items = payload.get("items")
    if isinstance(raw_items, list):
        for raw_item in raw_items:
            parsed_item = _parse_youtube_item(raw_item)
            if parsed_item is not None:
                items.append(parsed_item)

    page_info = payload.get("pageInfo")
    total_results = (
        _nonnegative_int(page_info.get("totalResults"))
        if isinstance(page_info, dict)
        else None
    )
    return YouTubeSearchResponse(
        items=items,
        next_page_token=_optional_text(payload.get("nextPageToken")),
        prev_page_token=_optional_text(payload.get("prevPageToken")),
        total_results=total_results,
        cached=False,
    )


def _parse_youtube_item(raw_item: object) -> YouTubeSearchItem | None:
    if not isinstance(raw_item, dict):
        return None
    identifier = raw_item.get("id")
    snippet = raw_item.get("snippet")
    if not isinstance(identifier, dict) or not isinstance(snippet, dict):
        return None

    external_id = _optional_text(identifier.get("videoId"))
    title = _optional_text(snippet.get("title"))
    if external_id is None or title is None:
        return None

    thumbnails = snippet.get("thumbnails")
    thumbnail_url = None
    if isinstance(thumbnails, dict):
        for quality in ("high", "medium", "default"):
            thumbnail = thumbnails.get(quality)
            if isinstance(thumbnail, dict):
                thumbnail_url = _https_url(thumbnail.get("url"))
                if thumbnail_url is not None:
                    break

    description = _optional_text(snippet.get("description"))
    channel_title = _optional_text(snippet.get("channelTitle"))
    return YouTubeSearchItem(
        external_id=external_id,
        title=unescape(title),
        description=unescape(description) if description is not None else None,
        url=f"https://www.youtube.com/watch?v={external_id}",
        thumbnail_url=thumbnail_url,
        channel_title=(
            unescape(channel_title) if channel_title is not None else None
        ),
        published_at=_optional_datetime(snippet.get("publishedAt")),
    )


def _is_quota_error(response: httpx.Response) -> bool:
    try:
        payload = response.json()
    except ValueError:
        return False
    if not isinstance(payload, dict):
        return False
    error = payload.get("error")
    if not isinstance(error, dict):
        return False
    errors = error.get("errors")
    if not isinstance(errors, list):
        return False
    quota_reasons = {
        "dailylimitexceeded",
        "quotaexceeded",
        "ratelimitexceeded",
        "userratelimitexceeded",
    }
    for item in errors:
        if isinstance(item, dict):
            reason = item.get("reason")
            if isinstance(reason, str) and reason.casefold() in quota_reasons:
                return True
    return False


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


def _optional_datetime(value: object) -> datetime | None:
    text = _optional_text(value)
    if text is None:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None

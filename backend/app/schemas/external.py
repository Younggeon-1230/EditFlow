from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.core.config import get_settings


settings = get_settings()


class YouTubeSearchParams(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query: str = Field(min_length=1, max_length=200)
    order: Literal["relevance", "date", "viewCount"] = "relevance"
    max_results: int = Field(
        default=settings.youtube_default_max_results,
        ge=1,
        le=settings.youtube_max_results_limit,
    )
    page_token: str | None = Field(default=None, min_length=1, max_length=500)


class YouTubeSearchItem(BaseModel):
    external_id: str
    title: str
    description: str | None
    url: HttpUrl
    thumbnail_url: HttpUrl | None
    channel_title: str | None
    published_at: datetime | None
    provider: Literal["youtube"] = "youtube"


class YouTubeSearchResponse(BaseModel):
    items: list[YouTubeSearchItem]
    next_page_token: str | None
    prev_page_token: str | None
    total_results: int | None
    cached: bool


class PexelsSearchParams(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query: str = Field(min_length=1, max_length=200)
    per_page: int = Field(
        default=settings.pexels_default_per_page,
        ge=1,
        le=settings.pexels_max_per_page,
    )
    page: int = Field(default=1, ge=1)
    orientation: Literal["landscape", "portrait", "square"] | None = None
    size: Literal["large", "medium", "small"] | None = None


class PexelsVideoItem(BaseModel):
    external_id: str
    title: str | None
    url: HttpUrl
    preview_url: HttpUrl | None
    thumbnail_url: HttpUrl | None
    creator_name: str | None
    duration_seconds: int | None
    width: int | None
    height: int | None
    provider: Literal["pexels"] = "pexels"


class PexelsSearchResponse(BaseModel):
    items: list[PexelsVideoItem]
    page: int
    per_page: int
    total_results: int | None
    next_page: int | None
    prev_page: int | None
    cached: bool

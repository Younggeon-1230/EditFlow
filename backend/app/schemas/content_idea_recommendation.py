from enum import StrEnum
from typing import Any, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.content_idea import ContentIdeaSource, ContentPlatform
from app.schemas.content_idea import normalize_tags


class RecommendationTone(StrEnum):
    INFORMATIVE = "informative"
    FRIENDLY = "friendly"
    PROFESSIONAL = "professional"
    ENERGETIC = "energetic"
    HUMOROUS = "humorous"
    INSPIRATIONAL = "inspirational"


def _blank_to_none(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class ContentIdeaRecommendationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    topic: str = Field(min_length=2, max_length=200)
    platform: ContentPlatform | None = None
    target_audience: str | None = Field(default=None, max_length=500)
    content_format: str | None = Field(default=None, max_length=100)
    tone: RecommendationTone = RecommendationTone.INFORMATIVE
    keywords: list[str] = Field(default_factory=list, max_length=10)
    reference_context: str | None = Field(default=None, max_length=1500)
    recommendation_count: int = Field(default=5, ge=1, le=8)

    _normalize_optional = field_validator(
        "target_audience", "content_format", "reference_context", mode="before"
    )(_blank_to_none)

    @field_validator("keywords", mode="before")
    @classmethod
    def normalize_keywords(cls, value: Any) -> Any:
        if value is None:
            return []
        if not isinstance(value, list):
            return value
        result: list[Any] = []
        seen: set[str] = set()
        for keyword in value:
            if not isinstance(keyword, str):
                result.append(keyword)
                continue
            cleaned = keyword.strip()
            if not cleaned:
                continue
            if len(cleaned) > 50:
                raise ValueError("Each keyword must be at most 50 characters")
            key = cleaned.casefold()
            if key not in seen:
                seen.add(key)
                result.append(cleaned)
        if len(result) > 10:
            raise ValueError("At most 10 keywords are allowed")
        return result


class ProviderRecommendationItem(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    platform: ContentPlatform
    tags: list[str] = Field(default_factory=list)
    target_audience: str | None = Field(default=None, max_length=500)
    content_format: str | None = Field(default=None, max_length=100)
    reason: str = Field(min_length=1, max_length=500)

    _normalize_optional = field_validator(
        "description", "target_audience", "content_format", mode="before"
    )(_blank_to_none)
    _normalize_tags = field_validator("tags", mode="before")(normalize_tags)

    @model_validator(mode="after")
    def limit_tags(self) -> Self:
        if len(self.tags) > 10:
            raise ValueError("At most 10 recommendation tags are allowed")
        return self


class ContentIdeaRecommendationRead(ProviderRecommendationItem):
    client_key: UUID
    source: ContentIdeaSource
    duplicate_warning: bool
    save_token: str


class ContentIdeaRecommendationResponse(BaseModel):
    request_id: UUID
    recommendations: list[ContentIdeaRecommendationRead]
    requested_count: int
    generated_count: int
    discarded_count: int
    prompt_version: str


class SaveContentIdeaRecommendationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    save_token: str = Field(min_length=1, max_length=16384)


class RecommendationTokenPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: int
    user_id: int
    issued_at: int
    expires_at: int
    client_key: UUID
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    platform: ContentPlatform
    tags: list[str]
    target_audience: str | None = Field(default=None, max_length=500)
    content_format: str | None = Field(default=None, max_length=100)

    _normalize_tags = field_validator("tags", mode="before")(normalize_tags)

    @model_validator(mode="after")
    def validate_token_fields(self) -> Self:
        if self.version != 1 or self.expires_at <= self.issued_at:
            raise ValueError("Invalid token metadata")
        return self

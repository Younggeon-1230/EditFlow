from datetime import date, datetime
from typing import Any, Self

from pydantic import ConfigDict, field_validator, model_validator
from sqlmodel import Field, SQLModel

from app.models.content_idea import (
    ContentIdeaSource,
    ContentIdeaStatus,
    ContentPlatform,
    ContentPriority,
)
from app.models.project import ProjectStatus
from app.schemas.project import ProjectRead


def normalize_tags(value: Any) -> Any:
    if value is None:
        return []
    if not isinstance(value, list):
        return value

    normalized: list[str] = []
    seen: set[str] = set()
    for tag in value:
        if not isinstance(tag, str):
            normalized.append(tag)
            continue
        cleaned = tag.strip()
        if not cleaned:
            continue
        if len(cleaned) > 50:
            raise ValueError("Each tag must be at most 50 characters")
        key = cleaned.casefold()
        if key not in seen:
            seen.add(key)
            normalized.append(cleaned)

    if len(normalized) > 20:
        raise ValueError("At most 20 tags are allowed")
    return normalized


class ContentIdeaCreate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    platform: ContentPlatform
    status: ContentIdeaStatus = ContentIdeaStatus.IDEA
    priority: ContentPriority = ContentPriority.MEDIUM
    tags: list[str] = Field(default_factory=list)
    target_audience: str | None = Field(default=None, max_length=500)
    content_format: str | None = Field(default=None, max_length=100)

    _normalize_tags = field_validator("tags", mode="before")(normalize_tags)


class ContentIdeaUpdate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    platform: ContentPlatform | None = None
    status: ContentIdeaStatus | None = None
    priority: ContentPriority | None = None
    tags: list[str] | None = None
    target_audience: str | None = Field(default=None, max_length=500)
    content_format: str | None = Field(default=None, max_length=100)

    _normalize_tags = field_validator("tags", mode="before")(normalize_tags)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        for field_name in ("title", "platform", "status", "priority"):
            is_explicit_null = (
                field_name in self.model_fields_set
                and getattr(self, field_name) is None
            )
            if is_explicit_null:
                raise ValueError(f"{field_name} cannot be null")
        return self


class ContentIdeaRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    description: str | None
    platform: ContentPlatform
    status: ContentIdeaStatus
    priority: ContentPriority
    tags: list[str]
    target_audience: str | None
    content_format: str | None
    source: ContentIdeaSource
    converted_project_id: int | None
    created_at: datetime
    updated_at: datetime


class ContentIdeaStatusCounts(SQLModel):
    idea: int = 0
    researching: int = 0
    ready: int = 0
    converted: int = 0
    archived: int = 0


class ContentIdeaPriorityCounts(SQLModel):
    low: int = 0
    medium: int = 0
    high: int = 0


class ContentIdeaPlatformCounts(SQLModel):
    youtube: int = 0
    shorts: int = 0
    instagram: int = 0
    tiktok: int = 0
    blog: int = 0
    other: int = 0


class ContentIdeaSourceCounts(SQLModel):
    manual: int = 0
    ai: int = 0


class ContentIdeaSummaryRead(SQLModel):
    total: int
    by_status: ContentIdeaStatusCounts
    by_priority: ContentIdeaPriorityCounts
    by_platform: ContentIdeaPlatformCounts
    by_source: ContentIdeaSourceCounts
    converted_count: int
    ready_count: int
    active_count: int
    with_reference_count: int
    with_broll_count: int
    with_any_media_count: int
    latest_updated_at: datetime | None


class ContentIdeaConversionCreate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    status: ProjectStatus = ProjectStatus.PLANNING
    due_date: date | None = None


class ContentIdeaConversionRead(SQLModel):
    project: ProjectRead
    content_idea: ContentIdeaRead

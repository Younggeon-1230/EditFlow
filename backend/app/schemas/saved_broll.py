from datetime import datetime

from pydantic import ConfigDict, HttpUrl
from sqlmodel import Field, SQLModel


class SavedBrollCreate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    external_id: str = Field(min_length=1, max_length=255)
    title: str | None = Field(default=None, min_length=1, max_length=1000)
    url: HttpUrl
    preview_url: HttpUrl | None = None
    thumbnail_url: HttpUrl | None = None
    creator_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=500,
    )
    duration_seconds: int | None = Field(default=None, ge=0)
    width: int | None = Field(default=None, ge=0)
    height: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=5000)


class SavedBrollUpdate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    note: str | None = Field(default=None, max_length=5000)


class SavedBrollRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    provider: str
    external_id: str
    title: str | None
    url: HttpUrl
    preview_url: HttpUrl | None
    thumbnail_url: HttpUrl | None
    creator_name: str | None
    duration_seconds: int | None
    width: int | None
    height: int | None
    note: str | None
    created_at: datetime
    updated_at: datetime

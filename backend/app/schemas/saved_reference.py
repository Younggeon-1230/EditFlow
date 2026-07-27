from datetime import datetime

from pydantic import ConfigDict, HttpUrl
from sqlmodel import Field, SQLModel


class SavedReferenceCreate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    external_id: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=1000)
    url: HttpUrl
    thumbnail_url: HttpUrl | None = None
    channel_title: str | None = Field(
        default=None,
        min_length=1,
        max_length=500,
    )
    published_at: datetime | None = None
    note: str | None = Field(default=None, max_length=5000)


class SavedReferenceUpdate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    note: str | None = Field(default=None, max_length=5000)


class SavedReferenceRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    provider: str
    external_id: str
    title: str
    url: HttpUrl
    thumbnail_url: HttpUrl | None
    channel_title: str | None
    published_at: datetime | None
    note: str | None
    created_at: datetime
    updated_at: datetime

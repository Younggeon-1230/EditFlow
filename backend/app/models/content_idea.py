from datetime import datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlmodel import Field, SQLModel

from app.models.user import utc_now


class ContentPlatform(StrEnum):
    YOUTUBE = "youtube"
    SHORTS = "shorts"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    BLOG = "blog"
    OTHER = "other"


class ContentIdeaStatus(StrEnum):
    IDEA = "idea"
    RESEARCHING = "researching"
    READY = "ready"
    CONVERTED = "converted"
    ARCHIVED = "archived"


class ContentPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ContentIdeaSource(StrEnum):
    MANUAL = "manual"
    AI = "ai"


class ContentIdeaSort(StrEnum):
    CREATED_DESC = "created_desc"
    CREATED_ASC = "created_asc"
    UPDATED_DESC = "updated_desc"
    UPDATED_ASC = "updated_asc"
    PRIORITY_DESC = "priority_desc"
    PRIORITY_ASC = "priority_asc"
    TITLE_ASC = "title_asc"
    TITLE_DESC = "title_desc"


class ContentIdea(SQLModel, table=True):
    __tablename__ = "content_ideas"
    __table_args__ = (
        Index("ix_content_ideas_user_id_status", "user_id", "status"),
        Index("ix_content_ideas_user_id_platform", "user_id", "platform"),
        Index("ix_content_ideas_user_id_priority", "user_id", "priority"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    title: str = Field(sa_column=Column(String(200), nullable=False))
    description: str | None = Field(
        default=None,
        sa_column=Column(String(5000), nullable=True),
    )
    platform: ContentPlatform = Field(sa_column=Column(String(32), nullable=False))
    status: ContentIdeaStatus = Field(
        default=ContentIdeaStatus.IDEA,
        sa_column=Column(
            String(32), nullable=False, server_default=text("'idea'")
        ),
    )
    priority: ContentPriority = Field(
        default=ContentPriority.MEDIUM,
        sa_column=Column(
            String(16), nullable=False, server_default=text("'medium'")
        ),
    )
    tags: str | None = Field(
        default=None,
        sa_column=Column(Text, nullable=True),
    )
    target_audience: str | None = Field(
        default=None,
        sa_column=Column(String(500), nullable=True),
    )
    content_format: str | None = Field(
        default=None,
        sa_column=Column(String(100), nullable=True),
    )
    source: ContentIdeaSource = Field(
        default=ContentIdeaSource.MANUAL,
        sa_column=Column(
            String(16), nullable=False, server_default=text("'manual'")
        ),
    )
    converted_project_id: int | None = Field(
        default=None,
        sa_column=Column(
            Integer,
            ForeignKey("projects.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

from datetime import datetime

from sqlalchemy import Column, DateTime, String, UniqueConstraint, text
from sqlmodel import Field, SQLModel

from app.models.user import utc_now


class ContentIdeaReference(SQLModel, table=True):
    __tablename__ = "content_idea_references"
    __table_args__ = (
        UniqueConstraint(
            "content_idea_id",
            "provider",
            "external_id",
            name="uq_content_idea_references_idea_provider_external_id",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    content_idea_id: int = Field(foreign_key="content_ideas.id", index=True)
    provider: str = Field(
        default="youtube",
        sa_column=Column(
            String(32), nullable=False, default="youtube", server_default=text("'youtube'")
        ),
    )
    external_id: str = Field(sa_column=Column(String(255), nullable=False))
    title: str = Field(sa_column=Column(String(1000), nullable=False))
    url: str = Field(sa_column=Column(String(2048), nullable=False))
    thumbnail_url: str | None = Field(default=None, sa_column=Column(String(2048)))
    channel_title: str | None = Field(default=None, sa_column=Column(String(500)))
    published_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    note: str | None = Field(default=None, sa_column=Column(String(5000)))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

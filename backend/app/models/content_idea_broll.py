from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint, text
from sqlmodel import Field, SQLModel

from app.models.user import utc_now


class ContentIdeaBroll(SQLModel, table=True):
    __tablename__ = "content_idea_brolls"
    __table_args__ = (
        UniqueConstraint(
            "content_idea_id",
            "provider",
            "external_id",
            name="uq_content_idea_brolls_idea_provider_external_id",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    content_idea_id: int = Field(foreign_key="content_ideas.id", index=True)
    provider: str = Field(
        default="pexels",
        sa_column=Column(
            String(32), nullable=False, default="pexels", server_default=text("'pexels'")
        ),
    )
    external_id: str = Field(sa_column=Column(String(255), nullable=False))
    title: str | None = Field(default=None, sa_column=Column(String(1000)))
    url: str = Field(sa_column=Column(String(2048), nullable=False))
    preview_url: str | None = Field(default=None, sa_column=Column(String(2048)))
    thumbnail_url: str | None = Field(default=None, sa_column=Column(String(2048)))
    creator_name: str | None = Field(default=None, sa_column=Column(String(500)))
    duration_seconds: int | None = Field(default=None, sa_column=Column(Integer))
    width: int | None = Field(default=None, sa_column=Column(Integer))
    height: int | None = Field(default=None, sa_column=Column(Integer))
    note: str | None = Field(default=None, sa_column=Column(String(5000)))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

from datetime import datetime

from sqlalchemy import Column, DateTime, String, UniqueConstraint, text
from sqlmodel import Field, SQLModel

from app.models.user import utc_now


class SavedReference(SQLModel, table=True):
    __tablename__ = "saved_references"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "provider",
            "external_id",
            name="uq_saved_references_project_provider_external_id",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True)
    provider: str = Field(
        default="youtube",
        sa_column=Column(
            String(32),
            nullable=False,
            default="youtube",
            server_default=text("'youtube'"),
        ),
    )
    external_id: str = Field(sa_column=Column(String(255), nullable=False))
    title: str = Field(sa_column=Column(String(1000), nullable=False))
    url: str = Field(sa_column=Column(String(2048), nullable=False))
    thumbnail_url: str | None = Field(
        default=None,
        sa_column=Column(String(2048), nullable=True),
    )
    channel_title: str | None = Field(
        default=None,
        sa_column=Column(String(500), nullable=True),
    )
    published_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    note: str | None = Field(
        default=None,
        sa_column=Column(String(5000), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

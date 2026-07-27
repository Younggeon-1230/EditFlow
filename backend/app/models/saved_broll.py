from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint, text
from sqlmodel import Field, SQLModel

from app.models.user import utc_now


class SavedBroll(SQLModel, table=True):
    __tablename__ = "saved_brolls"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "provider",
            "external_id",
            name="uq_saved_brolls_project_provider_external_id",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True)
    provider: str = Field(
        default="pexels",
        sa_column=Column(
            String(32),
            nullable=False,
            default="pexels",
            server_default=text("'pexels'"),
        ),
    )
    external_id: str = Field(sa_column=Column(String(255), nullable=False))
    title: str | None = Field(
        default=None,
        sa_column=Column(String(1000), nullable=True),
    )
    url: str = Field(sa_column=Column(String(2048), nullable=False))
    preview_url: str | None = Field(
        default=None,
        sa_column=Column(String(2048), nullable=True),
    )
    thumbnail_url: str | None = Field(
        default=None,
        sa_column=Column(String(2048), nullable=True),
    )
    creator_name: str | None = Field(
        default=None,
        sa_column=Column(String(500), nullable=True),
    )
    duration_seconds: int | None = Field(
        default=None,
        sa_column=Column(Integer, nullable=True),
    )
    width: int | None = Field(
        default=None,
        sa_column=Column(Integer, nullable=True),
    )
    height: int | None = Field(
        default=None,
        sa_column=Column(Integer, nullable=True),
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

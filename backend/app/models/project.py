from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.user import utc_now


class ProjectStatus(StrEnum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "source_local_id",
            name="uq_projects_user_source_local_id",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    source_local_id: str | None = Field(
        default=None,
        sa_column=Column(String(200), nullable=True),
    )
    title: str = Field(sa_column=Column(String(200), nullable=False))
    description: str | None = Field(
        default=None,
        sa_column=Column(String(5000), nullable=True),
    )
    client_name: str | None = Field(
        default=None,
        sa_column=Column(String(200), nullable=True),
    )
    status: ProjectStatus = Field(
        default=ProjectStatus.PLANNING,
        sa_column=Column(String(32), nullable=False),
    )
    due_date: date | None = None
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

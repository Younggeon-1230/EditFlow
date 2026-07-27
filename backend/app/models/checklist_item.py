from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, false
from sqlmodel import Field, SQLModel

from app.models.user import utc_now


class ChecklistItem(SQLModel, table=True):
    __tablename__ = "checklist_items"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True)
    title: str = Field(sa_column=Column(String(200), nullable=False))
    description: str | None = Field(
        default=None,
        sa_column=Column(String(5000), nullable=True),
    )
    is_completed: bool = Field(
        default=False,
        sa_column=Column(
            Boolean,
            nullable=False,
            default=False,
            server_default=false(),
        ),
    )
    position: int = Field(sa_column=Column(Integer, nullable=False))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

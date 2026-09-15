from datetime import datetime

from sqlalchemy import Column, Integer, String
from sqlmodel import Field, SQLModel

from app.core.datetime import UTCDateTime, utc_now


class ProjectMemo(SQLModel, table=True):
    __tablename__ = "project_memos"

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True)
    content: str = Field(sa_column=Column(String(5000), nullable=False))
    position: int = Field(sa_column=Column(Integer, nullable=False))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(UTCDateTime(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(UTCDateTime(), nullable=False),
    )

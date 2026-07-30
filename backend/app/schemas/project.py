from datetime import date, datetime
from typing import Self

from pydantic import ConfigDict, model_validator
from sqlmodel import Field, SQLModel

from app.models.project import ProjectStatus


class ProjectBase(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    client_name: str | None = Field(default=None, max_length=200)
    status: ProjectStatus = ProjectStatus.PLANNING
    due_date: date | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    client_name: str | None = Field(default=None, max_length=200)
    status: ProjectStatus | None = None
    due_date: date | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        for field_name in ("title", "status"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    reference_count: int = 0
    broll_count: int = 0
    checklist_total: int = 0
    checklist_completed: int = 0

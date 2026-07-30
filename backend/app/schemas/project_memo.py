from datetime import datetime
from typing import Self

from pydantic import ConfigDict, model_validator
from sqlmodel import Field, SQLModel


class ProjectMemoCreate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    content: str = Field(min_length=1, max_length=5000)
    position: int | None = Field(default=None, ge=0)


class ProjectMemoUpdate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    content: str | None = Field(default=None, min_length=1, max_length=5000)
    position: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def reject_null_fields(self) -> Self:
        for field_name in ("content", "position"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class ProjectMemoRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    content: str
    position: int
    created_at: datetime
    updated_at: datetime

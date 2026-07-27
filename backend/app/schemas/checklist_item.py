from datetime import datetime
from typing import Self

from pydantic import ConfigDict, model_validator
from sqlmodel import Field, SQLModel


class ChecklistItemBase(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    is_completed: bool = False


class ChecklistItemCreate(ChecklistItemBase):
    position: int | None = Field(default=None, ge=0)


class ChecklistItemUpdate(SQLModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    is_completed: bool | None = None
    position: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        for field_name in ("title", "is_completed", "position"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class ChecklistItemRead(ChecklistItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    position: int
    created_at: datetime
    updated_at: datetime

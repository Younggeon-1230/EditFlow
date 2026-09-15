from datetime import datetime

from sqlalchemy import Boolean, Column, String, true
from sqlmodel import Field, SQLModel

from app.core.datetime import UTCDateTime, utc_now


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(
        sa_column=Column(String(255), nullable=False, unique=True, index=True)
    )
    password_hash: str | None = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
    )
    is_active: bool = Field(
        default=True,
        sa_column=Column(
            Boolean,
            nullable=False,
            server_default=true(),
        ),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(UTCDateTime(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(UTCDateTime(), nullable=False),
    )

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlmodel import Field, SQLModel

from app.models.user import utc_now


class AuthSession(SQLModel, table=True):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        Index(
            "ix_auth_sessions_token_digest",
            "token_digest",
            unique=True,
        ),
        Index("ix_auth_sessions_user_id", "user_id"),
        Index("ix_auth_sessions_expires_at", "expires_at"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    token_digest: str = Field(
        sa_column=Column(String(64), nullable=False)
    )
    csrf_token_digest: str = Field(
        sa_column=Column(String(64), nullable=False)
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    expires_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    revoked_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )

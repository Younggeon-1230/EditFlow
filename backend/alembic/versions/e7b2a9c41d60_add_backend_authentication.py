"""add backend authentication

Revision ID: e7b2a9c41d60
Revises: b4e9c12d7a63
Create Date: 2026-09-08
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "e7b2a9c41d60"
down_revision: str | Sequence[str] | None = "b4e9c12d7a63"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("password_hash", sa.String(length=255), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "is_active",
                sa.Boolean(),
                server_default=sa.true(),
                nullable=False,
            )
        )

    op.execute(
        sa.text(
            "UPDATE users "
            "SET is_active = :inactive "
            "WHERE email = :legacy_email"
        ).bindparams(inactive=False, legacy_email="dev@editflow.local")
    )

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("csrf_token_digest", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_auth_sessions_expires_at",
        "auth_sessions",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "ix_auth_sessions_token_digest",
        "auth_sessions",
        ["token_digest"],
        unique=True,
    )
    op.create_index(
        "ix_auth_sessions_user_id",
        "auth_sessions",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_user_id", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_token_digest", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_expires_at", table_name="auth_sessions")
    op.drop_table("auth_sessions")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("is_active")
        batch_op.drop_column("password_hash")

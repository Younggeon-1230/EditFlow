"""create content ideas table

Revision ID: a7d31c9e5f42
Revises: f2c8e4a91b70
Create Date: 2026-07-30
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "a7d31c9e5f42"
down_revision: str | Sequence[str] | None = "f2c8e4a91b70"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "content_ideas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=5000), nullable=True),
        sa.Column("platform", sa.String(length=32), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default=sa.text("'idea'"),
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.String(length=16),
            server_default=sa.text("'medium'"),
            nullable=False,
        ),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("target_audience", sa.String(length=500), nullable=True),
        sa.Column("content_format", sa.String(length=100), nullable=True),
        sa.Column(
            "source",
            sa.String(length=16),
            server_default=sa.text("'manual'"),
            nullable=False,
        ),
        sa.Column("converted_project_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["converted_project_id"],
            ["projects.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("content_ideas", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_content_ideas_converted_project_id"),
            ["converted_project_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_content_ideas_user_id"),
            ["user_id"],
            unique=False,
        )
        batch_op.create_index(
            "ix_content_ideas_user_id_platform",
            ["user_id", "platform"],
            unique=False,
        )
        batch_op.create_index(
            "ix_content_ideas_user_id_priority",
            ["user_id", "priority"],
            unique=False,
        )
        batch_op.create_index(
            "ix_content_ideas_user_id_status",
            ["user_id", "status"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("content_ideas", schema=None) as batch_op:
        batch_op.drop_index("ix_content_ideas_user_id_status")
        batch_op.drop_index("ix_content_ideas_user_id_priority")
        batch_op.drop_index("ix_content_ideas_user_id_platform")
        batch_op.drop_index(batch_op.f("ix_content_ideas_user_id"))
        batch_op.drop_index(
            batch_op.f("ix_content_ideas_converted_project_id")
        )

    op.drop_table("content_ideas")

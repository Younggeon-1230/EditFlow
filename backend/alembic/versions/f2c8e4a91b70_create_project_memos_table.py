"""create project memos table

Revision ID: f2c8e4a91b70
Revises: 8e6b3cd149da
Create Date: 2026-07-30
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "f2c8e4a91b70"
down_revision: str | Sequence[str] | None = "8e6b3cd149da"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_memos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(length=5000), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("project_memos", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_project_memos_project_id"),
            ["project_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("project_memos", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_project_memos_project_id"))

    op.drop_table("project_memos")

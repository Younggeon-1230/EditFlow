"""add project source local id

Revision ID: c4a8d2e91f37
Revises: e7b2a9c41d60
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "c4a8d2e91f37"
down_revision: str | None = "e7b2a9c41d60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("source_local_id", sa.String(length=200), nullable=True)
        )
        batch_op.create_unique_constraint(
            "uq_projects_user_source_local_id",
            ["user_id", "source_local_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_constraint(
            "uq_projects_user_source_local_id",
            type_="unique",
        )
        batch_op.drop_column("source_local_id")

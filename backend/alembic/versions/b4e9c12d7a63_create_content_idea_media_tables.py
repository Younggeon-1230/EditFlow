"""create content idea media tables

Revision ID: b4e9c12d7a63
Revises: a7d31c9e5f42
Create Date: 2026-08-03
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "b4e9c12d7a63"
down_revision: str | Sequence[str] | None = "a7d31c9e5f42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "content_idea_references",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("content_idea_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), server_default=sa.text("'youtube'"), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=1000), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=True),
        sa.Column("channel_title", sa.String(length=500), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.String(length=5000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["content_idea_id"], ["content_ideas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "content_idea_id",
            "provider",
            "external_id",
            name="uq_content_idea_references_idea_provider_external_id",
        ),
    )
    op.create_index(
        "ix_content_idea_references_content_idea_id",
        "content_idea_references",
        ["content_idea_id"],
        unique=False,
    )

    op.create_table(
        "content_idea_brolls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("content_idea_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), server_default=sa.text("'pexels'"), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=1000), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("preview_url", sa.String(length=2048), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=True),
        sa.Column("creator_name", sa.String(length=500), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("note", sa.String(length=5000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["content_idea_id"], ["content_ideas.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "content_idea_id",
            "provider",
            "external_id",
            name="uq_content_idea_brolls_idea_provider_external_id",
        ),
    )
    op.create_index(
        "ix_content_idea_brolls_content_idea_id",
        "content_idea_brolls",
        ["content_idea_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_content_idea_brolls_content_idea_id",
        table_name="content_idea_brolls",
    )
    op.drop_table("content_idea_brolls")
    op.drop_index(
        "ix_content_idea_references_content_idea_id",
        table_name="content_idea_references",
    )
    op.drop_table("content_idea_references")

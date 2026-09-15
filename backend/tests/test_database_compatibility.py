from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable
from sqlmodel import Session, SQLModel, select

import app.models  # noqa: F401
from app.core.config import Settings
from app.core.database import (
    build_engine_options,
    create_db_engine,
    get_database_dialect,
)
from app.core.datetime import as_utc
from app.main import should_ensure_development_user
from app.models.user import User


def test_database_url_accepts_sqlite_and_psycopg() -> None:
    assert (
        Settings(_env_file=None, database_url="sqlite:///test.db").database_url
        == "sqlite:///test.db"
    )
    postgres_url = "postgresql+psycopg://user:password@localhost/editflow_test"
    assert (
        Settings(_env_file=None, database_url=postgres_url).database_url
        == postgres_url
    )
    assert get_database_dialect(postgres_url) == "postgresql"


@pytest.mark.parametrize(
    "database_url",
    [
        "mysql+pymysql://user:password@localhost/editflow",
        "postgresql+psycopg2://user:password@localhost/editflow",
        "not a database url",
    ],
)
def test_database_url_rejects_unsupported_or_ambiguous_drivers(
    database_url: str,
) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url=database_url)


def test_engine_options_are_dialect_specific_and_hide_parameters() -> None:
    sqlite_options = build_engine_options("sqlite:///test.db", "test")
    postgres_options = build_engine_options(
        "postgresql+psycopg://user:password@localhost/editflow_test",
        "production",
    )

    assert sqlite_options["connect_args"] == {"check_same_thread": False}
    assert "connect_args" not in postgres_options
    assert sqlite_options["hide_parameters"] is True
    assert postgres_options["hide_parameters"] is True
    assert postgres_options["echo"] is False


def test_psycopg_engine_can_be_constructed_without_connecting() -> None:
    engine = create_db_engine(
        "postgresql+psycopg://user:password@localhost/editflow_test",
        environment="test",
    )
    try:
        assert engine.dialect.name == "postgresql"
        assert engine.dialect.driver == "psycopg"
    finally:
        engine.dispose()


def test_sqlite_engine_enables_foreign_keys(test_engine) -> None:
    with test_engine.connect() as connection:
        assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1


def test_sqlite_datetime_round_trip_restores_aware_utc(
    test_engine,
) -> None:
    source = datetime(2026, 9, 15, 12, 30)
    with Session(test_engine) as session:
        session.add(
            User(
                email="timezone@example.com",
                created_at=source,
                updated_at=source,
            )
        )
        session.commit()
        session.expire_all()
        user = session.exec(
            select(User).where(User.email == "timezone@example.com")
        ).one()

    assert user.created_at.tzinfo is not None
    assert user.created_at.utcoffset() == timedelta(0)
    assert user.created_at == source.replace(tzinfo=timezone.utc)


def test_as_utc_preserves_instants_across_timezones() -> None:
    korea = timezone(timedelta(hours=9))
    value = datetime(2026, 9, 15, 21, 30, tzinfo=korea)

    assert as_utc(value) == datetime(2026, 9, 15, 12, 30, tzinfo=timezone.utc)


def test_metadata_compiles_for_postgresql_with_expected_core_types() -> None:
    dialect = postgresql.dialect()
    statements = {
        table.name: str(CreateTable(table).compile(dialect=dialect))
        for table in SQLModel.metadata.sorted_tables
    }

    assert len(statements) == 10
    assert "TIMESTAMP WITH TIME ZONE" in statements["auth_sessions"]
    assert "BOOLEAN" in statements["users"]
    assert "DEFAULT false" in statements["checklist_items"]
    assert "SERIAL" in statements["projects"]
    assert "uq_projects_user_source_local_id" in statements["projects"]


def test_development_user_seed_is_environment_gated() -> None:
    assert should_ensure_development_user("development") is True
    assert should_ensure_development_user("test") is False
    assert should_ensure_development_user("production") is False

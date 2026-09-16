import os
from collections.abc import Generator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Engine, make_url

from app.core.config import get_settings
from app.core.database import create_db_engine


def _guarded_test_database_url() -> str:
    database_url = os.environ.get("TEST_DATABASE_URL", "")
    if not database_url:
        pytest.fail("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    url = make_url(database_url)
    if url.get_backend_name() != "postgresql" or url.get_driver_name() != "psycopg":
        pytest.fail("TEST_DATABASE_URL must use postgresql+psycopg")
    if not (url.database or "").endswith("_test"):
        pytest.fail("Refusing destructive QA: database name must end with _test")
    if os.environ.get("EDITFLOW_POSTGRESQL_QA") != "1":
        pytest.fail("Set EDITFLOW_POSTGRESQL_QA=1 to allow destructive test DB reset")
    return database_url


@pytest.fixture(scope="session")
def postgresql_database_url() -> str:
    return _guarded_test_database_url()


@pytest.fixture(scope="session")
def postgresql_engine(postgresql_database_url: str) -> Generator[Engine, None, None]:
    engine = create_db_engine(postgresql_database_url, environment="test")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar_one() == 1

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    previous_database_url = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = postgresql_database_url
    get_settings.cache_clear()
    try:
        alembic_config = Config("alembic.ini")
        command.upgrade(alembic_config, "head")
    finally:
        if previous_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_database_url
        get_settings.cache_clear()

    yield engine
    engine.dispose()


@pytest.fixture(autouse=True)
def reset_postgresql_test_database(
    postgresql_engine: Engine,
) -> Generator[None, None, None]:
    table_names = [
        "content_idea_references",
        "content_idea_brolls",
        "auth_sessions",
        "checklist_items",
        "project_memos",
        "saved_references",
        "saved_brolls",
        "content_ideas",
        "projects",
        "users",
    ]
    with postgresql_engine.begin() as connection:
        connection.execute(
            text(
                "TRUNCATE TABLE "
                + ", ".join(table_names)
                + " RESTART IDENTITY CASCADE"
            )
        )
    yield


@pytest.fixture
def test_engine(postgresql_engine: Engine) -> Engine:
    return postgresql_engine

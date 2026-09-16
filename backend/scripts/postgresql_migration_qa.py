import os

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import get_settings
from app.core.database import create_db_engine


def guarded_test_database_url() -> str:
    database_url = os.environ.get("TEST_DATABASE_URL", "")
    if not database_url:
        raise SystemExit("TEST_DATABASE_URL is required")
    url = make_url(database_url)
    if url.get_backend_name() != "postgresql" or url.get_driver_name() != "psycopg":
        raise SystemExit("TEST_DATABASE_URL must use postgresql+psycopg")
    if not (url.database or "").endswith("_test"):
        raise SystemExit("Refusing destructive migration: database must end in _test")
    if os.environ.get("EDITFLOW_POSTGRESQL_QA") != "1":
        raise SystemExit("Set EDITFLOW_POSTGRESQL_QA=1 to allow destructive migration QA")
    return database_url


def main() -> None:
    database_url = guarded_test_database_url()
    engine = create_db_engine(database_url, environment="test")
    try:
        with engine.connect() as connection:
            database_name = connection.execute(text("SELECT current_database()"))
            if not database_name.scalar_one().endswith("_test"):
                raise SystemExit("Connected database failed the _test safety check")
    finally:
        engine.dispose()

    previous_database_url = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = database_url
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        command.downgrade(config, "base")
        command.upgrade(config, "head")
        command.current(config, check_heads=True)
        command.check(config)
    finally:
        if previous_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_database_url
        get_settings.cache_clear()


if __name__ == "__main__":
    main()

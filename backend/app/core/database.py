from collections.abc import Generator
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import Engine, make_url
from sqlmodel import Session, create_engine

from app.core.config import get_settings


SUPPORTED_DATABASE_DIALECTS = {"sqlite", "postgresql"}


def get_database_dialect(database_url: str) -> str:
    dialect = make_url(database_url).get_backend_name()
    if dialect not in SUPPORTED_DATABASE_DIALECTS:
        raise ValueError(f"Unsupported database dialect: {dialect}")
    return dialect


def build_engine_options(database_url: str, environment: str) -> dict[str, Any]:
    options: dict[str, Any] = {
        "echo": environment.casefold() == "development",
        "hide_parameters": True,
    }
    if get_database_dialect(database_url) == "sqlite":
        options["connect_args"] = {"check_same_thread": False}
    return options


def _enable_sqlite_foreign_keys(dbapi_connection: Any, _: Any) -> None:
    dbapi_connection.execute("PRAGMA foreign_keys=ON")


def create_db_engine(database_url: str, *, environment: str) -> Engine:
    database_engine = create_engine(
        database_url,
        **build_engine_options(database_url, environment),
    )
    if get_database_dialect(database_url) == "sqlite":
        event.listen(database_engine, "connect", _enable_sqlite_foreign_keys)
    return database_engine


settings = get_settings()
engine = create_db_engine(
    settings.database_url,
    environment=settings.environment,
)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

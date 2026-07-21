from collections.abc import Generator

from sqlalchemy import event
from sqlmodel import Session, create_engine

from app.core.config import get_settings


settings = get_settings()

connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(
    settings.database_url,
    echo=settings.environment == "development",
    connect_args=connect_args,
)


if settings.database_url.startswith("sqlite"):
    event.listen(
        engine,
        "connect",
        lambda dbapi_connection, _: dbapi_connection.execute(
            "PRAGMA foreign_keys=ON"
        ),
    )


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

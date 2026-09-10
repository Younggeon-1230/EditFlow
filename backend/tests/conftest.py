from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401
from app.core.database import get_session
from app.main import app
from app.services.auth import auth_rate_limiter
from app.services.content_idea_recommendations import recommendation_runtime_state
from app.services.pexels import pexels_search_cache
from app.services.youtube import youtube_search_cache


FRONTEND_ORIGIN = "http://127.0.0.1:5173"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class CsrfTestClient(TestClient):
    """Exercise the browser CSRF flow by default in existing endpoint tests."""

    def request(self, method: str, url, **kwargs):
        if method.upper() in UNSAFE_METHODS:
            csrf_token = self.cookies.get("editflow_csrf")
            if csrf_token is None:
                bootstrap = super().request("GET", "/api/auth/csrf")
                assert bootstrap.status_code == 204
                csrf_token = self.cookies.get("editflow_csrf")
            headers = dict(kwargs.pop("headers", {}) or {})
            headers.setdefault("Origin", FRONTEND_ORIGIN)
            headers["X-CSRF-Token"] = csrf_token
            kwargs["headers"] = headers
        return super().request(method, url, **kwargs)


@pytest.fixture(autouse=True)
def clear_external_search_caches() -> Generator[None, None, None]:
    youtube_search_cache.clear()
    pexels_search_cache.clear()
    recommendation_runtime_state.clear()
    auth_rate_limiter.clear()
    yield
    youtube_search_cache.clear()
    pexels_search_cache.clear()
    recommendation_runtime_state.clear()
    auth_rate_limiter.clear()


@pytest.fixture
def test_engine(tmp_path: Path) -> Generator[Engine, None, None]:
    database_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    event.listen(
        engine,
        "connect",
        lambda dbapi_connection, _: dbapi_connection.execute(
            "PRAGMA foreign_keys=ON"
        ),
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def client(test_engine: Engine) -> Generator[CsrfTestClient, None, None]:
    def get_test_session() -> Generator[Session, None, None]:
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session
    with CsrfTestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def raw_client(test_engine: Engine) -> Generator[TestClient, None, None]:
    def get_test_session() -> Generator[Session, None, None]:
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

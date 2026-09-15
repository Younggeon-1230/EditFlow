from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel

import app.models  # noqa: F401
from app.core.database import create_db_engine, get_session
from app.main import app
from app.services.auth import auth_rate_limiter
from app.services.content_idea_recommendations import recommendation_runtime_state
from app.services.pexels import pexels_search_cache
from app.services.youtube import youtube_search_cache


FRONTEND_ORIGIN = "http://127.0.0.1:5173"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
TEST_USER_EMAIL = "authenticated@example.com"
TEST_USER_PASSWORD = "authenticated test password"


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
    engine = create_db_engine(
        f"sqlite:///{database_path.as_posix()}",
        environment="test",
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def anonymous_client(test_engine: Engine) -> Generator[CsrfTestClient, None, None]:
    def get_test_session() -> Generator[Session, None, None]:
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session
    with CsrfTestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def client(anonymous_client: CsrfTestClient) -> CsrfTestClient:
    response = anonymous_client.post(
        "/api/auth/signup",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
    )
    assert response.status_code == 201
    return anonymous_client


@pytest.fixture
def authenticated_client_factory(
    client: CsrfTestClient,
) -> Generator[Callable[[str], CsrfTestClient], None, None]:
    created_clients: list[CsrfTestClient] = []

    def create(email: str) -> CsrfTestClient:
        test_client = CsrfTestClient(app)
        response = test_client.post(
            "/api/auth/signup",
            json={"email": email, "password": TEST_USER_PASSWORD},
        )
        assert response.status_code == 201
        created_clients.append(test_client)
        return test_client

    yield create

    for test_client in created_clients:
        test_client.close()


@pytest.fixture
def raw_client(test_engine: Engine) -> Generator[TestClient, None, None]:
    def get_test_session() -> Generator[Session, None, None]:
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

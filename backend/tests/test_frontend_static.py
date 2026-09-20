from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.frontend import install_production_frontend


def build_test_app(dist_dir: Path) -> FastAPI:
    app = FastAPI()

    @app.get("/api/known")
    def known_api() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/health/live")
    def live() -> dict[str, str]:
        return {"status": "ok"}

    install_production_frontend(app, dist_dir)
    return app


@pytest.fixture
def frontend_dist(tmp_path: Path) -> Path:
    dist_dir = tmp_path / "dist"
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir(parents=True)
    (dist_dir / "index.html").write_text(
        '<!doctype html><div id="root"></div>',
        encoding="utf-8",
    )
    (dist_dir / "favicon.svg").write_text("<svg></svg>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('ok')", encoding="utf-8")
    return dist_dir


def test_serves_index_assets_and_existing_public_files(frontend_dist: Path) -> None:
    with TestClient(build_test_app(frontend_dist)) as client:
        root = client.get("/")
        asset = client.get("/assets/app.js")
        public_file = client.get("/favicon.svg")

    assert root.status_code == 200
    assert root.headers["content-type"].startswith("text/html")
    assert '<div id="root"></div>' in root.text
    assert asset.status_code == 200
    assert asset.text == "console.log('ok')"
    assert public_file.status_code == 200
    assert public_file.text == "<svg></svg>"


@pytest.mark.parametrize(
    "path",
    ["/projects", "/projects/123", "/ideas/123", "/login", "/signup"],
)
def test_frontend_routes_fall_back_to_index(
    frontend_dist: Path,
    path: str,
) -> None:
    with TestClient(build_test_app(frontend_dist)) as client:
        response = client.get(path)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert '<div id="root"></div>' in response.text


def test_backend_routes_take_precedence_and_unknown_api_stays_json(
    frontend_dist: Path,
) -> None:
    with TestClient(build_test_app(frontend_dist)) as client:
        known_api = client.get("/api/known")
        unknown_api = client.get("/api/does-not-exist")
        health = client.get("/health/live")
        unknown_health = client.get("/health/does-not-exist")

    assert known_api.json() == {"ok": True}
    assert unknown_api.status_code == 404
    assert unknown_api.headers["content-type"].startswith("application/json")
    assert unknown_api.json() == {"detail": "Not Found"}
    assert health.json() == {"status": "ok"}
    assert unknown_health.status_code == 404
    assert unknown_health.headers["content-type"].startswith("application/json")


def test_static_serving_does_not_expose_files_outside_dist(
    tmp_path: Path,
    frontend_dist: Path,
) -> None:
    (tmp_path / "secret.env").write_text("do-not-expose", encoding="utf-8")
    app = build_test_app(frontend_dist)

    static_mount = next(route for route in app.routes if route.name == "production-frontend")
    response = TestClient(static_mount.app).get("/../secret.env")

    assert response.status_code in {200, 404}
    assert "do-not-expose" not in response.text


def test_missing_production_dist_fails_fast(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="Production frontend build is missing"):
        install_production_frontend(FastAPI(), tmp_path / "missing-dist")

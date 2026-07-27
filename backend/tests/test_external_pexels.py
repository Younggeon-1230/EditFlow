from collections.abc import Callable
from typing import Any

import httpx
from fastapi.testclient import TestClient

from app.api.dependencies import get_external_http_client
from app.core.config import Settings, get_settings
from app.main import app


class StubHTTPClient:
    def __init__(
        self,
        results: list[httpx.Response | Exception],
    ) -> None:
        self.results = results
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        self.calls.append((url, kwargs))
        if not self.results:
            raise AssertionError("Unexpected external HTTP request")
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def external_response(
    status_code: int = 200,
    payload: object | None = None,
) -> httpx.Response:
    return httpx.Response(
        status_code,
        json={} if payload is None else payload,
        request=httpx.Request("GET", "https://external.test/search"),
    )


def configure_external_dependencies(
    stub: StubHTTPClient,
    *,
    pexels_api_key: str | None = "test-pexels-key",
) -> None:
    settings = Settings(
        _env_file=None,
        youtube_api_key="test-youtube-key",
        pexels_api_key=pexels_api_key,
    )
    app.dependency_overrides[get_external_http_client] = lambda: stub
    app.dependency_overrides[get_settings] = lambda: settings


def pexels_payload() -> dict:
    return {
        "page": 2,
        "per_page": 5,
        "total_results": 21,
        "next_page": "https://api.pexels.com/v1/videos/search?page=3",
        "prev_page": "https://api.pexels.com/v1/videos/search?page=1",
        "videos": [
            {
                "id": 12345,
                "title": "City &amp; Lights",
                "url": "https://www.pexels.com/video/12345/",
                "image": "https://images.pexels.com/12345.jpg",
                "user": {"name": "Creator &amp; Editor"},
                "duration": 14,
                "width": 3840,
                "height": 2160,
                "video_files": [
                    {
                        "file_type": "video/mp4",
                        "width": 3840,
                        "height": 2160,
                        "link": "https://videos.pexels.com/4k.mp4",
                    },
                    {
                        "file_type": "video/mp4",
                        "width": 1280,
                        "height": 720,
                        "link": "https://videos.pexels.com/720p.mp4",
                    },
                    {
                        "file_type": "video/mp4",
                        "width": 1920,
                        "height": 1080,
                        "link": "https://videos.pexels.com/1080p.mp4",
                    },
                ],
            }
        ],
    }


def request_error(
    factory: Callable[..., httpx.RequestError],
) -> httpx.RequestError:
    return factory(
        "external failure",
        request=httpx.Request("GET", "https://external.test/search"),
    )


def test_pexels_search_transforms_response(client: TestClient) -> None:
    stub = StubHTTPClient([external_response(payload=pexels_payload())])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/pexels/search",
        params={
            "query": "  city  ",
            "per_page": 5,
            "page": 2,
            "orientation": "landscape",
            "size": "medium",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["cached"] is False
    assert body["page"] == 2
    assert body["per_page"] == 5
    assert body["total_results"] == 21
    assert body["next_page"] == 3
    assert body["prev_page"] == 1
    assert body["items"][0] == {
        "external_id": "12345",
        "title": "City & Lights",
        "url": "https://www.pexels.com/video/12345/",
        "preview_url": "https://videos.pexels.com/1080p.mp4",
        "thumbnail_url": "https://images.pexels.com/12345.jpg",
        "creator_name": "Creator & Editor",
        "duration_seconds": 14,
        "width": 3840,
        "height": 2160,
        "provider": "pexels",
    }
    request = stub.calls[0][1]
    assert request["params"]["query"] == "city"
    assert request["params"]["orientation"] == "landscape"
    assert request["params"]["size"] == "medium"
    assert request["headers"] == {"Authorization": "test-pexels-key"}


def test_pexels_external_id_is_serialized_as_string(
    client: TestClient,
) -> None:
    stub = StubHTTPClient([external_response(payload=pexels_payload())])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/pexels/search",
        params={"query": "city"},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["external_id"] == "12345"


def test_pexels_selects_reasonable_mp4_preview(client: TestClient) -> None:
    stub = StubHTTPClient([external_response(payload=pexels_payload())])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/pexels/search",
        params={"query": "city"},
    )

    assert response.status_code == 200
    assert (
        response.json()["items"][0]["preview_url"]
        == "https://videos.pexels.com/1080p.mp4"
    )


def test_pexels_defensively_handles_missing_fields(
    client: TestClient,
) -> None:
    payload = {
        "videos": [
            {"id": None, "url": "https://www.pexels.com/video/missing/"},
            {"id": 2, "url": "https://www.pexels.com/video/2/"},
        ]
    }
    stub = StubHTTPClient([external_response(payload=payload)])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/pexels/search",
        params={"query": "city", "page": 4, "per_page": 7},
    )

    assert response.status_code == 200
    assert response.json()["items"] == [
        {
            "external_id": "2",
            "title": None,
            "url": "https://www.pexels.com/video/2/",
            "preview_url": None,
            "thumbnail_url": None,
            "creator_name": None,
            "duration_seconds": None,
            "width": None,
            "height": None,
            "provider": "pexels",
        }
    ]
    assert response.json()["page"] == 4
    assert response.json()["per_page"] == 7


def test_pexels_rejects_blank_query(client: TestClient) -> None:
    response = client.get(
        "/api/external/pexels/search",
        params={"query": "   "},
    )

    assert response.status_code == 422


def test_pexels_rejects_page_zero(client: TestClient) -> None:
    response = client.get(
        "/api/external/pexels/search",
        params={"query": "city", "page": 0},
    )

    assert response.status_code == 422


def test_pexels_rejects_per_page_over_limit(client: TestClient) -> None:
    response = client.get(
        "/api/external/pexels/search",
        params={"query": "city", "per_page": 41},
    )

    assert response.status_code == 422


def test_pexels_rejects_invalid_orientation_and_size(
    client: TestClient,
) -> None:
    orientation_response = client.get(
        "/api/external/pexels/search",
        params={"query": "city", "orientation": "wide"},
    )
    size_response = client.get(
        "/api/external/pexels/search",
        params={"query": "city", "size": "original"},
    )

    assert orientation_response.status_code == 422
    assert size_response.status_code == 422


def test_pexels_missing_api_key_returns_503(client: TestClient) -> None:
    stub = StubHTTPClient([])
    configure_external_dependencies(stub, pexels_api_key=None)

    response = client.get(
        "/api/external/pexels/search",
        params={"query": "city"},
    )

    assert response.status_code == 503
    assert stub.calls == []


def test_pexels_timeout_returns_504(client: TestClient) -> None:
    stub = StubHTTPClient([request_error(httpx.ReadTimeout)])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/pexels/search",
        params={"query": "city"},
    )

    assert response.status_code == 504


def test_pexels_network_error_returns_502(client: TestClient) -> None:
    stub = StubHTTPClient([request_error(httpx.ConnectError)])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/pexels/search",
        params={"query": "city"},
    )

    assert response.status_code == 502


def test_pexels_authentication_errors_return_503(
    client: TestClient,
) -> None:
    for status_code in (401, 403):
        stub = StubHTTPClient([external_response(status_code=status_code)])
        configure_external_dependencies(stub)

        response = client.get(
            "/api/external/pexels/search",
            params={"query": f"city-{status_code}"},
        )

        assert response.status_code == 503


def test_pexels_rate_limit_returns_429(client: TestClient) -> None:
    stub = StubHTTPClient([external_response(status_code=429)])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/pexels/search",
        params={"query": "city"},
    )

    assert response.status_code == 429


def test_pexels_second_identical_request_uses_cache(
    client: TestClient,
) -> None:
    stub = StubHTTPClient([external_response(payload=pexels_payload())])
    configure_external_dependencies(stub)
    params = {"query": "City", "page": 2, "per_page": 5}

    first = client.get("/api/external/pexels/search", params=params)
    second = client.get(
        "/api/external/pexels/search",
        params={**params, "query": " city "},
    )

    assert first.status_code == 200
    assert first.json()["cached"] is False
    assert second.status_code == 200
    assert second.json()["cached"] is True
    assert len(stub.calls) == 1


def test_pexels_pages_use_separate_cache_keys(client: TestClient) -> None:
    stub = StubHTTPClient(
        [
            external_response(payload=pexels_payload()),
            external_response(payload=pexels_payload()),
        ]
    )
    configure_external_dependencies(stub)

    first = client.get(
        "/api/external/pexels/search",
        params={"query": "city", "page": 1},
    )
    second = client.get(
        "/api/external/pexels/search",
        params={"query": "city", "page": 2},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert len(stub.calls) == 2
    assert stub.calls[0][1]["params"]["page"] == 1
    assert stub.calls[1][1]["params"]["page"] == 2

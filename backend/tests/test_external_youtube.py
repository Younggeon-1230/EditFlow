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
    youtube_api_key: str | None = "test-youtube-key",
) -> None:
    settings = Settings(
        _env_file=None,
        youtube_api_key=youtube_api_key,
        pexels_api_key="test-pexels-key",
    )
    app.dependency_overrides[get_external_http_client] = lambda: stub
    app.dependency_overrides[get_settings] = lambda: settings


def youtube_payload() -> dict:
    return {
        "items": [
            {
                "id": {"videoId": "video-1"},
                "snippet": {
                    "title": "Editing &amp; Pacing",
                    "description": "A &amp; B",
                    "channelTitle": "Edit &amp; Flow",
                    "publishedAt": "2026-07-01T12:00:00Z",
                    "thumbnails": {
                        "default": {"url": "https://img.test/default.jpg"},
                        "medium": {"url": "https://img.test/medium.jpg"},
                        "high": {"url": "https://img.test/high.jpg"},
                    },
                },
            }
        ],
        "nextPageToken": "NEXT",
        "prevPageToken": "PREV",
        "pageInfo": {"totalResults": 42},
    }


def request_error(
    factory: Callable[..., httpx.RequestError],
) -> httpx.RequestError:
    return factory(
        "external failure",
        request=httpx.Request("GET", "https://external.test/search"),
    )


def test_youtube_search_transforms_response(client: TestClient) -> None:
    stub = StubHTTPClient([external_response(payload=youtube_payload())])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/youtube/search",
        params={"query": "  editing  ", "max_results": 5},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["cached"] is False
    assert body["total_results"] == 42
    assert body["items"] == [
        {
            "external_id": "video-1",
            "title": "Editing & Pacing",
            "description": "A & B",
            "url": "https://www.youtube.com/watch?v=video-1",
            "thumbnail_url": "https://img.test/high.jpg",
            "channel_title": "Edit & Flow",
            "published_at": "2026-07-01T12:00:00Z",
            "provider": "youtube",
        }
    ]
    request_params = stub.calls[0][1]["params"]
    assert request_params["q"] == "editing"
    assert request_params["part"] == "snippet"
    assert request_params["type"] == "video"
    assert request_params["maxResults"] == 5


def test_youtube_excludes_items_without_video_id(client: TestClient) -> None:
    payload = youtube_payload()
    payload["items"].insert(
        0,
        {"id": {}, "snippet": {"title": "Channel result"}},
    )
    stub = StubHTTPClient([external_response(payload=payload)])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing"},
    )

    assert response.status_code == 200
    assert [item["external_id"] for item in response.json()["items"]] == [
        "video-1"
    ]


def test_youtube_thumbnail_falls_back_by_priority(client: TestClient) -> None:
    payload = youtube_payload()
    thumbnails = payload["items"][0]["snippet"]["thumbnails"]
    thumbnails["high"] = {"url": "http://insecure.test/high.jpg"}
    stub = StubHTTPClient([external_response(payload=payload)])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing"},
    )

    assert response.status_code == 200
    assert (
        response.json()["items"][0]["thumbnail_url"]
        == "https://img.test/medium.jpg"
    )


def test_youtube_maps_page_tokens(client: TestClient) -> None:
    stub = StubHTTPClient([external_response(payload=youtube_payload())])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing"},
    )

    assert response.status_code == 200
    assert response.json()["next_page_token"] == "NEXT"
    assert response.json()["prev_page_token"] == "PREV"


def test_youtube_rejects_invalid_order(client: TestClient) -> None:
    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing", "order": "rating"},
    )

    assert response.status_code == 422


def test_youtube_rejects_blank_query(client: TestClient) -> None:
    response = client.get(
        "/api/external/youtube/search",
        params={"query": "   "},
    )

    assert response.status_code == 422


def test_youtube_rejects_max_results_over_limit(client: TestClient) -> None:
    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing", "max_results": 26},
    )

    assert response.status_code == 422


def test_youtube_missing_api_key_returns_503(client: TestClient) -> None:
    stub = StubHTTPClient([])
    configure_external_dependencies(stub, youtube_api_key=None)

    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing"},
    )

    assert response.status_code == 503
    assert stub.calls == []


def test_youtube_timeout_returns_504(client: TestClient) -> None:
    stub = StubHTTPClient([request_error(httpx.ReadTimeout)])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing"},
    )

    assert response.status_code == 504


def test_youtube_network_error_returns_502(client: TestClient) -> None:
    stub = StubHTTPClient([request_error(httpx.ConnectError)])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing"},
    )

    assert response.status_code == 502


def test_youtube_5xx_returns_502(client: TestClient) -> None:
    stub = StubHTTPClient([external_response(status_code=503)])
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing"},
    )

    assert response.status_code == 502


def test_youtube_quota_error_returns_429(client: TestClient) -> None:
    stub = StubHTTPClient(
        [
            external_response(
                status_code=403,
                payload={
                    "error": {
                        "errors": [{"reason": "quotaExceeded"}],
                    }
                },
            )
        ]
    )
    configure_external_dependencies(stub)

    response = client.get(
        "/api/external/youtube/search",
        params={"query": "editing"},
    )

    assert response.status_code == 429


def test_youtube_second_identical_request_uses_cache(
    client: TestClient,
) -> None:
    stub = StubHTTPClient([external_response(payload=youtube_payload())])
    configure_external_dependencies(stub)
    params = {"query": "Editing", "max_results": 5}

    first = client.get("/api/external/youtube/search", params=params)
    second = client.get(
        "/api/external/youtube/search",
        params={**params, "query": " editing "},
    )

    assert first.status_code == 200
    assert first.json()["cached"] is False
    assert second.status_code == 200
    assert second.json()["cached"] is True
    assert len(stub.calls) == 1


def test_youtube_page_tokens_use_separate_cache_keys(
    client: TestClient,
) -> None:
    stub = StubHTTPClient(
        [
            external_response(payload=youtube_payload()),
            external_response(payload=youtube_payload()),
        ]
    )
    configure_external_dependencies(stub)

    first = client.get(
        "/api/external/youtube/search",
        params={"query": "editing", "page_token": "PAGE-1"},
    )
    second = client.get(
        "/api/external/youtube/search",
        params={"query": "editing", "page_token": "PAGE-2"},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert len(stub.calls) == 2
    assert stub.calls[0][1]["params"]["pageToken"] == "PAGE-1"
    assert stub.calls[1][1]["params"]["pageToken"] == "PAGE-2"

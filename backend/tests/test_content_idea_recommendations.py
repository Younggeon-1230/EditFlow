import asyncio
from collections.abc import Generator
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.api.dependencies import get_content_recommendation_provider
from app.core.config import Settings, get_settings
from app.main import app
from app.models.content_idea import ContentIdea, ContentIdeaSource, ContentPlatform
from app.models.user import User
from app.providers.llm.base import (
    LLMAuthenticationError,
    LLMConnectionError,
    LLMInvalidResponseError,
    LLMRateLimitError,
    LLMRefusalError,
    LLMTimeoutError,
    LLMUnavailableError,
    RecommendationPrompt,
)
from app.providers.llm.openai_provider import OpenAIContentRecommendationProvider
from app.schemas.content_idea_recommendation import RecommendationTokenPayload
from app.services.content_idea_recommendations import sign_save_token


SECRET = "test-signing-secret-that-is-longer-than-32-bytes"


def recommendation_item(title: str = "AI 콘텐츠 아이디어") -> dict[str, Any]:
    return {
        "title": title,
        "description": "실행 가능한 콘텐츠 설명",
        "platform": "youtube",
        "tags": [" AI ", "ai", "기획"],
        "target_audience": "초보 크리에이터",
        "content_format": "튜토리얼",
        "reason": "요청 주제와 대상 시청자에 맞습니다.",
    }


class StubProvider:
    def __init__(self, results: list[Any] | None = None, errors: list[Exception] | None = None) -> None:
        self.results = results if results is not None else [recommendation_item()]
        self.errors = list(errors or [])
        self.calls = 0
        self.prompts: list[RecommendationPrompt] = []

    async def generate(
        self,
        prompt: RecommendationPrompt,
        *,
        recommendation_count: int,
    ) -> list[Any]:
        self.calls += 1
        self.prompts.append(prompt)
        if self.errors:
            raise self.errors.pop(0)
        return self.results


class SlowProvider(StubProvider):
    async def generate(
        self,
        prompt: RecommendationPrompt,
        *,
        recommendation_count: int,
    ) -> list[Any]:
        self.calls += 1
        await asyncio.sleep(0.05)
        return self.results


@pytest.fixture
def configured_recommendations() -> Generator[StubProvider, None, None]:
    provider = StubProvider()
    settings = Settings(
        llm_live_calls_enabled=True,
        llm_api_key="test-key",
        llm_recommendation_signing_secret=SECRET,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_content_recommendation_provider] = lambda: provider
    yield provider


def post_recommendations(client: TestClient, **overrides: Any):
    body = {"topic": "초보자를 위한 영상 편집", **overrides}
    return client.post("/api/content-ideas/recommendations", json=body)


def test_generate_normalizes_partial_results_and_does_not_write_db(
    client: TestClient,
    configured_recommendations: StubProvider,
) -> None:
    create = client.post(
        "/api/content-ideas",
        json={"title": "AI, 콘텐츠 아이디어!", "platform": "blog"},
    )
    assert create.status_code == 201
    configured_recommendations.results = [
        recommendation_item("  AI 콘텐츠 아이디어  "),
        {**recommendation_item("잘못된 플랫폼"), "platform": "podcast"},
        recommendation_item("AI... 콘텐츠 아이디어"),
        recommendation_item("두 번째 아이디어"),
    ]

    before = client.get("/api/content-ideas/summary").json()["total"]
    response = post_recommendations(
        client,
        recommendation_count=3,
        target_audience="   ",
        keywords=[" AI ", "ai", " 영상 "],
    )

    assert response.status_code == 200
    data = response.json()
    assert data["requested_count"] == 3
    assert data["generated_count"] == 2
    assert data["discarded_count"] == 2
    assert data["prompt_version"] == "v1"
    assert data["recommendations"][0]["source"] == "ai"
    assert data["recommendations"][0]["duplicate_warning"] is True
    assert data["recommendations"][0]["tags"] == ["AI", "기획"]
    assert data["recommendations"][1]["duplicate_warning"] is False
    assert data["recommendations"][0]["client_key"]
    assert data["recommendations"][0]["save_token"].startswith("v1.")
    assert client.get("/api/content-ideas/summary").json()["total"] == before
    assert '"untrusted_user_input"' in configured_recommendations.prompts[0].user
    assert '"keywords":["AI","영상"]' in configured_recommendations.prompts[0].user
    assert '"target_audience":null' in configured_recommendations.prompts[0].user


def test_duplicate_warning_does_not_include_another_users_titles(
    client: TestClient,
    test_engine: Engine,
    configured_recommendations: StubProvider,
) -> None:
    with Session(test_engine) as session:
        other_user = User(email="other@editflow.local")
        session.add(other_user)
        session.flush()
        assert other_user.id is not None
        session.add(
            ContentIdea(
                user_id=other_user.id,
                title="다른 사용자 전용 제목",
                platform=ContentPlatform.BLOG,
                source=ContentIdeaSource.MANUAL,
            )
        )
        session.commit()
    configured_recommendations.results = [recommendation_item("다른 사용자 전용 제목")]

    response = post_recommendations(client)

    assert response.status_code == 200
    assert response.json()["recommendations"][0]["duplicate_warning"] is False


@pytest.mark.parametrize(
    ("body", "expected_status"),
    [
        ({}, 422),
        ({"topic": " "}, 422),
        ({"topic": "a"}, 422),
        ({"topic": "a" * 201}, 422),
        ({"topic": "valid", "platform": "podcast"}, 422),
        ({"topic": "valid", "tone": "sarcastic"}, 422),
        ({"topic": "valid", "recommendation_count": 0}, 422),
        ({"topic": "valid", "recommendation_count": 9}, 422),
        ({"topic": "valid", "keywords": ["x" * 51]}, 422),
        ({"topic": "valid", "keywords": list(map(str, range(11)))}, 422),
        ({"topic": "valid", "unknown": True}, 422),
    ],
)
def test_recommendation_input_validation(
    client: TestClient,
    configured_recommendations: StubProvider,
    body: dict[str, Any],
    expected_status: int,
) -> None:
    response = client.post("/api/content-ideas/recommendations", json=body)
    assert response.status_code == expected_status
    assert configured_recommendations.calls == 0


@pytest.mark.parametrize(
    "body",
    [
        {"topic": "ab", "recommendation_count": 1},
        {"topic": "가" * 200, "recommendation_count": 8},
        {"topic": "기본값 확인"},
    ],
)
def test_recommendation_input_boundaries_and_defaults(
    client: TestClient,
    configured_recommendations: StubProvider,
    body: dict[str, Any],
) -> None:
    response = client.post("/api/content-ideas/recommendations", json=body)
    assert response.status_code == 200
    expected_count = body.get("recommendation_count", 5)
    assert response.json()["requested_count"] == expected_count
    prompt_payload = configured_recommendations.prompts[-1].user
    assert f'"recommendation_count":{expected_count}' in prompt_payload
    assert '"tone":"informative"' in prompt_payload


def test_static_routes_do_not_collide_with_idea_id(
    client: TestClient,
    configured_recommendations: StubProvider,
) -> None:
    response = post_recommendations(client)
    assert response.status_code == 200
    save = client.post(
        "/api/content-ideas/recommendations/save",
        json={"save_token": response.json()["recommendations"][0]["save_token"]},
    )
    assert save.status_code == 201


def test_save_uses_only_signed_values_and_forces_server_fields(
    client: TestClient,
    configured_recommendations: StubProvider,
) -> None:
    generated = post_recommendations(client).json()["recommendations"][0]
    before_calls = configured_recommendations.calls
    response = client.post(
        "/api/content-ideas/recommendations/save",
        json={"save_token": generated["save_token"]},
    )
    assert response.status_code == 201
    saved = response.json()
    assert saved["title"] == generated["title"]
    assert saved["source"] == "ai"
    assert saved["status"] == "idea"
    assert saved["priority"] == "medium"
    assert "reason" not in saved
    assert configured_recommendations.calls == before_calls

    summary = client.get("/api/content-ideas/summary").json()
    assert summary["total"] == 1
    assert summary["by_source"]["ai"] == 1


def test_save_body_rejects_overrides_and_manual_create_still_rejects_source(
    client: TestClient,
    configured_recommendations: StubProvider,
) -> None:
    token = post_recommendations(client).json()["recommendations"][0]["save_token"]
    assert client.post(
        "/api/content-ideas/recommendations/save",
        json={"save_token": token, "title": "변조"},
    ).status_code == 422
    manual = client.post(
        "/api/content-ideas",
        json={"title": "일반 수동 생성", "platform": "blog"},
    )
    assert manual.status_code == 201
    assert manual.json()["source"] == "manual"
    assert client.post(
        "/api/content-ideas",
        json={"title": "일반 생성", "platform": "blog", "source": "ai"},
    ).status_code == 422


def test_token_tampering_and_reuse_are_rejected(
    client: TestClient,
    configured_recommendations: StubProvider,
) -> None:
    token = post_recommendations(client).json()["recommendations"][0]["save_token"]
    replacement = "A" if token[-1] != "A" else "B"
    invalid = client.post(
        "/api/content-ideas/recommendations/save",
        json={"save_token": token[:-1] + replacement},
    )
    assert invalid.status_code == 400
    assert invalid.json()["detail"]["code"] == "recommendation_token_invalid"

    assert client.post(
        "/api/content-ideas/recommendations/save", json={"save_token": token}
    ).status_code == 201
    reused = client.post(
        "/api/content-ideas/recommendations/save", json={"save_token": token}
    )
    assert reused.status_code == 409
    assert reused.json()["detail"]["code"] == "recommendation_token_reused"


def _token(user_id: int, issued_at: int, expires_at: int) -> str:
    return sign_save_token(
        RecommendationTokenPayload(
            version=1,
            user_id=user_id,
            issued_at=issued_at,
            expires_at=expires_at,
            client_key=uuid4(),
            title="서명된 아이디어",
            description=None,
            platform=ContentPlatform.BLOG,
            tags=[],
            target_audience=None,
            content_format=None,
        ),
        SECRET,
    )


def test_expired_and_other_user_tokens_are_distinct_errors(
    client: TestClient,
    configured_recommendations: StubProvider,
) -> None:
    expired = client.post(
        "/api/content-ideas/recommendations/save",
        json={"save_token": _token(1, 1, 2)},
    )
    assert expired.status_code == 410
    assert expired.json()["detail"]["code"] == "recommendation_token_expired"

    other_user = client.post(
        "/api/content-ideas/recommendations/save",
        json={"save_token": _token(999, 2_000_000_000, 2_000_001_000)},
    )
    assert other_user.status_code == 400
    assert other_user.json()["detail"]["code"] == "recommendation_token_user_mismatch"

    unsupported = client.post(
        "/api/content-ideas/recommendations/save",
        json={"save_token": _token(1, 2_000_000_000, 2_000_001_000).replace("v1.", "v2.", 1)},
    )
    assert unsupported.status_code == 400
    assert unsupported.json()["detail"]["code"] == "recommendation_token_invalid"


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (LLMAuthenticationError(), 503, "llm_authentication_failed"),
        (LLMRateLimitError(), 429, "llm_rate_limited"),
        (LLMTimeoutError(), 504, "llm_timeout"),
        (LLMInvalidResponseError(), 502, "llm_invalid_response"),
        (LLMRefusalError(), 422, "recommendation_refused"),
    ],
)
def test_provider_errors_have_stable_sanitized_contract(
    client: TestClient,
    error: Exception,
    status_code: int,
    code: str,
) -> None:
    provider = StubProvider(errors=[error])
    settings = Settings(
        llm_live_calls_enabled=True,
        llm_api_key="secret-api-key",
        llm_recommendation_signing_secret=SECRET,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_content_recommendation_provider] = lambda: provider
    response = post_recommendations(client)
    assert response.status_code == status_code
    detail = response.json()["detail"]
    assert detail["code"] == code
    assert set(detail) == {"code", "message", "retryable", "request_id"}
    assert "secret-api-key" not in response.text
    assert provider.calls == 1


@pytest.mark.parametrize("error", [LLMConnectionError(), LLMUnavailableError()])
def test_transient_provider_error_retries_once_without_real_sleep(
    client: TestClient,
    error: Exception,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = StubProvider(errors=[error])
    settings = Settings(
        llm_live_calls_enabled=True,
        llm_api_key="test-key",
        llm_recommendation_signing_secret=SECRET,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_content_recommendation_provider] = lambda: provider

    async def no_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("app.services.content_idea_recommendations.asyncio.sleep", no_sleep)
    response = post_recommendations(client)
    assert response.status_code == 200
    assert provider.calls == 2


def test_transient_provider_error_exhaustion_maps_to_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = StubProvider(errors=[LLMConnectionError(), LLMUnavailableError()])
    settings = Settings(
        llm_live_calls_enabled=True,
        llm_api_key="test-key",
        llm_recommendation_signing_secret=SECRET,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_content_recommendation_provider] = lambda: provider

    async def no_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("app.services.content_idea_recommendations.asyncio.sleep", no_sleep)
    response = post_recommendations(client)
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "llm_provider_unavailable"
    assert provider.calls == 2


def test_all_invalid_items_return_no_valid_recommendations(
    client: TestClient,
    configured_recommendations: StubProvider,
) -> None:
    configured_recommendations.results = [{"title": "missing fields"}]
    response = post_recommendations(client)
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "llm_no_valid_recommendations"


def test_provider_failure_does_not_write_content_ideas(
    client: TestClient,
) -> None:
    provider = StubProvider(errors=[LLMRateLimitError()])
    settings = Settings(
        llm_live_calls_enabled=True,
        llm_api_key="test-key",
        llm_recommendation_signing_secret=SECRET,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_content_recommendation_provider] = lambda: provider
    before = client.get("/api/content-ideas/summary").json()["total"]
    assert post_recommendations(client).status_code == 429
    assert client.get("/api/content-ideas/summary").json()["total"] == before


@pytest.mark.parametrize(
    ("api_key", "signing_secret"),
    [(None, SECRET), ("test-key", None)],
)
def test_each_required_secret_is_checked_at_endpoint_time(
    client: TestClient,
    api_key: str | None,
    signing_secret: str | None,
) -> None:
    provider = StubProvider()
    app.dependency_overrides[get_content_recommendation_provider] = lambda: provider
    app.dependency_overrides[get_settings] = lambda: Settings(
        llm_live_calls_enabled=True,
        llm_api_key=api_key,
        llm_recommendation_signing_secret=signing_secret,
    )
    response = post_recommendations(client)
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "llm_not_configured"
    assert provider.calls == 0


def test_live_call_gate_and_missing_configuration_never_call_provider(
    client: TestClient,
) -> None:
    provider = StubProvider()
    app.dependency_overrides[get_content_recommendation_provider] = lambda: provider
    app.dependency_overrides[get_settings] = lambda: Settings(
        llm_live_calls_enabled=False,
        llm_api_key=None,
        llm_recommendation_signing_secret=None,
    )
    disabled = post_recommendations(client)
    assert disabled.status_code == 503
    assert disabled.json()["detail"]["code"] == "llm_live_calls_disabled"
    assert provider.calls == 0

    app.dependency_overrides[get_settings] = lambda: Settings(
        llm_live_calls_enabled=True,
        llm_api_key=None,
        llm_recommendation_signing_secret=None,
    )
    unconfigured = post_recommendations(client)
    assert unconfigured.status_code == 503
    assert unconfigured.json()["detail"]["code"] == "llm_not_configured"
    assert provider.calls == 0


def test_route_timeout_cancels_provider(
    client: TestClient,
) -> None:
    provider = SlowProvider()
    settings = Settings(
        llm_live_calls_enabled=True,
        llm_api_key="test-key",
        llm_recommendation_signing_secret=SECRET,
        llm_timeout_seconds=0.001,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_content_recommendation_provider] = lambda: provider
    response = post_recommendations(client)
    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "llm_timeout"
    assert provider.calls == 1


def test_local_rate_limit_is_per_user(
    client: TestClient,
    configured_recommendations: StubProvider,
) -> None:
    settings = Settings(
        llm_live_calls_enabled=True,
        llm_api_key="test-key",
        llm_recommendation_signing_secret=SECRET,
        llm_rate_limit_requests=1,
    )
    app.dependency_overrides[get_settings] = lambda: settings
    assert post_recommendations(client).status_code == 200
    limited = post_recommendations(client)
    assert limited.status_code == 429
    assert limited.json()["detail"]["code"] == "recommendation_rate_limited"


class FakeResponses:
    def __init__(self, response: Any) -> None:
        self.response = response
        self.kwargs: dict[str, Any] = {}

    async def create(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        return self.response


class FakeOpenAIClient:
    def __init__(self, response: Any) -> None:
        self.responses = FakeResponses(response)
        self.closed = False

    async def close(self) -> None:
        self.closed = True


def test_openai_adapter_uses_responses_strict_schema_without_network(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = SimpleNamespace(
        status="completed",
        output_text='{"recommendations":[]}',
        output=[],
    )
    client = FakeOpenAIClient(response)
    monkeypatch.setattr(
        "app.providers.llm.openai_provider.openai.AsyncOpenAI",
        lambda **_: client,
    )
    provider = OpenAIContentRecommendationProvider(
        Settings(llm_api_key="test-key", llm_recommendation_signing_secret=SECRET)
    )
    prompt = RecommendationPrompt(system="system", developer="developer", user="user")

    result = asyncio.run(provider.generate(prompt, recommendation_count=5))

    assert result == []
    assert client.closed is True
    assert client.responses.kwargs["model"] == "gpt-5.6-luna"
    assert client.responses.kwargs["reasoning"] == {"effort": "none"}
    output_format = client.responses.kwargs["text"]["format"]
    assert output_format["type"] == "json_schema"
    assert output_format["strict"] is True
    assert output_format["schema"]["additionalProperties"] is False


@pytest.mark.parametrize(
    "response",
    [
        SimpleNamespace(status="completed", output_text="not-json", output=[]),
        SimpleNamespace(
            status="incomplete",
            output_text='{"recommendations":[]}',
            output=[],
        ),
        SimpleNamespace(status="completed", output_text='{"wrong":[]}', output=[]),
    ],
)
def test_openai_adapter_rejects_malformed_structured_output(
    monkeypatch: pytest.MonkeyPatch,
    response: Any,
) -> None:
    client = FakeOpenAIClient(response)
    monkeypatch.setattr(
        "app.providers.llm.openai_provider.openai.AsyncOpenAI",
        lambda **_: client,
    )
    provider = OpenAIContentRecommendationProvider(
        Settings(llm_api_key="test-key", llm_recommendation_signing_secret=SECRET)
    )
    with pytest.raises(LLMInvalidResponseError):
        asyncio.run(
            provider.generate(
                RecommendationPrompt(system="s", developer="d", user="u"),
                recommendation_count=5,
            )
        )
    assert client.closed is True


def test_openai_adapter_detects_refusal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = SimpleNamespace(
        status="completed",
        output_text="",
        output=[SimpleNamespace(content=[SimpleNamespace(type="refusal")])],
    )
    client = FakeOpenAIClient(response)
    monkeypatch.setattr(
        "app.providers.llm.openai_provider.openai.AsyncOpenAI",
        lambda **_: client,
    )
    provider = OpenAIContentRecommendationProvider(
        Settings(llm_api_key="test-key", llm_recommendation_signing_secret=SECRET)
    )
    with pytest.raises(LLMRefusalError):
        asyncio.run(
            provider.generate(
                RecommendationPrompt(system="s", developer="d", user="u"),
                recommendation_count=5,
            )
        )

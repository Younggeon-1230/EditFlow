import json
from typing import Any

import httpx
import openai

from app.core.config import Settings
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


RECOMMENDATION_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "recommendations": {
            "type": "array",
            "maxItems": 8,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "minLength": 1, "maxLength": 200},
                    "description": {
                        "anyOf": [
                            {"type": "string", "maxLength": 5000},
                            {"type": "null"},
                        ]
                    },
                    "platform": {
                        "type": "string",
                        "enum": [
                            "youtube",
                            "shorts",
                            "instagram",
                            "tiktok",
                            "blog",
                            "other",
                        ],
                    },
                    "tags": {
                        "type": "array",
                        "maxItems": 10,
                        "items": {"type": "string", "maxLength": 50},
                    },
                    "target_audience": {
                        "anyOf": [
                            {"type": "string", "maxLength": 500},
                            {"type": "null"},
                        ]
                    },
                    "content_format": {
                        "anyOf": [
                            {"type": "string", "maxLength": 100},
                            {"type": "null"},
                        ]
                    },
                    "reason": {"type": "string", "minLength": 1, "maxLength": 500},
                },
                "required": [
                    "title",
                    "description",
                    "platform",
                    "tags",
                    "target_audience",
                    "content_format",
                    "reason",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["recommendations"],
    "additionalProperties": False,
}


class OpenAIContentRecommendationProvider:
    """Official OpenAI Python SDK adapter for the Responses API."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def generate(
        self,
        prompt: RecommendationPrompt,
        *,
        recommendation_count: int,
    ) -> list[Any]:
        provider_timeout = min(self._settings.llm_timeout_seconds, 20.0)
        timeout = httpx.Timeout(
            provider_timeout,
            connect=self._settings.llm_connect_timeout_seconds,
        )
        client = openai.AsyncOpenAI(
            api_key=self._settings.llm_api_key,
            timeout=timeout,
            max_retries=0,
        )
        try:
            response = await client.responses.create(
                model=self._settings.llm_model,
                reasoning={"effort": "none"},
                input=[
                    {"role": "system", "content": prompt.system},
                    {"role": "developer", "content": prompt.developer},
                    {"role": "user", "content": prompt.user},
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "content_idea_recommendations",
                        "strict": True,
                        "schema": RECOMMENDATION_OUTPUT_SCHEMA,
                    }
                },
                max_output_tokens=self._settings.llm_max_output_tokens,
            )
        except (openai.AuthenticationError, openai.PermissionDeniedError, openai.NotFoundError) as error:
            raise LLMAuthenticationError from error
        except openai.RateLimitError as error:
            raise LLMRateLimitError from error
        except openai.APITimeoutError as error:
            raise LLMTimeoutError from error
        except openai.APIConnectionError as error:
            raise LLMConnectionError from error
        except openai.APIStatusError as error:
            if error.status_code >= 500:
                raise LLMUnavailableError from error
            raise LLMAuthenticationError from error
        finally:
            await client.close()

        if _has_refusal(response):
            raise LLMRefusalError
        if response.status == "incomplete" or not response.output_text:
            raise LLMInvalidResponseError
        if len(response.output_text.encode("utf-8")) > 128 * 1024:
            raise LLMInvalidResponseError
        try:
            payload = json.loads(response.output_text)
        except (TypeError, json.JSONDecodeError) as error:
            raise LLMInvalidResponseError from error
        if not isinstance(payload, dict) or not isinstance(
            payload.get("recommendations"), list
        ):
            raise LLMInvalidResponseError
        return payload["recommendations"]


def _has_refusal(response: Any) -> bool:
    for item in getattr(response, "output", []):
        for content in getattr(item, "content", []) or []:
            if getattr(content, "type", None) == "refusal":
                return True
    return False

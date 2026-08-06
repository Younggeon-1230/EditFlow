from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class RecommendationPrompt:
    system: str
    developer: str
    user: str


class ContentRecommendationProvider(Protocol):
    async def generate(
        self,
        prompt: RecommendationPrompt,
        *,
        recommendation_count: int,
    ) -> list[Any]: ...


class LLMProviderError(Exception):
    """Base provider error that must never expose its message to API clients."""


class LLMAuthenticationError(LLMProviderError):
    pass


class LLMRateLimitError(LLMProviderError):
    pass


class LLMTimeoutError(LLMProviderError):
    pass


class LLMConnectionError(LLMProviderError):
    pass


class LLMUnavailableError(LLMProviderError):
    pass


class LLMInvalidResponseError(LLMProviderError):
    pass


class LLMRefusalError(LLMProviderError):
    pass

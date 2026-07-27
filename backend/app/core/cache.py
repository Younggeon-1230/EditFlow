from collections.abc import Hashable
from dataclasses import dataclass
from threading import RLock
from time import monotonic
from typing import Generic, TypeVar


KeyT = TypeVar("KeyT", bound=Hashable)
ValueT = TypeVar("ValueT")


@dataclass
class _CacheEntry(Generic[ValueT]):
    value: ValueT
    expires_at: float


class TTLCache(Generic[KeyT, ValueT]):
    def __init__(self, max_entries: int = 256) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be at least 1")
        self._max_entries = max_entries
        self._entries: dict[KeyT, _CacheEntry[ValueT]] = {}
        self._lock = RLock()

    def get(self, key: KeyT) -> ValueT | None:
        with self._lock:
            self._remove_expired()
            entry = self._entries.get(key)
            return entry.value if entry is not None else None

    def set(self, key: KeyT, value: ValueT, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return
        with self._lock:
            self._remove_expired()
            self._entries.pop(key, None)
            while len(self._entries) >= self._max_entries:
                oldest_key = next(iter(self._entries))
                self._entries.pop(oldest_key)
            self._entries[key] = _CacheEntry(
                value=value,
                expires_at=monotonic() + ttl_seconds,
            )

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def _remove_expired(self) -> None:
        now = monotonic()
        expired_keys = [
            key
            for key, entry in self._entries.items()
            if entry.expires_at <= now
        ]
        for key in expired_keys:
            self._entries.pop(key, None)

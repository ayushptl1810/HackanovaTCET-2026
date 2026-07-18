"""
Short-lived store for the OAuth ``state`` → PKCE ``code_verifier`` binding,
which must survive the browser redirect between /login and /callback.

Uses Redis when available (required for multi-instance / production), and
falls back to an in-process dict for local dev. Entries expire after `ttl`.
"""

import logging
import time
from typing import Dict, Optional, Tuple

from core.config import settings

logger = logging.getLogger(__name__)

_PREFIX = "digilocker:pkce:"


class _MemoryStore:
    def __init__(self) -> None:
        self._data: Dict[str, Tuple[str, float]] = {}

    def put(self, state: str, verifier: str, ttl: int) -> None:
        self._data[state] = (verifier, time.time() + ttl)

    def pop(self, state: str) -> Optional[str]:
        item = self._data.pop(state, None)
        if not item:
            return None
        verifier, expiry = item
        return verifier if time.time() < expiry else None


class _RedisStore:
    def __init__(self, client) -> None:
        self._r = client

    def put(self, state: str, verifier: str, ttl: int) -> None:
        self._r.setex(_PREFIX + state, ttl, verifier)

    def pop(self, state: str) -> Optional[str]:
        key = _PREFIX + state
        verifier = self._r.get(key)
        if verifier is not None:
            self._r.delete(key)
        return verifier


def _build_store():
    try:
        import redis
        client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        client.ping()
        logger.info("DigiLocker PKCE state store: Redis")
        return _RedisStore(client)
    except Exception as exc:
        logger.warning("Redis unavailable (%s); using in-memory PKCE store (dev only)", exc)
        return _MemoryStore()


_store = None


def _get_store():
    global _store
    if _store is None:
        _store = _build_store()
    return _store


def save_verifier(state: str, verifier: str, ttl: int = 600) -> None:
    _get_store().put(state, verifier, ttl)


def take_verifier(state: str) -> Optional[str]:
    """Return and consume the verifier for a state (one-time use)."""
    return _get_store().pop(state)

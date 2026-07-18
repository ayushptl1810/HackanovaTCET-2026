"""
Scheme cache — the warm serving layer that keeps user search latency low.

Schemes and their derived indexes (the conflict graph) are loaded ONCE into
process memory and reused across requests. The source of truth is Redis
(`schemes:all`) when available, else the scraped JSON file.

Ingestion (scraper / agentic extractor) calls ``set_schemes()`` to publish a
new set: it rebuilds the indexes and does an **atomic swap** of the in-memory
reference, so in-flight reads never see a half-updated state and users never
wait on a rebuild.

This is the "no latency at search time" guarantee: the user's query path only
ever touches warm memory — never a file read, a scrape, or an LLM call.
"""

import json
import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from core.config import settings

logger = logging.getLogger(__name__)

_REDIS_KEY = "schemes:all"
_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "schemes_database.json")
_MEMORY_TTL = 300  # seconds; auto-reload from source if older (file-fallback freshness)

_lock = threading.Lock()
_state: Dict[str, Any] = {"schemes": None, "loaded_at": 0.0, "source": None}


# --- Source loaders --------------------------------------------------------

def _load_from_redis() -> Optional[List[Dict]]:
    try:
        import redis
        r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        cached = r.get(_REDIS_KEY)
        if cached:
            return json.loads(cached)
    except Exception as exc:
        logger.debug("Redis scheme load unavailable: %s", exc)
    return None


def _load_from_file() -> List[Dict]:
    if os.path.exists(_FILE_PATH):
        with open(_FILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else data.get("schemes", [])
    return []


def _load_source() -> Tuple[List[Dict], str]:
    schemes = _load_from_redis()
    if schemes is not None:
        return schemes, "redis"
    return _load_from_file(), "file"


def _rebuild_indexes(schemes: List[Dict]) -> None:
    """Rebuild derived indexes (conflict graph) for a scheme set."""
    from services.conflict_graph import build_conflict_map
    build_conflict_map(schemes)


# --- Public API ------------------------------------------------------------

def get_schemes(force: bool = False) -> List[Dict]:
    """Return the warm scheme list, loading/refreshing from source only when stale."""
    now = time.time()
    cached = _state["schemes"]
    if not force and cached is not None and (now - _state["loaded_at"]) < _MEMORY_TTL:
        return cached

    with _lock:
        # Re-check inside the lock (another thread may have just loaded).
        cached = _state["schemes"]
        if not force and cached is not None and (time.time() - _state["loaded_at"]) < _MEMORY_TTL:
            return cached
        schemes, source = _load_source()
        _rebuild_indexes(schemes)
        _state.update(schemes=schemes, loaded_at=time.time(), source=source)
        logger.info("Scheme cache loaded: %d schemes from %s", len(schemes), source)
        return schemes


def set_schemes(schemes: List[Dict], persist_redis: bool = True) -> None:
    """
    Publish a new scheme set (ingestion path): rebuild indexes, persist to Redis,
    then atomically swap the in-memory reference.
    """
    _rebuild_indexes(schemes)
    if persist_redis:
        try:
            import redis
            r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            r.set(_REDIS_KEY, json.dumps(schemes))
        except Exception as exc:
            logger.warning("Could not persist schemes to Redis: %s", exc)
    with _lock:
        _state.update(schemes=schemes, loaded_at=time.time(), source="ingest")
    logger.info("Scheme cache updated via ingestion: %d schemes", len(schemes))
    # Precompute the semantic index for the new set (keeps search latency low).
    try:
        from services.semantic import reindex
        reindex(schemes)
    except Exception as exc:
        logger.warning("Semantic reindex skipped: %s", exc)


def refresh() -> Dict[str, Any]:
    """Force a reload from source (e.g. after a scraper run) and return status."""
    get_schemes(force=True)
    return cache_status()


def warm() -> None:
    """Load the cache AND build the semantic index at startup, so the first
    search (and the first semantic query) is already fast."""
    schemes = get_schemes(force=True)
    try:
        from services.semantic import reindex
        reindex(schemes)
    except Exception as exc:
        logger.warning("Semantic warm/reindex skipped: %s", exc)


def cache_status() -> Dict[str, Any]:
    schemes = _state["schemes"] or []
    return {
        "count": len(schemes),
        "source": _state["source"],
        "age_seconds": round(time.time() - _state["loaded_at"], 1) if _state["loaded_at"] else None,
        "ttl_seconds": _MEMORY_TTL,
    }

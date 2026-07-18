"""
Ingestion pipeline — the "live" refresh loop.

    crawl → diff against known schemes → enrich ONLY new/changed (LLM) →
    merge → atomic cache swap

The diff is the cost/latency control: unchanged schemes are reused as-is, so
each run only spends LLM calls on genuinely new or modified schemes. The
user's search path is never touched during ingestion — a warm cache serves
throughout, and the new set is swapped in atomically at the end.
"""

import hashlib
import json
import logging
from typing import Any, Callable, Dict, List, Optional

from services.scheme_cache import get_schemes, set_schemes

logger = logging.getLogger(__name__)


def _raw_hash(scheme: Dict[str, Any]) -> str:
    """Content hash of the fields that matter for re-extraction."""
    b = scheme.get("benefits", {})
    basis = {
        "name": scheme.get("name", ""),
        "desc": b.get("description", "") if isinstance(b, dict) else str(b),
        "docs": scheme.get("documents_required", []),
        "elig_text": scheme.get("eligibility_text", ""),
    }
    return hashlib.md5(json.dumps(basis, sort_keys=True).encode()).hexdigest()


def _default_fetch(pages: int) -> List[Dict[str, Any]]:
    """Default source: the myScheme scraper (falls back internally if it can't run)."""
    from services.scraper_service import main as scrape
    return scrape(num_pages=pages, save_output=False) or []


def run_ingestion(
    pages: int = 3,
    enrich: bool = True,
    fetch_fn: Optional[Callable[[int], List[Dict]]] = None,
    enrich_fn: Optional[Callable[[Dict], Dict]] = None,
) -> Dict[str, Any]:
    """
    Run one ingestion cycle. Returns stats.

    fetch_fn / enrich_fn are injectable for testing. Partial crawls are safe:
    schemes already known but not in this fetch are preserved (not deleted).
    """
    fetch_fn = fetch_fn or _default_fetch
    if enrich_fn is None and enrich:
        from services.extractor import enrich_scheme as enrich_fn  # type: ignore

    # Read the CURRENT published set (in-memory warm state / Redis / file), NOT a
    # forced file reload — a force reload would discard the last ingested set when
    # Redis isn't persisting it, breaking the diff.
    known = {s.get("scheme_id"): s for s in get_schemes() if s.get("scheme_id")}
    fetched = fetch_fn(pages) or []

    new_count = changed_count = reused_count = 0
    result: List[Dict[str, Any]] = []
    fetched_ids = set()

    for raw in fetched:
        sid = raw.get("scheme_id")
        if not sid:
            continue
        fetched_ids.add(sid)
        h = _raw_hash(raw)
        existing = known.get(sid)

        if existing and existing.get("_raw_hash") == h:
            result.append(existing)      # unchanged → reuse, no LLM
            reused_count += 1
            continue

        if existing:
            changed_count += 1
        else:
            new_count += 1

        scheme = enrich_fn(raw) if (enrich and enrich_fn) else dict(raw)
        scheme["_raw_hash"] = h
        result.append(scheme)

    # Preserve known schemes not seen in this (possibly partial) fetch.
    for sid, s in known.items():
        if sid not in fetched_ids:
            result.append(s)

    set_schemes(result)

    stats = {
        "fetched": len(fetched_ids),
        "new": new_count,
        "changed": changed_count,
        "reused": reused_count,
        "llm_calls": new_count + changed_count if enrich else 0,
        "total_after": len(result),
    }
    logger.info("Ingestion complete: %s", stats)
    return stats

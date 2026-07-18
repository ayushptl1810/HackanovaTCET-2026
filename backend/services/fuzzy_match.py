"""
Eligibility engine — fuzzy scheme matching against citizen slab profiles.

Interface contract (used by voice flow, web dashboard, WhatsApp bot):
    from services.fuzzy_match import get_top_schemes, SchemeResult

Internals: slab-based scoring against the scheme cache (Redis if available,
otherwise the scraped schemes_database.json).
"""

import json
import logging
import os
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

from services.conflict_graph import conflict_map, get_all_conflicts

logger = logging.getLogger(__name__)


@dataclass
class SchemeResult:
    scheme_id: str
    name: str
    match_score: float          # 0.0 – 1.0
    benefit_amount: str         # "₹6,000/year" or "Variable"
    category: str
    conflicts_with: list


# ---------------------------------------------------------------------------
# Slab-matching helpers
# ---------------------------------------------------------------------------

_AGE_RANGES = {
    "0-17":  (0, 17),
    "18-25": (18, 25),
    "18-35": (18, 35),
    "26-39": (26, 39),
    "36-59": (36, 59),
    "40-59": (40, 59),
    "60+":   (60, 120),
}


def _age_overlap(citizen_slab: str, scheme_slab: str) -> bool:
    """Check if citizen age slab overlaps with scheme age criteria."""
    c = _AGE_RANGES.get(citizen_slab)
    s = _AGE_RANGES.get(scheme_slab)
    if not c or not s:
        return True  # Unknown slabs → don't penalise
    return c[0] <= s[1] and s[0] <= c[1]


def _score_scheme(profile: Dict[str, Any], scheme: Dict[str, Any]) -> float:
    """Score a scheme against a citizen profile (0.0–1.0)."""
    score = 0.0
    max_score = 0.0

    rules = scheme.get("eligibility_rules", [])
    if not rules:
        return 0.5  # No rules → base score

    for rule in rules:
        field = rule.get("profile_field", "")
        max_score += 1.0

        if field == "age" or field == "age_slab":
            if _age_overlap(profile.get("age_slab", ""), str(rule.get("value", ""))):
                score += 1.0
        elif field == "gender":
            expected = str(rule.get("value", "")).upper()
            actual = profile.get("gender", "").upper()
            if expected in ("ALL", "") or actual == expected:
                score += 1.0
        elif field == "income" or field == "income_slab":
            score += 0.5  # Partial match for income ranges
        elif field == "occupation":
            if profile.get("occupation", "") == str(rule.get("value", "")):
                score += 1.0
            else:
                score += 0.3
        else:
            score += 0.5  # Unknown field → partial

    return score / max_score if max_score > 0 else 0.5


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _load_schemes() -> list:
    """Load schemes from Redis if available, else fall back to the scraped JSON."""
    try:
        import redis
        r = redis.Redis(host=os.getenv("REDIS_HOST", "localhost"),
                        port=int(os.getenv("REDIS_PORT", 6379)),
                        decode_responses=True)
        cached = r.get("schemes:all")
        if cached:
            return json.loads(cached)
    except Exception as exc:
        logger.debug("Redis unavailable for scheme load: %s", exc)

    # Fallback: the scraped database used across the main branch
    # (backend/data/schemes_database.json).
    fallback_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "schemes_database.json"
    )
    if os.path.exists(fallback_path):
        with open(fallback_path, "r", encoding="utf-8") as f:
            return json.load(f)

    return []


def get_top_schemes(
    profile_dict: Dict[str, Any],
    limit: int = 10,
    exclude_conflicts: bool = True,
    enrolled_scheme_ids: Optional[List[str]] = None,
) -> List[SchemeResult]:
    """
    Match a citizen profile against all known schemes.

    Args:
        profile_dict: keys: age_slab, gender, income_slab, occupation, state,
                      docs_available, verified_tier
        limit: max results to return
        exclude_conflicts: if True, remove schemes that conflict with enrolled ones
        enrolled_scheme_ids: list of scheme_ids citizen is already enrolled in

    Returns:
        List[SchemeResult] sorted by match_score descending.
    """
    schemes = _load_schemes()
    if not schemes:
        logger.warning("No schemes loaded for matching")
        return []

    # Keep the conflict graph in sync with whatever scheme set we just loaded.
    from services.conflict_graph import build_conflict_map
    build_conflict_map(schemes)

    if enrolled_scheme_ids is None:
        enrolled_scheme_ids = []

    # Build set of all conflicting scheme ids
    excluded: set = set()
    if exclude_conflicts:
        for eid in enrolled_scheme_ids:
            excluded |= get_all_conflicts(eid)
        excluded |= set(enrolled_scheme_ids)

    results: List[SchemeResult] = []
    for scheme in schemes:
        sid = scheme.get("scheme_id", "")
        if sid in excluded:
            continue

        score = _score_scheme(profile_dict, scheme)
        benefits = scheme.get("benefits", {})
        result = SchemeResult(
            scheme_id=sid,
            name=scheme.get("name", "Unknown"),
            match_score=round(score, 3),
            benefit_amount=benefits.get("description", "Variable") if isinstance(benefits, dict) else str(benefits),
            category=scheme.get("category", "General"),
            conflicts_with=list(conflict_map.get(sid, [])),
        )
        results.append(result)

    results.sort(key=lambda r: r.match_score, reverse=True)
    return results[:limit]

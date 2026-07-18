"""
Citizen journey routes — the authenticated citizen's view of HaqSe.

  GET /api/me           → the logged-in citizen's profile
  GET /api/me/schemes   → welfare schemes matched to the citizen's profile

All routes require a citizen Bearer token (issued at /api/login/citizen).
"""

import logging

from fastapi import APIRouter, Depends, Query

from routes.deps import get_current_citizen
from services.fuzzy_match import get_top_schemes
from services.auth_service import get_profile_slabs
from services.eligibility import evaluate_scheme
from services.scheme_cache import get_schemes as _get_cached_schemes

logger = logging.getLogger(__name__)

citizen_router = APIRouter(prefix="/api/me", tags=["citizen"])


@citizen_router.get("")
async def my_profile(citizen: dict = Depends(get_current_citizen)):
    """Return the logged-in citizen's profile (sensitive fields already stripped)."""
    safe = {k: v for k, v in citizen.items() if not k.startswith("_")}
    return {"success": True, "profile": safe}


@citizen_router.get("/schemes/search")
async def search_schemes(
    q: str = Query(..., min_length=2, description="Natural-language description of the need"),
    limit: int = Query(10, ge=1, le=50),
    citizen: dict = Depends(get_current_citizen),
):
    """
    Natural-language scheme search for the logged-in citizen.

    Semantic match on the query → then each candidate is annotated with the
    citizen's eligibility verdict (eligible / needs_info / not_eligible), ranked
    eligible-first. Built for low-literacy users describing a need in plain words.
    """
    from services.semantic import search as semantic_search
    slabs = get_profile_slabs(citizen["_phone"]) or {}
    by_id = {s.get("scheme_id"): s for s in _get_cached_schemes()}

    hits = semantic_search(q, top_k=max(limit * 3, 15))  # over-fetch, then rank
    out = []
    for sid, sim in hits:
        scheme = by_id.get(sid)
        if not scheme:
            continue
        elig = evaluate_scheme(slabs, scheme)
        b = scheme.get("benefits", {})
        out.append({
            "scheme_id": sid,
            "name": scheme.get("name", ""),
            "semantic_score": sim,
            "eligibility": elig.verdict,
            "match_score": elig.score,
            "benefit_amount": b.get("description", "Variable") if isinstance(b, dict) else str(b),
            "category": scheme.get("category", "General"),
        })

    # Eligible first, then by semantic relevance.
    from services.eligibility import ELIGIBLE
    out.sort(key=lambda r: (r["eligibility"] != ELIGIBLE, -r["semantic_score"]))
    return {"success": True, "query": q, "count": len(out[:limit]), "results": out[:limit]}


@citizen_router.get("/schemes")
async def my_schemes(
    limit: int = Query(10, ge=1, le=50),
    citizen: dict = Depends(get_current_citizen),
):
    """Return welfare schemes matched to the citizen's slab profile, ranked."""
    slabs = get_profile_slabs(citizen["_phone"]) or {}
    results = get_top_schemes(slabs, limit=limit)
    return {
        "success": True,
        "count": len(results),
        "profile_slabs": slabs,
        "schemes": [
            {
                "scheme_id": r.scheme_id,
                "name": r.name,
                "eligibility": r.eligibility,
                "match_score": r.match_score,
                "benefit_amount": r.benefit_amount,
                "category": r.category,
                "conflicts_with": r.conflicts_with,
                "reasons": r.reasons,
            }
            for r in results
        ],
    }

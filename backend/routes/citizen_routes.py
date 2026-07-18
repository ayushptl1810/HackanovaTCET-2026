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

logger = logging.getLogger(__name__)

citizen_router = APIRouter(prefix="/api/me", tags=["citizen"])


@citizen_router.get("")
async def my_profile(citizen: dict = Depends(get_current_citizen)):
    """Return the logged-in citizen's profile (sensitive fields already stripped)."""
    safe = {k: v for k, v in citizen.items() if not k.startswith("_")}
    return {"success": True, "profile": safe}


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

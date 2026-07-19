"""
Public scheme routes — eligibility checks that don't need an account.

  POST /api/schemes/check   → match schemes for an ad-hoc slab profile

Powers "check for a family member": a citizen can see what a relative is
entitled to by entering their age/gender/income/occupation/state, without the
relative registering. Same matching engine as the logged-in dashboard.
"""

import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from services.fuzzy_match import get_top_schemes

logger = logging.getLogger(__name__)

schemes_router = APIRouter(prefix="/api/schemes", tags=["schemes"])

# DTMF-style choice → stored slab value (mirrors auth_service maps).
AGE_SLABS = {"1": "0-17", "2": "18-35", "3": "36-59", "4": "60+"}
GENDER_MAP = {"1": "M", "2": "F", "3": "O"}
INCOME_SLABS = {"1": "<2L", "2": "2-5L", "3": "5L+"}
OCCUPATION_MAP = {"1": "student", "2": "farmer", "3": "govt", "4": "other"}


class RelativeProfile(BaseModel):
    age_slab: str = "2"
    gender: str = "1"
    income_slab: str = "1"
    annual_income: int = 0
    occupation: str = "1"
    state: str = ""


@schemes_router.post("/check")
async def check_eligibility(p: RelativeProfile, limit: int = 12):
    slabs = {
        "age_slab": AGE_SLABS.get(p.age_slab, p.age_slab),
        "gender": GENDER_MAP.get(p.gender, p.gender),
        "income_slab": INCOME_SLABS.get(p.income_slab, p.income_slab),
        "annual_income": int(p.annual_income or 0),
        "occupation": OCCUPATION_MAP.get(p.occupation, p.occupation),
        "state": (p.state or "").strip(),
        "docs_available": "[]",
        "verified_tier": 0,
    }
    results = get_top_schemes(slabs, limit=limit)
    return {
        "success": True,
        "count": len(results),
        "schemes": [
            {
                "scheme_id": r.scheme_id,
                "name": r.name,
                "eligibility": r.eligibility,
                "match_score": r.match_score,
                "benefit_amount": r.benefit_amount,
                "category": r.category,
                "documents_required": r.documents_required or [],
                "official_portal_url": r.official_portal_url or "",
            }
            for r in results
        ],
    }

@schemes_router.get("/public")
async def get_public_schemes():
    """Return all cached schemes for the public landing page."""
    from services.scheme_cache import get_schemes
    schemes = get_schemes()
    return {"success": True, "count": len(schemes), "schemes": schemes}

@schemes_router.get("/detail/{scheme_id}")
async def get_scheme_by_id(scheme_id: str):
    from services.scheme_cache import get_schemes
    schemes = get_schemes()
    for s in schemes:
        if s.get("scheme_id") == scheme_id:
            return {"success": True, "scheme": s}
    return {"success": False, "error": "Scheme not found"}

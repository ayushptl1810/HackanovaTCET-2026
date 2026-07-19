"""
Citizen journey routes — the authenticated citizen's view of HaqSe.

  GET /api/me           → the logged-in citizen's profile
  GET /api/me/schemes   → welfare schemes matched to the citizen's profile

All routes require a citizen Bearer token (issued at /api/login/citizen).
"""

import logging
import os
import secrets

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from routes.deps import get_current_citizen
from services.fuzzy_match import get_top_schemes
from services.auth_service import get_profile_slabs
from services.eligibility import evaluate_scheme
from services.scheme_cache import get_schemes as _get_cached_schemes
from db.models import get_db

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
            "documents_required": list(scheme.get("documents_required", []) or []),
            "official_portal_url": scheme.get("official_portal_url", "") or "",
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
                "documents_required": r.documents_required or [],
                "official_portal_url": r.official_portal_url or "",
            }
            for r in results
        ],
    }


# ---------------------------------------------------------------------------
# Applications tracker — records a submitted application as a ticket, so the
# citizen can see the status of everything they've applied for in one place.
# (In production a ticket is picked up by a CSC operator / pushed to the portal.)
# ---------------------------------------------------------------------------

class ApplicationCreate(BaseModel):
    scheme_id: str
    scheme_name: str = ""
    mobile: str = ""       # citizen's own number, for a confirmation SMS/WhatsApp


class GrievanceCreate(BaseModel):
    message: str = ""


def _scheme_name(scheme_id: str, fallback: str = "") -> str:
    for s in _get_cached_schemes():
        if s.get("scheme_id") == scheme_id:
            return s.get("name", fallback) or fallback
    return fallback or scheme_id


def _notify_confirmation(mobile: str, scheme_name: str, ticket_id: str) -> str:
    """
    Best-effort transactional confirmation to the citizen's OWN number.
    Never raises and never blocks the response; gated by NOTIFICATIONS_ENABLED
    so demos don't hit Twilio with fake numbers. Returns a short status string.
    """
    if not mobile:
        return "no_mobile"
    if os.getenv("NOTIFICATIONS_ENABLED", "").lower() not in ("1", "true", "yes"):
        return "disabled"
    to = mobile if mobile.startswith("+") else f"+91{mobile.lstrip('0')}"
    msg = (f"Haqq: Your application for '{scheme_name}' is received. "
           f"Reference: {ticket_id}. Track it on the Haqq portal.")
    try:
        from utils.notifications import send_sms, send_whatsapp
        res = send_sms(to, msg)
        if not res.get("success"):
            res = send_whatsapp(to, msg)
        return "sent" if res.get("success") else "failed"
    except Exception as exc:
        logger.warning("confirmation notify failed: %s", exc)
        return "failed"


@citizen_router.post("/applications")
async def create_application(body: ApplicationCreate, citizen: dict = Depends(get_current_citizen)):
    """Record a submitted application for the citizen and return its reference."""
    ticket_id = "HAQ-" + secrets.token_hex(3).upper()   # e.g. HAQ-9F2A1C
    phone_hmac = citizen.get("phone_hmac")
    with get_db() as conn:
        conn.execute(
            """INSERT INTO tickets (ticket_id, phone_hmac, scheme_id, status, priority)
               VALUES (?, ?, ?, 'submitted', 0)""",
            (ticket_id, phone_hmac, body.scheme_id),
        )
    scheme_name = _scheme_name(body.scheme_id, body.scheme_name)
    notify = _notify_confirmation(body.mobile, scheme_name, ticket_id)
    return {
        "success": True,
        "notification": notify,   # sent | failed | disabled | no_mobile
        "application": {
            "ticket_id": ticket_id,
            "scheme_id": body.scheme_id,
            "scheme_name": scheme_name,
            "status": "submitted",
        },
    }


@citizen_router.post("/applications/{ticket_id}/grievance")
async def raise_grievance(ticket_id: str, body: GrievanceCreate, citizen: dict = Depends(get_current_citizen)):
    """Raise a grievance against one of the citizen's applications (flags it for review)."""
    phone_hmac = citizen.get("phone_hmac")
    with get_db() as conn:
        row = conn.execute(
            "SELECT ticket_id FROM tickets WHERE ticket_id = ? AND phone_hmac = ?",
            (ticket_id, phone_hmac),
        ).fetchone()
        if not row:
            return {"success": False, "message": "Application not found"}
        conn.execute(
            "UPDATE tickets SET status = 'grievance_raised', priority = 1, updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ?",
            (ticket_id,),
        )
    grievance_id = "GRV-" + secrets.token_hex(3).upper()
    logger.info("Grievance %s raised on %s: %s", grievance_id, ticket_id, body.message[:200])
    return {"success": True, "grievance_id": grievance_id, "ticket_id": ticket_id, "status": "grievance_raised"}


@citizen_router.get("/applications")
async def list_applications(citizen: dict = Depends(get_current_citizen)):
    """List the citizen's applications (most recent first) with resolved names."""
    phone_hmac = citizen.get("phone_hmac")
    with get_db() as conn:
        rows = conn.execute(
            """SELECT ticket_id, scheme_id, status, created_at, updated_at
               FROM tickets WHERE phone_hmac = ? ORDER BY created_at DESC""",
            (phone_hmac,),
        ).fetchall()
    apps = [
        {
            "ticket_id": r["ticket_id"],
            "scheme_id": r["scheme_id"],
            "scheme_name": _scheme_name(r["scheme_id"]),
            "status": r["status"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]
    return {"success": True, "count": len(apps), "applications": apps}

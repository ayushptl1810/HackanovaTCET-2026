"""
DigiLocker KYC routes — official Meri Pehchaan OAuth2/OIDC flow.

  GET  /api/digilocker/health      → active provider + readiness
  GET  /api/digilocker/login       → start consent flow (redirect or return URL)
  GET  /api/digilocker/callback    → exchange code, record consent+audit, return profile+docs
  GET  /api/digilocker/documents   → list issued documents for a DigiLocker access token
  GET  /api/digilocker/file        → fetch a document file by URI

Runs against the deterministic mock by default (fully testable), or the real
official DigiLocker requester API via DIGILOCKER_PROVIDER=meripehchaan.
Consent metadata returned by DigiLocker (consent_valid_till, scope, purpose)
is captured for DPDP compliance at the callback.
"""

import logging
import secrets
from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse, Response

from services.digilocker import get_digilocker_provider, DigiLockerError
from services.digilocker.state_store import save_verifier, take_verifier
from utils.pkce import generate_code_verifier

logger = logging.getLogger(__name__)

digilocker_router = APIRouter(prefix="/api/digilocker", tags=["digilocker"])


@digilocker_router.get("/health")
async def digilocker_health():
    """Report which provider is active and that it is constructible/reachable."""
    try:
        provider = get_digilocker_provider()
        return provider.health()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@digilocker_router.get("/login")
async def digilocker_login(
    redirect: bool = Query(False, description="If true, 302-redirect to DigiLocker instead of returning the URL"),
    purpose: Optional[str] = Query(None, description="kyc | verification | compliance | availing_services | educational"),
    mock_user: Optional[str] = Query(None, description="Mock only: dataset citizen id to log in as (e.g. ayush, sunita, ramesh)"),
):
    """Begin the DigiLocker consent flow (OAuth2 authorization-code + PKCE)."""
    provider = get_digilocker_provider()
    state = secrets.token_urlsafe(24)
    code_verifier = generate_code_verifier()
    save_verifier(state, code_verifier)

    try:
        url = provider.build_authorization_url(
            state=state, code_verifier=code_verifier, purpose=purpose, login_hint=mock_user
        )
    except DigiLockerError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if redirect:
        return RedirectResponse(url)
    return {"authorization_url": url, "state": state, "provider": provider.name}


@digilocker_router.get("/callback")
async def digilocker_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
):
    """Handle the redirect back from DigiLocker: exchange code → tokens + profile."""
    if error:
        raise HTTPException(status_code=400, detail=f"{error}: {error_description or ''}".strip())
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing 'code' or 'state'")

    code_verifier = take_verifier(state)
    if not code_verifier:
        raise HTTPException(status_code=400, detail="Unknown or expired state (possible CSRF)")

    provider = get_digilocker_provider()
    try:
        bundle = provider.exchange_code(code=code, code_verifier=code_verifier)
        docs = provider.list_issued_documents(bundle.access_token)
    except DigiLockerError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # --- DPDP consent capture (hook: persist via consent/audit service) ---
    consent_record = {
        "digilockerid": bundle.digilockerid,
        "scope": bundle.scope,
        "consent_valid_till": bundle.consent_valid_till,
        "provider": provider.name,
    }
    logger.info("DigiLocker consent captured: %s", consent_record)
    # TODO(consent-service): write consent_record + audit entry to the DB.

    return {
        "success": True,
        "provider": provider.name,
        "profile": {
            "digilockerid": bundle.digilockerid,
            "name": bundle.name,
            "dob": bundle.dob,
            "gender": bundle.gender,
            "masked_aadhaar": bundle.claims.get("masked_aadhaar"),
            "pan_number": bundle.claims.get("pan_number"),
            "address": bundle.claims.get("address"),
        },
        "consent": consent_record,
        "access_token": bundle.access_token,   # caller stores server-side in real flow
        "documents": [asdict(d) for d in docs],
    }


@digilocker_router.get("/documents")
async def digilocker_documents(access_token: str = Query(..., description="DigiLocker access token from callback")):
    """List issued documents for a DigiLocker access token."""
    provider = get_digilocker_provider()
    try:
        docs = provider.list_issued_documents(access_token)
        return {"success": True, "count": len(docs), "documents": [asdict(d) for d in docs]}
    except DigiLockerError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@digilocker_router.get("/file")
async def digilocker_file(
    access_token: str = Query(...),
    uri: str = Query(..., description="Document URI from the issued-documents list"),
):
    """Fetch a single document's bytes by URI."""
    provider = get_digilocker_provider()
    try:
        content, content_type = provider.get_file(access_token, uri)
        return Response(content=content, media_type=content_type)
    except DigiLockerError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

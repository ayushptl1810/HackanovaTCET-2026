"""
Sandbox-backed DigiLocker provider.

Adapts Sandbox's *session-based* DigiLocker flow to the shared OAuth-shaped
``DigiLockerProvider`` interface so it drops into the existing routes:

  build_authorization_url()  → init a Sandbox session, return its consent URL
                               (the session_id is returned to /callback by Sandbox
                                via the redirect and passed back to us as `code`)
  exchange_code(code=…)       → `code` IS the session_id: check status + fetch
                               user profile → TokenBundle
  list_issued_documents(sid)  → documents present on the session's profile
  get_file(sid, doc_type)     → fetch a document (Sandbox keys by doc_type, so we
                               treat the IssuedDocument.uri as the doc_type)

Field names in Sandbox responses are parsed defensively because the live
response shape can only be fully confirmed against activated live credentials.
"""

import logging
from typing import Dict, List, Optional, Tuple

from services.digilocker.base import (
    DigiLockerProvider, TokenBundle, IssuedDocument, DigiLockerError,
)
from .client import SandboxKycClient, SandboxError

logger = logging.getLogger(__name__)


def _dig(d: Dict, *keys, default=None):
    """Return the first present key from a dict (defensive field lookup)."""
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, ""):
            return d[k]
    return default


class SandboxDigiLockerProvider(DigiLockerProvider):
    name = "sandbox"

    def __init__(self) -> None:
        try:
            self._client = SandboxKycClient()
        except SandboxError as exc:
            raise DigiLockerError(str(exc)) from exc

    def build_authorization_url(
        self,
        state: str,
        code_verifier: str,
        purpose: Optional[str] = None,
        consent_valid_till: Optional[int] = None,
        doc_types: Optional[List[str]] = None,
        login_hint: Optional[str] = None,
    ) -> str:
        try:
            resp = self._client.digilocker_init_session(
                doc_types=doc_types, verified_mobile=login_hint,
            )
        except SandboxError as exc:
            raise DigiLockerError(f"session init failed: {exc}") from exc
        data = resp.get("data", resp)
        url = _dig(data, "authorization_url", "url", "consent_url", "redirect_url")
        if not url:
            raise DigiLockerError(f"session init returned no consent URL: {data}")
        return url

    def exchange_code(self, code: str, code_verifier: str) -> TokenBundle:
        # For Sandbox, `code` carries the session_id returned on the redirect.
        session_id = code
        try:
            self._client.digilocker_session_status(session_id)
            resp = self._client.digilocker_user_profile(session_id)
        except SandboxError as exc:
            raise DigiLockerError(f"profile fetch failed: {exc}") from exc

        p = resp.get("data", resp)
        return TokenBundle(
            access_token=session_id,          # session_id is our access handle
            scope="digilocker",
            digilockerid=_dig(p, "digilocker_id", "digilockerid"),
            name=_dig(p, "name", "full_name"),
            dob=_dig(p, "date_of_birth", "dob"),
            gender=_dig(p, "gender"),
            claims=p if isinstance(p, dict) else {},
        )

    def get_user_details(self, access_token: str) -> Dict:
        resp = self._client.digilocker_user_profile(access_token)
        return resp.get("data", resp)

    def list_issued_documents(self, access_token: str) -> List[IssuedDocument]:
        try:
            resp = self._client.digilocker_user_profile(access_token)
        except SandboxError as exc:
            raise DigiLockerError(str(exc)) from exc
        p = resp.get("data", resp)
        docs = p.get("documents") if isinstance(p, dict) else None
        if not docs:
            # No explicit list endpoint; surface what we know was requested.
            return [IssuedDocument(name="Aadhaar Card", uri="aadhaar", doctype="aadhaar",
                                   description="Aadhaar Card", issuer="UIDAI")]
        out: List[IssuedDocument] = []
        for d in docs:
            dt = _dig(d, "doc_type", "doctype", default="")
            out.append(IssuedDocument(
                name=_dig(d, "name", "description", default=dt),
                uri=dt, doctype=dt,
                description=_dig(d, "description", default=""),
                issuer=_dig(d, "issuer", default=""),
            ))
        return out

    def get_file(self, access_token: str, uri: str) -> Tuple[bytes, str]:
        # Sandbox addresses documents by doc_type, not URI.
        try:
            resp = self._client.digilocker_fetch_document(access_token, uri)
        except SandboxError as exc:
            raise DigiLockerError(str(exc)) from exc
        data = resp.get("data", resp)
        # Sandbox returns document content/URL in the body; expose the JSON as bytes
        # unless a direct file URL is provided.
        import json
        return json.dumps(data).encode(), "application/json"

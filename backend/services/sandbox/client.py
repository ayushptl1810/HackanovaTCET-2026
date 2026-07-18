"""
Sandbox KYC API client.

Handles authentication (token caching + auto re-auth on 401) and wraps every
Sandbox KYC endpoint we use behind typed methods. All request bodies use the
Sandbox ``@entity`` envelope exactly as documented.
"""

import logging
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import requests

from core.config import settings

logger = logging.getLogger(__name__)


class SandboxError(Exception):
    """Raised for any Sandbox API failure (auth, transport, non-2xx)."""


class SandboxKycClient:
    def __init__(self) -> None:
        # Prefer test credentials for the test host; fall back to live keys.
        self._api_key = settings.sandbox_test_api_key or settings.sandbox_api_key
        self._api_secret = settings.sandbox_test_api_secret or settings.sandbox_api_secret
        self._base = settings.sandbox_base_url.rstrip("/")
        self._auth_url = settings.sandbox_auth_url
        self._version = settings.sandbox_api_version
        self._token: Optional[str] = None
        self._lock = threading.Lock()
        if not (self._api_key and self._api_secret):
            raise SandboxError("SANDBOX API key/secret not configured")

    # ------------------------------------------------------------------ #
    # Auth
    # ------------------------------------------------------------------ #
    def _authenticate(self, force: bool = False) -> str:
        with self._lock:
            if self._token and not force:
                return self._token
            try:
                resp = requests.post(
                    self._auth_url,
                    headers={
                        "x-api-key": self._api_key,
                        "x-api-secret": self._api_secret,
                        "x-api-version": self._version,
                    },
                    timeout=20,
                )
            except requests.RequestException as exc:
                raise SandboxError(f"Sandbox auth transport error: {exc}") from exc
            if resp.status_code != 200:
                raise SandboxError(f"Sandbox auth failed: HTTP {resp.status_code}")
            body = resp.json()
            token = body.get("access_token") or (body.get("data") or {}).get("access_token")
            if not token:
                raise SandboxError("Sandbox auth returned no access_token")
            self._token = token
            return token

    def _headers(self, json_body: bool = True) -> Dict[str, str]:
        h = {
            "Authorization": self._authenticate(),
            "x-api-key": self._api_key,
            "x-api-version": self._version,
        }
        if json_body:
            h["Content-Type"] = "application/json"
        return h

    def _request(self, method: str, path: str, json: Optional[Dict] = None,
                 raw: bool = False) -> Any:
        url = f"{self._base}{path}"
        for attempt in (1, 2):  # retry once on 401 (token expiry)
            try:
                resp = requests.request(
                    method, url, headers=self._headers(json_body=json is not None),
                    json=json, timeout=30,
                )
            except requests.RequestException as exc:
                raise SandboxError(f"{method} {path} transport error: {exc}") from exc
            if resp.status_code == 401 and attempt == 1:
                self._authenticate(force=True)
                continue
            if resp.status_code >= 400:
                msg = ""
                try:
                    msg = resp.json().get("message", "")
                except Exception:
                    msg = resp.text[:200]
                raise SandboxError(f"{method} {path} → HTTP {resp.status_code}: {msg}")
            return resp.content if raw else resp.json()
        raise SandboxError(f"{method} {path} failed after re-auth")

    # ------------------------------------------------------------------ #
    # DigiLocker
    # ------------------------------------------------------------------ #
    def digilocker_verify_user(self, mobile: str) -> Dict:
        return self._request("POST", "/kyc/digilocker/user/verify", json={
            "@entity": "in.co.sandbox.kyc.digilocker.user.verification.request",
            "mobile": mobile,
        })

    def digilocker_init_session(
        self,
        doc_types: Optional[List[str]] = None,
        redirect_url: Optional[str] = None,
        verified_mobile: Optional[str] = None,
        flow: str = "signin",
    ) -> Dict:
        body = {
            "@entity": "in.co.sandbox.kyc.digilocker.session.request",
            "flow": flow,
            "redirect_url": redirect_url or settings.digilocker_redirect_uri,
            "doc_types": doc_types or ["aadhaar"],
            "options": {
                "verification_method": ["aadhaar"],
                "pinless": True,
                "usernameless": True,
            },
        }
        if verified_mobile:
            body["options"]["verified_mobile"] = verified_mobile
        return self._request("POST", "/kyc/digilocker/sessions/init", json=body)

    def digilocker_session_status(self, session_id: str) -> Dict:
        return self._request("GET", f"/kyc/digilocker/sessions/{session_id}/status")

    def digilocker_user_profile(self, session_id: str) -> Dict:
        return self._request("GET", f"/kyc/digilocker/sessions/{session_id}/user/profile")

    def digilocker_fetch_document(self, session_id: str, doc_type: str) -> Dict:
        return self._request(
            "GET", f"/kyc/digilocker/sessions/{session_id}/documents/{doc_type}"
        )

    # ------------------------------------------------------------------ #
    # Direct Aadhaar OKYC (OTP)
    # ------------------------------------------------------------------ #
    def aadhaar_generate_otp(self, aadhaar_number: str, reason: str = "For KYC") -> Dict:
        return self._request("POST", "/kyc/aadhaar/okyc/otp", json={
            "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
            "aadhaar_number": aadhaar_number,
            "consent": "y",
            "reason": reason,
        })

    def aadhaar_verify_otp(self, reference_id: str, otp: str) -> Dict:
        return self._request("POST", "/kyc/aadhaar/okyc/otp/verify", json={
            "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
            "reference_id": reference_id,
            "otp": otp,
        })

    # ------------------------------------------------------------------ #
    # PAN
    # ------------------------------------------------------------------ #
    def pan_verify(self, pan: str, name_as_per_pan: str, date_of_birth: str,
                   reason: str = "For onboarding customers") -> Dict:
        return self._request("POST", "/kyc/pan/verify", json={
            "@entity": "in.co.sandbox.kyc.pan_verification.request",
            "pan": pan,
            "name_as_per_pan": name_as_per_pan,
            "date_of_birth": date_of_birth,
            "consent": "Y",
            "reason": reason,
        })

    def pan_aadhaar_link_status(self, pan: str, aadhaar_number: str,
                                reason: str = "For verification") -> Dict:
        return self._request("POST", "/kyc/pan-aadhaar/status", json={
            "@entity": "in.co.sandbox.kyc.pan_aadhaar.status",
            "pan": pan,
            "aadhaar_number": aadhaar_number,
            "consent": "y",
            "reason": reason,
        })

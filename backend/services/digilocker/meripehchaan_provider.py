"""
Official DigiLocker "Meri Pehchaan" Requester provider.

Implements the National Single Sign-On / DigiLocker Requester API v2.3
(MeitY / NeGD) using OAuth 2.0 authorization-code flow with PKCE and
OpenID Connect. Endpoints per the specification:

  Authorize   GET  {base}/oauth2/1/authorize
  Token(OIDC) POST {base}/oauth2/2/token       (returns id_token)
  User        GET  {base}/oauth2/1/user
  Issued docs GET  {base}/oauth2/2/files/issued
  File by URI GET  {base}/oauth2/1/file/{uri}
  Refresh     POST {base}/oauth2/1/token       (grant_type=refresh_token)
  Revoke      POST {base}/oauth2/1/revoke

Requires partner-issued client_id / client_secret and a pre-registered
redirect_uri (DigiLocker Partner Portal). Configure via DIGILOCKER_* settings.
"""

import logging
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode

import requests

from core.config import settings
from utils.pkce import code_challenge_s256
from .base import DigiLockerProvider, TokenBundle, IssuedDocument, DigiLockerError

logger = logging.getLogger(__name__)


class MeriPehchaanDigiLockerProvider(DigiLockerProvider):
    name = "meripehchaan"

    def __init__(self) -> None:
        self._base = settings.digilocker_base_url.rstrip("/")
        self._client_id = settings.digilocker_client_id
        self._client_secret = settings.digilocker_client_secret
        self._redirect_uri = settings.digilocker_redirect_uri
        self._scope = settings.digilocker_scope
        self._jwks_url = settings.digilocker_jwks_url
        if not (self._client_id and self._client_secret):
            raise DigiLockerError(
                "DIGILOCKER_CLIENT_ID / DIGILOCKER_CLIENT_SECRET not configured. "
                "Register on the DigiLocker Partner Portal to obtain them."
            )

    # ------------------------------------------------------------------ #
    # 1. Authorization
    # ------------------------------------------------------------------ #
    def build_authorization_url(
        self,
        state: str,
        code_verifier: str,
        purpose: Optional[str] = None,
        consent_valid_till: Optional[int] = None,
        doc_types: Optional[List[str]] = None,
        login_hint: Optional[str] = None,
    ) -> str:
        params = {
            "response_type": "code",
            "client_id": self._client_id,
            "redirect_uri": self._redirect_uri,
            "state": state,
            "code_challenge": code_challenge_s256(code_verifier),
            "code_challenge_method": "S256",
            "scope": self._scope,
        }
        if purpose:
            params["purpose"] = purpose            # kyc | verification | compliance | ...
        if consent_valid_till:
            params["consent_valid_till"] = str(consent_valid_till)
        if doc_types:
            params["req_doctype"] = ",".join(doc_types)  # e.g. "PANCR,DRVLC"
        return f"{self._base}/oauth2/1/authorize?{urlencode(params)}"

    # ------------------------------------------------------------------ #
    # 2. Token exchange (OpenID Connect endpoint → id_token)
    # ------------------------------------------------------------------ #
    def exchange_code(self, code: str, code_verifier: str) -> TokenBundle:
        data = {
            "code": code,
            "grant_type": "authorization_code",
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "redirect_uri": self._redirect_uri,
            "code_verifier": code_verifier,
        }
        try:
            resp = requests.post(
                f"{self._base}/oauth2/2/token",
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=20,
            )
        except requests.RequestException as exc:
            raise DigiLockerError(f"Token exchange transport error: {exc}") from exc

        if resp.status_code != 200:
            raise DigiLockerError(f"Token exchange failed: HTTP {resp.status_code} {resp.text[:200]}")
        return self._to_bundle(resp.json())

    def refresh(self, refresh_token: str) -> TokenBundle:
        try:
            resp = requests.post(
                f"{self._base}/oauth2/1/token",
                data={"refresh_token": refresh_token, "grant_type": "refresh_token"},
                auth=(self._client_id, self._client_secret),  # HTTP Basic
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=20,
            )
        except requests.RequestException as exc:
            raise DigiLockerError(f"Refresh transport error: {exc}") from exc
        if resp.status_code != 200:
            raise DigiLockerError(f"Refresh failed: HTTP {resp.status_code} {resp.text[:200]}")
        return self._to_bundle(resp.json())

    def revoke(self, token: str) -> None:
        try:
            resp = requests.post(
                f"{self._base}/oauth2/1/revoke",
                data={"token": token},
                auth=(self._client_id, self._client_secret),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=15,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise DigiLockerError(f"Revoke failed: {exc}") from exc

    # ------------------------------------------------------------------ #
    # 3. Account & documents
    # ------------------------------------------------------------------ #
    def get_user_details(self, access_token: str) -> Dict:
        resp = self._get("/oauth2/1/user", access_token)
        return resp.json()

    def list_issued_documents(self, access_token: str) -> List[IssuedDocument]:
        resp = self._get("/oauth2/2/files/issued", access_token)
        items = resp.json().get("items", [])
        docs: List[IssuedDocument] = []
        for it in items:
            mime = it.get("mime", "")
            if isinstance(mime, list):
                mime = ",".join(str(m) for m in mime)
            docs.append(
                IssuedDocument(
                    name=it.get("name", ""),
                    uri=it.get("uri", ""),
                    doctype=it.get("doctype", ""),
                    description=it.get("description", ""),
                    issuer=it.get("issuer", ""),
                    issuerid=it.get("issuerid", ""),
                    mime=mime,
                    date=it.get("date"),
                )
            )
        return docs

    def get_file(self, access_token: str, uri: str) -> Tuple[bytes, str]:
        resp = self._get(f"/oauth2/1/file/{uri}", access_token, stream=False)
        content_type = resp.headers.get("Content-Type", "application/octet-stream")
        return resp.content, content_type

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _get(self, path: str, access_token: str, stream: bool = False) -> requests.Response:
        try:
            resp = requests.get(
                f"{self._base}{path}",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=20,
                stream=stream,
            )
        except requests.RequestException as exc:
            raise DigiLockerError(f"GET {path} transport error: {exc}") from exc
        if resp.status_code == 401:
            raise DigiLockerError("invalid_token: access token invalid or expired")
        if resp.status_code == 403:
            raise DigiLockerError("insufficient_scope: token lacks required scope")
        if resp.status_code >= 400:
            raise DigiLockerError(f"GET {path} failed: HTTP {resp.status_code}")
        return resp

    def _decode_id_token(self, id_token: str) -> Dict:
        """
        Decode the OIDC id_token claims.

        In production the signature MUST be verified against DigiLocker's JWKS.
        If DIGILOCKER_JWKS_URL is set we verify; otherwise (dev) we decode the
        payload without verification and log a warning.
        """
        if not id_token:
            return {}
        try:
            import jwt
            if self._jwks_url and not settings.debug:
                jwk_client = jwt.PyJWKClient(self._jwks_url)
                signing_key = jwk_client.get_signing_key_from_jwt(id_token)
                return jwt.decode(
                    id_token,
                    signing_key.key,
                    algorithms=["RS256"],
                    audience=self._client_id,
                    options={"verify_aud": False},
                )
            if not settings.debug:
                logger.error("id_token signature NOT verified — set DIGILOCKER_JWKS_URL in production")
            else:
                logger.warning("id_token decoded without signature verification (debug mode)")
            return jwt.decode(id_token, options={"verify_signature": False})
        except Exception as exc:
            logger.warning("Failed to decode id_token: %s", exc)
            return {}

    def _to_bundle(self, body: Dict) -> TokenBundle:
        id_token = body.get("id_token")
        claims = self._decode_id_token(id_token) if id_token else {}
        return TokenBundle(
            access_token=body.get("access_token", ""),
            expires_in=int(body.get("expires_in", 0) or 0),
            refresh_token=body.get("refresh_token"),
            id_token=id_token,
            scope=body.get("scope", ""),
            consent_valid_till=body.get("consent_valid_till"),
            digilockerid=body.get("digilockerid") or claims.get("user_sso_id"),
            name=body.get("name") or claims.get("given_name"),
            dob=body.get("dob") or claims.get("birthdate"),
            gender=body.get("gender"),
            claims=claims,
        )

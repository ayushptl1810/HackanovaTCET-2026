"""
Deterministic mock DigiLocker provider (OAuth2/OIDC-shaped).

Mirrors the official Meri Pehchaan flow — authorize URL, code exchange,
id_token claims, issued documents, file-by-URI — with no network, no
credentials, and no partner onboarding. Selected by default
(``DIGILOCKER_PROVIDER=mock``) so dev, CI, and tests run reproducibly.

MUST NOT be used in production (the factory/startup guards against it).
"""

import base64
import json
import time
import uuid
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode

from .base import DigiLockerProvider, TokenBundle, IssuedDocument, DigiLockerError

_FIXTURE_DOCS: List[IssuedDocument] = [
    IssuedDocument(
        name="Class XII Marksheet", uri="in.gov.cbse-HSCER-201412345678",
        doctype="HSCER", description="Class XII Marksheet",
        issuer="CBSE", issuerid="in.gov.cbse", mime="application/pdf",
        date="2015-05-12T15:50:38Z",
    ),
    IssuedDocument(
        name="Income Certificate", uri="in.gov.delhi-INCER-98765432",
        doctype="INCER", description="Income Certificate",
        issuer="Delhi eDistrict", issuerid="in.gov.delhi",
        mime="application/pdf,application/xml", date="2015-05-12T15:50:38Z",
    ),
]


def _fake_jwt(claims: Dict) -> str:
    """Build an unsigned JWT-looking string (header.payload.signature)."""
    def b64(obj) -> str:
        return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")
    return f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64(claims)}.mocksig"


class MockDigiLockerProvider(DigiLockerProvider):
    name = "mock"

    def __init__(self) -> None:
        # code → issued-at, to make exchange one-shot-ish and realistic.
        self._codes: Dict[str, float] = {}
        self._tokens: Dict[str, Dict] = {}

    def build_authorization_url(
        self,
        state: str,
        code_verifier: str,
        purpose: Optional[str] = None,
        consent_valid_till: Optional[int] = None,
        doc_types: Optional[List[str]] = None,
    ) -> str:
        code = f"mockcode-{uuid.uuid4().hex[:16]}"
        self._codes[code] = time.time()
        # A local "consent page" that immediately bounces back with the code.
        params = {"state": state, "code": code}
        return f"https://mock.digilocker.local/consent?{urlencode(params)}"

    def exchange_code(self, code: str, code_verifier: str) -> TokenBundle:
        # In the mock, any code produced by build_authorization_url is accepted;
        # unknown codes still succeed to keep manual testing frictionless.
        access_token = f"mock-at-{uuid.uuid4().hex}"
        claims = {
            "sub": "mock.dl",
            "given_name": "Ayush Patel",
            "birthdate": "01011990",
            "user_sso_id": "DL-123e4567-e89b-12d3-a456-426655440000",
            "masked_aadhaar": "xxxxxxxx1234",
            "pan_number": "ABCDK1232G",
        }
        self._tokens[access_token] = claims
        return TokenBundle(
            access_token=access_token,
            expires_in=3600,
            refresh_token=f"mock-rt-{uuid.uuid4().hex}",
            id_token=_fake_jwt(claims),
            scope="openid files.issueddocs",
            consent_valid_till=int(time.time()) + 3600,
            digilockerid=claims["user_sso_id"],
            name=claims["given_name"],
            dob=claims["birthdate"],
            gender="M",
            claims=claims,
        )

    def get_user_details(self, access_token: str) -> Dict:
        claims = self._tokens.get(access_token, {})
        return {
            "digilockerid": claims.get("user_sso_id", "DL-mock"),
            "name": claims.get("given_name", "Ayush Patel"),
            "dob": claims.get("birthdate", "01011990"),
            "gender": "M",
            "eaadhaar": "Y",
        }

    def list_issued_documents(self, access_token: str) -> List[IssuedDocument]:
        return list(_FIXTURE_DOCS)

    def get_file(self, access_token: str, uri: str) -> Tuple[bytes, str]:
        if not any(d.uri == uri for d in _FIXTURE_DOCS):
            raise DigiLockerError(f"No file found for URI: {uri}")
        return b"%PDF-1.4 mock document bytes", "application/pdf"

    def refresh(self, refresh_token: str) -> TokenBundle:
        return self.exchange_code("mock-refresh", "")

    def revoke(self, token: str) -> None:
        self._tokens.pop(token, None)

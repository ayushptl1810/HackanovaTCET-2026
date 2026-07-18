"""
Deterministic, dataset-backed mock DigiLocker provider (OAuth2/OIDC-shaped).

Serves synthetic citizens (Aadhaar + issued documents) from
``data/digilocker_mock_dataset.json`` through the same flow as the real
Meri Pehchaan provider — authorize URL, code exchange, id_token claims,
issued documents, file-by-URI — with no network, no credentials, no signup.

Pick which citizen "logs in" via the ``login_hint`` (their dataset ``id``);
defaults to the first citizen. Selected by ``DIGILOCKER_PROVIDER=mock``.

MUST NOT be used in production (the factory guards against it).
"""

import base64
import json
import os
import time
import uuid
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode

from .base import DigiLockerProvider, TokenBundle, IssuedDocument, DigiLockerError

_DATASET_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "digilocker_mock_dataset.json"
)


def _load_dataset() -> List[Dict]:
    with open(_DATASET_PATH, "r", encoding="utf-8") as f:
        return json.load(f).get("citizens", [])


def _fake_jwt(claims: Dict) -> str:
    def b64(obj) -> str:
        return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")
    return f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64(claims)}.mocksig"


def _docs_for(citizen: Dict) -> List[IssuedDocument]:
    return [
        IssuedDocument(
            name=d.get("name", ""), uri=d.get("uri", ""), doctype=d.get("doctype", ""),
            description=d.get("description", ""), issuer=d.get("issuer", ""),
            issuerid=d.get("issuerid", ""), mime=d.get("mime", ""), date=d.get("date"),
        )
        for d in citizen.get("documents", [])
    ]


class MockDigiLockerProvider(DigiLockerProvider):
    name = "mock"

    def __init__(self) -> None:
        self._citizens = _load_dataset()
        if not self._citizens:
            raise DigiLockerError("Mock dataset is empty")
        self._by_id = {c["id"]: c for c in self._citizens}
        self._code_to_citizen: Dict[str, str] = {}   # code → citizen id
        self._token_to_citizen: Dict[str, str] = {}   # access_token → citizen id

    def _resolve(self, citizen_id: Optional[str]) -> Dict:
        if citizen_id and citizen_id in self._by_id:
            return self._by_id[citizen_id]
        return self._citizens[0]

    def build_authorization_url(
        self,
        state: str,
        code_verifier: str,
        purpose: Optional[str] = None,
        consent_valid_till: Optional[int] = None,
        doc_types: Optional[List[str]] = None,
        login_hint: Optional[str] = None,
    ) -> str:
        citizen = self._resolve(login_hint)
        code = f"mockcode-{uuid.uuid4().hex[:16]}"
        self._code_to_citizen[code] = citizen["id"]
        params = {"state": state, "code": code, "user": citizen["id"]}
        return f"https://mock.digilocker.local/consent?{urlencode(params)}"

    def exchange_code(self, code: str, code_verifier: str) -> TokenBundle:
        citizen = self._resolve(self._code_to_citizen.pop(code, None))
        access_token = f"mock-at-{uuid.uuid4().hex}"
        self._token_to_citizen[access_token] = citizen["id"]
        claims = {
            "sub": citizen["id"],
            "given_name": citizen["name"],
            "birthdate": citizen["dob"],
            "user_sso_id": citizen["digilockerid"],
            "masked_aadhaar": citizen.get("masked_aadhaar", ""),
            "pan_number": citizen.get("pan_number", ""),
            "address": citizen.get("address", ""),
        }
        return TokenBundle(
            access_token=access_token,
            expires_in=3600,
            refresh_token=f"mock-rt-{uuid.uuid4().hex}",
            id_token=_fake_jwt(claims),
            scope="openid files.issueddocs",
            consent_valid_till=int(time.time()) + 3600,
            digilockerid=citizen["digilockerid"],
            name=citizen["name"],
            dob=citizen["dob"],
            gender=citizen["gender"],
            claims=claims,
        )

    def get_user_details(self, access_token: str) -> Dict:
        citizen = self._resolve(self._token_to_citizen.get(access_token))
        return {
            "digilockerid": citizen["digilockerid"],
            "name": citizen["name"],
            "dob": citizen["dob"],
            "gender": citizen["gender"],
            "masked_aadhaar": citizen.get("masked_aadhaar", ""),
            "eaadhaar": "Y",
        }

    def list_issued_documents(self, access_token: str) -> List[IssuedDocument]:
        citizen = self._resolve(self._token_to_citizen.get(access_token))
        return _docs_for(citizen)

    def get_file(self, access_token: str, uri: str) -> Tuple[bytes, str]:
        citizen = self._resolve(self._token_to_citizen.get(access_token))
        doc = next((d for d in citizen.get("documents", []) if d.get("uri") == uri), None)
        if not doc:
            raise DigiLockerError(f"No file found for URI: {uri}")
        pdf = f"%PDF-1.4 mock {doc.get('description','doc')} for {citizen['name']}".encode()
        return pdf, "application/pdf"

    def refresh(self, refresh_token: str) -> TokenBundle:
        return self.exchange_code("mock-refresh", "")

    def revoke(self, token: str) -> None:
        self._token_to_citizen.pop(token, None)

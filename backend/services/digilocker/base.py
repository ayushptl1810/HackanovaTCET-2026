"""
Provider-agnostic DigiLocker interface (official Meri Pehchaan OAuth2/OIDC model).

Any concrete provider (mock for dev/test, or the real MeriPehchaan requester)
implements ``DigiLockerProvider``. Call sites depend only on this contract.

Flow (server-side web application, per Meri Pehchaan Requester API v2.3):
  1. build_authorization_url(state, code_verifier)  → redirect the citizen there
  2. citizen consents on the DigiLocker web page, returns to redirect_uri with ?code
  3. exchange_code(code, code_verifier)             → TokenBundle (access + id_token)
  4. list_issued_documents(access_token) / get_file(access_token, uri) / get_user_details
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


class DigiLockerError(Exception):
    """Raised for any provider-level failure (auth, token, fetch, transport)."""


@dataclass
class TokenBundle:
    """Result of a successful token exchange / refresh."""
    access_token: str
    expires_in: int = 0
    refresh_token: Optional[str] = None
    id_token: Optional[str] = None            # raw JWT
    scope: str = ""
    consent_valid_till: Optional[int] = None  # UNIX ts (IST) of consent expiry
    digilockerid: Optional[str] = None
    name: Optional[str] = None
    dob: Optional[str] = None                 # DDMMYYYY
    gender: Optional[str] = None              # M | F | T
    claims: Dict = field(default_factory=dict)  # decoded id_token claims


@dataclass
class IssuedDocument:
    """A document issued to the citizen in their DigiLocker."""
    name: str
    uri: str
    doctype: str = ""
    description: str = ""
    issuer: str = ""
    issuerid: str = ""
    mime: str = ""
    date: Optional[str] = None


class DigiLockerProvider(ABC):
    """Contract every DigiLocker provider must satisfy."""

    #: short identifier surfaced in logs/audit (e.g. "mock", "meripehchaan")
    name: str = "base"

    @abstractmethod
    def build_authorization_url(
        self,
        state: str,
        code_verifier: str,
        purpose: Optional[str] = None,
        consent_valid_till: Optional[int] = None,
        doc_types: Optional[List[str]] = None,
        login_hint: Optional[str] = None,
    ) -> str:
        """Build the DigiLocker authorize URL (PKCE S256) to redirect the user to.

        ``login_hint`` is a standard OIDC param; the mock uses it to select which
        synthetic citizen logs in. The real provider may pass it through or ignore it.
        """

    @abstractmethod
    def exchange_code(self, code: str, code_verifier: str) -> TokenBundle:
        """Exchange an authorization code for tokens (+ decoded id_token claims)."""

    @abstractmethod
    def get_user_details(self, access_token: str) -> Dict:
        """Fetch DigiLocker account details for the bearer token."""

    @abstractmethod
    def list_issued_documents(self, access_token: str) -> List[IssuedDocument]:
        """List the citizen's issued documents."""

    @abstractmethod
    def get_file(self, access_token: str, uri: str) -> Tuple[bytes, str]:
        """Fetch a document file by URI. Returns (content_bytes, content_type)."""

    def refresh(self, refresh_token: str) -> TokenBundle:
        """Refresh an access token. Optional; providers may raise if unsupported."""
        raise DigiLockerError("refresh not supported by this provider")

    def revoke(self, token: str) -> None:
        """Revoke an access/refresh token. Optional."""
        raise DigiLockerError("revoke not supported by this provider")

    def health(self) -> Dict[str, str]:
        """Lightweight readiness probe used by tests and /health."""
        return {"provider": self.name, "status": "ok"}

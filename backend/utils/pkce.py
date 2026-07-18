"""
PKCE (Proof Key for Code Exchange, RFC 7636) helpers for the DigiLocker
OAuth 2.0 authorization-code flow.

DigiLocker requires code_challenge_method=S256:
    code_challenge = base64url_no_pad(sha256(code_verifier))
"""

import base64
import hashlib
import secrets


def generate_code_verifier(length: int = 64) -> str:
    """High-entropy verifier, 43–128 chars from the unreserved set (RFC 7636)."""
    length = max(43, min(128, length))
    # token_urlsafe yields [A-Za-z0-9_-]; trim to requested length.
    return secrets.token_urlsafe(96)[:length]


def code_challenge_s256(code_verifier: str) -> str:
    """Base64URL(SHA256(verifier)) with padding stripped."""
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")

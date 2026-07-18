"""
Token issuance / verification for citizen sessions.

Lightweight JWT (HS256) signed with JWT_SECRET. The token subject is the
citizen's phone number; downstream lookups go through the HMAC as usual, so
no raw phone is trusted from the client beyond the signed token.
"""

import time
from typing import Dict, Optional

import jwt

from core.config import settings


def create_access_token(subject: str, role: str = "citizen",
                        extra: Optional[Dict] = None) -> str:
    now = int(time.time())
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + settings.access_token_ttl_minutes * 60,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Dict:
    """Decode and validate a token. Raises jwt exceptions on failure."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])

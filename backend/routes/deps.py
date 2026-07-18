"""
Shared FastAPI dependencies — authentication / current-user resolution.
"""

import logging

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.security import decode_access_token
from services.auth_service import get_profile_by_phone

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=True)


def get_current_citizen(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """Resolve the logged-in citizen from a Bearer token, or 401."""
    try:
        payload = decode_access_token(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("role") != "citizen":
        raise HTTPException(status_code=403, detail="Not a citizen token")

    phone = payload.get("sub")
    profile = get_profile_by_phone(phone) if phone else None
    if profile is None:
        raise HTTPException(status_code=401, detail="Unknown citizen")
    # Carry the phone through for downstream lookups (slabs, tickets).
    profile["_phone"] = phone
    return profile

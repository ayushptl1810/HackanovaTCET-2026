"""
Cryptographic helpers for phone number hashing and PIN management.

- Phone numbers: HMAC-SHA256 for deterministic lookup (never stored raw).
- PINs: bcrypt with cost factor 12.
"""

import hashlib
import hmac
import os
import logging

import bcrypt

logger = logging.getLogger(__name__)

# Loaded once from env; must be set in production.
_HMAC_SECRET = os.getenv("PHONE_HMAC_SECRET", "dev-secret-change-me").encode()


# ---------------------------------------------------------------------------
# Phone HMAC (deterministic lookup key)
# ---------------------------------------------------------------------------

def phone_to_hmac(phone: str) -> str:
    """Return a hex HMAC-SHA256 digest of the phone number."""
    normalised = phone.strip().replace("+", "").replace(" ", "")
    return hmac.new(_HMAC_SECRET, normalised.encode(), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------------------
# PIN hashing (bcrypt, cost 12)
# ---------------------------------------------------------------------------

def hash_pin(pin: str) -> str:
    """Hash a 6-digit PIN with bcrypt (cost 12). Returns UTF-8 hash string."""
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_pin(pin: str, pin_hash: str) -> bool:
    """Constant-time comparison of entered PIN against stored bcrypt hash."""
    try:
        return bcrypt.checkpw(pin.encode(), pin_hash.encode())
    except Exception as exc:
        logger.warning("PIN verification error: %s", exc)
        return False

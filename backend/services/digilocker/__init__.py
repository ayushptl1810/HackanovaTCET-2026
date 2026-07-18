"""
DigiLocker integration package (official Meri Pehchaan OAuth2/OIDC model).

Exposes a provider-agnostic interface so the app is fully testable with a
deterministic mock, and runs against the real official DigiLocker requester
API once partner credentials are configured — selected via the
``DIGILOCKER_PROVIDER`` setting, with no call-site changes.
"""

from .base import (
    DigiLockerProvider,
    TokenBundle,
    IssuedDocument,
    DigiLockerError,
)
from .factory import get_digilocker_provider

__all__ = [
    "DigiLockerProvider",
    "TokenBundle",
    "IssuedDocument",
    "DigiLockerError",
    "get_digilocker_provider",
]

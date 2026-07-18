"""
Provider factory — selects the DigiLocker implementation from config.

    DIGILOCKER_PROVIDER=mock          → MockDigiLockerProvider   (dev/CI/test only)
    DIGILOCKER_PROVIDER=meripehchaan  → real official DigiLocker (needs partner creds)

Production guard: the mock is refused when ENVIRONMENT=production so a
misconfiguration can never serve fake KYC data to real users.
"""

import logging
from functools import lru_cache

from core.config import settings
from .base import DigiLockerProvider, DigiLockerError

logger = logging.getLogger(__name__)


@lru_cache
def get_digilocker_provider() -> DigiLockerProvider:
    choice = (settings.digilocker_provider or "mock").lower()

    if choice == "mock" and settings.is_production:
        raise RuntimeError(
            "DIGILOCKER_PROVIDER=mock is not allowed in production. "
            "Set DIGILOCKER_PROVIDER=meripehchaan with valid partner credentials."
        )

    if choice == "meripehchaan":
        from .meripehchaan_provider import MeriPehchaanDigiLockerProvider
        return MeriPehchaanDigiLockerProvider()

    if choice == "mock":
        from .mock_provider import MockDigiLockerProvider
        return MockDigiLockerProvider()

    raise DigiLockerError(f"Unknown DIGILOCKER_PROVIDER: {choice!r}")

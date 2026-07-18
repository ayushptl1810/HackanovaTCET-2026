"""
Sandbox (api.sandbox.co.in) KYC integration.

One client covering every Sandbox KYC endpoint we use — DigiLocker session
flow, direct Aadhaar OKYC (OTP), PAN verification, PAN-Aadhaar link status —
plus a DigiLocker provider that plugs into the shared DigiLockerProvider
interface.

NOTE ON ENVIRONMENTS:
  - test-api.sandbox.co.in returns CANNED responses only for exact saved
    examples (per Sandbox docs) — good for contract validation, not real data.
  - api.sandbox.co.in (live) returns REAL data but requires product activation.
Switch via SANDBOX_BASE_URL. Auth always goes through SANDBOX_AUTH_URL.
"""

from .client import SandboxKycClient, SandboxError
from .digilocker_provider import SandboxDigiLockerProvider

__all__ = ["SandboxKycClient", "SandboxError", "SandboxDigiLockerProvider"]

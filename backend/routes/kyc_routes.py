"""
Standalone KYC routes backed by Sandbox — direct Aadhaar OKYC (OTP),
PAN verification, and PAN-Aadhaar link status. Separate from the DigiLocker
document flow (which lives in digilocker_routes).

These require Sandbox credentials; against the test host they return canned
data for exact saved examples, against live they return real verification.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.sandbox import SandboxKycClient, SandboxError

logger = logging.getLogger(__name__)

kyc_router = APIRouter(prefix="/api/kyc", tags=["kyc"])


def _client() -> SandboxKycClient:
    try:
        return SandboxKycClient()
    except SandboxError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class AadhaarOtpRequest(BaseModel):
    aadhaar_number: str
    reason: str = "For KYC"


class AadhaarOtpVerify(BaseModel):
    reference_id: str
    otp: str


class PanVerifyRequest(BaseModel):
    pan: str
    name_as_per_pan: str
    date_of_birth: str  # DD/MM/YYYY
    reason: str = "For onboarding customers"


class PanAadhaarStatusRequest(BaseModel):
    pan: str
    aadhaar_number: str
    reason: str = "For verification"


def _call(fn, *args):
    try:
        return {"success": True, "data": fn(*args)}
    except SandboxError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@kyc_router.post("/aadhaar/otp")
async def aadhaar_generate_otp(req: AadhaarOtpRequest):
    return _call(_client().aadhaar_generate_otp, req.aadhaar_number, req.reason)


@kyc_router.post("/aadhaar/otp/verify")
async def aadhaar_verify_otp(req: AadhaarOtpVerify):
    return _call(_client().aadhaar_verify_otp, req.reference_id, req.otp)


@kyc_router.post("/pan/verify")
async def pan_verify(req: PanVerifyRequest):
    return _call(_client().pan_verify, req.pan, req.name_as_per_pan, req.date_of_birth, req.reason)


@kyc_router.post("/pan-aadhaar/status")
async def pan_aadhaar_status(req: PanAadhaarStatusRequest):
    return _call(_client().pan_aadhaar_link_status, req.pan, req.aadhaar_number, req.reason)

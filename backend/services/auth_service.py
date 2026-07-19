"""
Auth service – citizen registration, PIN login, and profile lookup.

All phone numbers go through HMAC before touching the DB.
All PINs go through bcrypt before storage.
"""

import logging
from typing import Optional, Dict, Any

from db.models import get_db
from utils.crypto import phone_to_hmac, hash_pin, verify_pin

logger = logging.getLogger(__name__)


# ---- Slab mapping helpers (DTMF digit → human label) ----------------------

AGE_SLABS = {"1": "0-17", "2": "18-35", "3": "36-59", "4": "60+"}
GENDER_MAP = {"1": "M", "2": "F", "3": "O"}
INCOME_SLABS = {"1": "<2L", "2": "2-5L", "3": "5L+"}
OCCUPATION_MAP = {"1": "student", "2": "farmer", "3": "govt", "4": "other"}


def _row_to_dict(row) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    return dict(row)


# ---- Public API ------------------------------------------------------------

def register_citizen(
    phone: str,
    pin: str,
    age_choice: str = "",
    gender_choice: str = "",
    income_choice: str = "",
    occupation_choice: str = "",
    preferred_lang: str = "hi",
    annual_income: int = 0,
    state: str = "",
) -> Dict[str, Any]:
    """
    Create a new citizen_profiles row (verified_tier=0).

    ``annual_income`` (exact ₹/year, optional) makes eligibility checks
    definitive; when 0/absent we fall back to the coarser income_slab range.

    Returns the created profile dict (without sensitive fields).
    Raises ValueError if the phone is already registered.
    """
    hmac_key = phone_to_hmac(phone)
    pin_hashed = hash_pin(pin)

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM citizen_profiles WHERE phone_hmac = ?", (hmac_key,)
        ).fetchone()
        if existing:
            raise ValueError("Phone number already registered")

        conn.execute(
            """INSERT INTO citizen_profiles
               (phone_hmac, pin_hash, age_slab, gender, income_slab,
                annual_income, occupation, state, preferred_lang, verified_tier)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                hmac_key,
                pin_hashed,
                AGE_SLABS.get(age_choice, age_choice),
                GENDER_MAP.get(gender_choice, gender_choice),
                INCOME_SLABS.get(income_choice, income_choice),
                int(annual_income or 0),
                OCCUPATION_MAP.get(occupation_choice, occupation_choice),
                (state or "").strip(),
                preferred_lang,
            ),
        )

    return get_profile_by_phone(phone)


def ensure_demo_citizen(
    phone: str,
    name: str,
    age_slab: str,
    gender: str,
    income_slab: str,
    annual_income: int,
    occupation: str,
    state: str,
    pin: str = "1234",
) -> Dict[str, Any]:
    """
    Idempotently create/refresh a demo citizen with a real NAME and STORED-format
    slabs (e.g. age_slab='18-35', gender='M', income_slab='<2L'). Used by the
    one-tap demo login so the whole app (greeting, auto-fill, applications,
    DigiLocker match) shows a consistent identity. Safe to call repeatedly.
    """
    hmac_key = phone_to_hmac(phone)
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM citizen_profiles WHERE phone_hmac = ?", (hmac_key,)
        ).fetchone()
        if row:
            conn.execute(
                """UPDATE citizen_profiles
                   SET name=?, age_slab=?, gender=?, income_slab=?,
                       annual_income=?, occupation=?, state=? WHERE phone_hmac=?""",
                (name, age_slab, gender, income_slab, int(annual_income or 0),
                 occupation, state, hmac_key),
            )
        else:
            conn.execute(
                """INSERT INTO citizen_profiles
                   (phone_hmac, pin_hash, name, age_slab, gender, income_slab,
                    annual_income, occupation, state, preferred_lang, verified_tier)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'hi', 1)""",
                (hmac_key, hash_pin(pin), name, age_slab, gender, income_slab,
                 int(annual_income or 0), occupation, state),
            )
    return get_profile_by_phone(phone)


def login_citizen(phone: str, pin: str) -> Optional[Dict[str, Any]]:
    """
    Verify PIN for a registered citizen.

    Returns profile dict on success, None on failure.
    Increments failed_pin_count on bad PIN; resets on success.
    """
    hmac_key = phone_to_hmac(phone)

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM citizen_profiles WHERE phone_hmac = ?", (hmac_key,)
        ).fetchone()

        if row is None:
            return None

        profile = _row_to_dict(row)

        if not verify_pin(pin, profile["pin_hash"]):
            conn.execute(
                "UPDATE citizen_profiles SET failed_pin_count = failed_pin_count + 1 WHERE phone_hmac = ?",
                (hmac_key,),
            )
            return None

        # Success – reset failures, update last_seen
        conn.execute(
            "UPDATE citizen_profiles SET failed_pin_count = 0, last_seen = CURRENT_TIMESTAMP WHERE phone_hmac = ?",
            (hmac_key,),
        )

    safe = {k: v for k, v in profile.items() if k not in ("pin_hash", "phone_encrypted")}
    return safe


def is_registered(phone: str) -> bool:
    """Check if a phone number has a profile."""
    hmac_key = phone_to_hmac(phone)
    with get_db() as conn:
        row = conn.execute(
            "SELECT 1 FROM citizen_profiles WHERE phone_hmac = ?", (hmac_key,)
        ).fetchone()
    return row is not None


def get_profile_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    """Return the citizen profile dict (sans sensitive fields)."""
    hmac_key = phone_to_hmac(phone)
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM citizen_profiles WHERE phone_hmac = ?", (hmac_key,)
        ).fetchone()
    if row is None:
        return None
    profile = _row_to_dict(row)
    return {k: v for k, v in profile.items() if k not in ("pin_hash", "phone_encrypted")}


def get_profile_slabs(phone: str) -> Optional[Dict[str, str]]:
    """Return just the slab fields for eligibility matching."""
    profile = get_profile_by_phone(phone)
    if profile is None:
        return None
    return {
        "age_slab": profile.get("age_slab", ""),
        "gender": profile.get("gender", ""),
        "income_slab": profile.get("income_slab", ""),
        "annual_income": profile.get("annual_income", 0),
        "occupation": profile.get("occupation", ""),
        "state": profile.get("state", ""),
        "docs_available": profile.get("docs_available", "[]"),
        "verified_tier": profile.get("verified_tier", 0),
    }

"""
Locate routes — "find help near me".

  GET /api/locate?pincode=XXXXXX  → district/state + nearby government service
                                    points (post offices) for a pincode.

Uses the free, fast India Post pincode API (no key, no scraping). This powers a
"where can I get in-person help" widget for citizens who can't self-serve online
— they see their district/state and nearby service points, plus the national CSC
helpline. Results are cached in-process to keep it snappy.
"""

import logging
import time
from typing import Dict, List

import requests
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

locate_router = APIRouter(prefix="/api", tags=["locate"])

_CACHE: Dict[str, tuple] = {}          # pincode -> (payload, ts)
_TTL = 24 * 3600
CSC_HELPLINE = "1800-3000-3468"        # national CSC / Digital Seva helpline


@locate_router.get("/locate")
async def locate(pincode: str = Query(..., min_length=6, max_length=6)):
    if not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Pincode must be 6 digits")

    cached = _CACHE.get(pincode)
    if cached and time.time() - cached[1] < _TTL:
        return cached[0]

    try:
        # India Post closes the connection on the default python-requests UA.
        resp = requests.get(
            f"https://api.postalpincode.in/pincode/{pincode}",
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0 (Haqq-Welfare-Portal)", "Accept": "application/json"},
        )
        resp.raise_for_status()
        block = resp.json()[0]
    except Exception as exc:
        logger.warning("locate: pincode lookup failed for %s: %s", pincode, exc)
        raise HTTPException(status_code=502, detail="Could not look up that pincode right now")

    if block.get("Status") != "Success" or not block.get("PostOffice"):
        raise HTTPException(status_code=404, detail="No records found for that pincode")

    offices: List[dict] = block["PostOffice"]
    first = offices[0]
    centres = [
        {
            "name": o.get("Name", ""),
            "type": o.get("BranchType", "Service point"),
            "district": o.get("District", ""),
            "state": o.get("State", ""),
        }
        for o in offices[:6]
    ]

    payload = {
        "success": True,
        "pincode": pincode,
        "district": first.get("District", ""),
        "state": first.get("State", ""),
        "region": first.get("Region", ""),
        "csc_helpline": CSC_HELPLINE,
        "centres": centres,
    }
    _CACHE[pincode] = (payload, time.time())
    return payload

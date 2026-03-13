"""
Scheme Matcher Service

Loads schemes from scraped schemes_database.json and matches them
against a citizen profile (age_group, gender, income_group, occupation).

Matching strategy: keyword scoring against scheme name, description,
category and tags, since myScheme.gov.in listing pages do not expose
structured eligibility fields.
"""

import json
import logging
import os
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

# Resolved at import time — always points to backend/data/schemes_database.json
_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SCHEMES_JSON_PATH = os.path.normpath(os.path.join(_DATA_DIR, "schemes_database.json"))

# ---------------------------------------------------------------------------
# Keyword maps — each profile value carries a set of keywords we look for
# inside the scheme's name / description / category / tags.
# ---------------------------------------------------------------------------

OCCUPATION_KEYWORDS: Dict[str, List[str]] = {
    "farmer": [
        "farmer", "kisan", "agriculture", "agri", "krishi", "pashu",
        "fishermen", "fishery", "horticulture", "plantation", "crop",
    ],
    "student": [
        "student", "scholarship", "education", "school", "college",
        "merit", "academic", "vidyarthi", "learning", "tuition",
    ],
    "govt employee": [
        "government employee", "government servant", "sarkari",
        "pension", "provident fund",
    ],
    "other": [],  # fallback — match general / labour / worker schemes
}

GENDER_KEYWORDS: Dict[str, List[str]] = {
    "m": ["male", "men", "man"],
    "f": ["women", "woman", "girl", "mahila", "female", "beti", "mata"],
    "other": [],
}

AGE_KEYWORDS: Dict[str, List[str]] = {
    "youth": ["youth", "child", "minor", "juvenile", "school", "student", "young"],
    "adult": ["adult", "working", "labour", "worker"],
    "senior": ["senior citizen", "elderly", "old age", "vridha", "pension", "aged"],
}

INCOME_KEYWORDS: Dict[str, List[str]] = {
    "low": [
        "below poverty", "bpl", "ews", "economically weaker", "low income",
        "poor", "destitute", "antyodaya",
    ],
    "medium": ["middle income", "middle class", "obc"],
    "high": [],
}

# Generic welfare keywords that boost any scheme if specific matching is weak
GENERAL_WELFARE_KEYWORDS = [
    "welfare", "benefit", "assistance", "support", "scheme", "yojana",
    "pradhan mantri", "pm ", "central", "national",
]


def _load_schemes() -> List[Dict[str, Any]]:
    """Load schemes from JSON file. Falls back to test_delete_data if file missing."""
    if not os.path.exists(SCHEMES_JSON_PATH):
        logger.warning(
            "schemes_database.json not found at %s — falling back to test_delete_data",
            SCHEMES_JSON_PATH,
        )
        from data.test_delete_data import SCHEMES as FALLBACK_SCHEMES
        return FALLBACK_SCHEMES

    try:
        with open(SCHEMES_JSON_PATH, encoding="utf-8") as f:
            data = json.load(f)
        logger.info("Loaded %d schemes from %s", len(data), SCHEMES_JSON_PATH)
        return data
    except Exception as exc:
        logger.exception("Failed to load schemes_database.json: %s", exc)
        from data.test_delete_data import SCHEMES as FALLBACK_SCHEMES
        return FALLBACK_SCHEMES


def _scheme_text(scheme: Dict[str, Any]) -> str:
    """Concatenate all searchable text fields of a scheme into one lowercase string."""
    parts = [
        scheme.get("name", ""),
        scheme.get("category", ""),
        scheme.get("ministry", ""),
        (scheme.get("benefits") or {}).get("description", ""),
    ]

    # tags can be a list
    tags = scheme.get("tags") or []
    if isinstance(tags, list):
        parts.extend(tags)
    else:
        parts.append(str(tags))

    return " ".join(parts).lower()


def _score_scheme(
    scheme: Dict[str, Any],
    age_group: str,
    gender: str,
    income_group: str,
    occupation: str,
) -> int:
    """
    Return a relevance score. Higher = better match.

    Scoring:
    - occupation keyword hit   → +3 per hit (highest weight)
    - age keyword hit          → +2 per hit
    - income keyword hit       → +2 per hit
    - gender keyword hit       → +1 per hit (schemes rarely restrict gender)
    - general welfare hit      → +1 per hit (tiebreaker)

    Gender exclusion (negative score):
    - If citizen is male and scheme has female-only keywords, penalise.
    """
    text = _scheme_text(scheme)
    score = 0

    # Occupation
    for kw in OCCUPATION_KEYWORDS.get(occupation, []):
        if kw in text:
            score += 3

    # Age
    for kw in AGE_KEYWORDS.get(age_group, []):
        if kw in text:
            score += 2

    # Income
    for kw in INCOME_KEYWORDS.get(income_group, []):
        if kw in text:
            score += 2

    # Gender — positive
    for kw in GENDER_KEYWORDS.get(gender, []):
        if kw in text:
            score += 1

    # Gender — negative: male user, female-only scheme
    if gender == "m":
        for kw in GENDER_KEYWORDS["f"]:
            if kw in text:
                score -= 2

    # General welfare bonus (tiebreaker)
    for kw in GENERAL_WELFARE_KEYWORDS:
        if kw in text:
            score += 1

    return score


def match_schemes_from_json(
    age_range_choice: str,
    gender_choice: str,
    income_choice: str,
    occupation_choice: str,
    limit: int = 3,
) -> List[Dict[str, Any]]:
    """
    Match schemes from JSON file against citizen profile choices
    (same choice codes as test_delete_data.py for compatibility).

    Returns top `limit` schemes sorted by relevance score.
    """
    from data.test_delete_data import (
        map_age_range_to_group,
        map_gender_choice,
        map_income_range_to_group,
        map_occupation_choice,
    )

    age_group = map_age_range_to_group(age_range_choice)
    gender = map_gender_choice(gender_choice)
    income_group = map_income_range_to_group(income_choice)
    occupation = map_occupation_choice(occupation_choice)

    schemes = _load_schemes()

    scored = []
    for scheme in schemes:
        score = _score_scheme(scheme, age_group, gender, income_group, occupation)
        scored.append((score, scheme))

    # Sort descending by score, take top matches with score > 0
    scored.sort(key=lambda x: x[0], reverse=True)
    top = [s for score, s in scored if score > 0][:limit]

    if not top:
        # Fallback: return top `limit` by general welfare score
        top = [s for _, s in scored[:limit]]

    logger.info(
        "Profile match — occupation=%s age=%s income=%s gender=%s → %d schemes",
        occupation, age_group, income_group, gender, len(top),
    )
    return top


def get_scheme_name(scheme: Dict[str, Any]) -> str:
    """Safely extract display name from both scraped and fallback scheme shapes."""
    # Scraped JSON shape
    if "name" in scheme:
        return scheme["name"]
    # test_delete_data shape
    return scheme.get("name", "Unknown Scheme")


def get_scheme_source(scheme: Dict[str, Any]) -> str:
    """Safely extract source/portal from both scraped and fallback shapes."""
    if "official_portal_url" in scheme:
        return "myScheme"
    return str(scheme.get("source", "myScheme"))

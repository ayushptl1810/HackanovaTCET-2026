"""
Deterministic (no-LLM) eligibility rule extraction.

The agentic LLM extractor in ``extractor.py`` produces the richest rules, but it
needs API quota and can be unavailable. This module derives the same
``eligibility_rules`` shape from a scheme's tags and eligibility prose using
explicit patterns — so the matcher always has something to work with.

Deliberately CONSERVATIVE: it only emits a rule when the text states the
criterion unambiguously. For an eligibility engine a missing rule is far safer
than a wrong one, since a wrong rule can deny a citizen a scheme they qualify
for.
"""

import re
from typing import Any, Dict, List

# Tag → (field, value) for criteria that a tag states outright.
_TAG_RULES = {
    "women": ("gender", "female"),
    "woman": ("gender", "female"),
    "girl child": ("gender", "female"),
    "girl": ("gender", "female"),
    "widow": ("gender", "female"),
    "transgender": ("gender", "transgender"),
    "student": ("occupation", "student"),
    "farmer": ("occupation", "farmer"),
    "agriculture": ("occupation", "farmer"),
}

# Occupation implied by scholarship/fellowship-type benefits.
_STUDENT_TAGS = {"scholarship", "fellowship", "education", "research", "apprenticeship"}

_SENIOR_TAGS = {"senior citizen", "old age"}

# "below Rs. 2,50,000", "income does not exceed Rs 1 lakh", "upto Rs. 8 lakh"
_INCOME_PAT = re.compile(
    r"(?:income|earning)[^.\n]{0,80}?"
    r"(?:below|less than|not exceed(?:ing)?|upto|up to|maximum of|does not exceed|under)"
    r"[^\d]{0,20}(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)\s*(lakh|lakhs|lac|crore)?",
    re.IGNORECASE,
)

# "age between 18 and 35 years", "aged 18-35"
_AGE_RANGE_PAT = re.compile(
    r"age[d]?[^.\n]{0,30}?(?:between|from|of)?\s*(\d{1,2})\s*(?:-|to|and)\s*(\d{1,2})\s*year",
    re.IGNORECASE,
)
# "minimum age of 18 years", "should be above 18 years", "at least 21 years"
_AGE_MIN_PAT = re.compile(
    r"(?:minimum age|not less than|at least|above|over|attained the age of)"
    r"[^\d]{0,20}(\d{1,2})\s*year",
    re.IGNORECASE,
)
# "below 35 years", "should not exceed 40 years", "maximum age 30"
_AGE_MAX_PAT = re.compile(
    r"(?:maximum age|not exceed(?:ing)?|below|less than|under|upto|up to)"
    r"[^\d]{0,20}(\d{1,2})\s*year",
    re.IGNORECASE,
)


def _to_rupees(amount: str, unit: str) -> int:
    val = float(amount.replace(",", ""))
    u = (unit or "").lower()
    if u in ("lakh", "lakhs", "lac"):
        val *= 100_000
    elif u == "crore":
        val *= 10_000_000
    return int(val)


def _rule(field: str, operator: str, value: Any, mandatory: bool = True) -> Dict[str, Any]:
    return {"profile_field": field, "operator": operator, "value": value, "is_mandatory": mandatory}


# --- Sanitisation ---------------------------------------------------------
#
# The LLM extractor sometimes emits free-text values ("3rd-year full-time
# student of a B.Tech program") or puts a non-state ("AICTE Approved
# Institution") in a state rule. The citizen profile only ever holds the coarse
# vocabulary below, so such a rule can never PASS — as a *mandatory* rule it
# would wrongly deny an eligible citizen. We map what we can and drop the rest.

_OCCUPATION_VOCAB = {"student", "farmer", "govt", "other"}

_OCCUPATION_KEYWORDS = [
    ("student", ("student", "scholar", "b.tech", "b.e", "m.tech", "undergraduate",
                 "postgraduate", "graduate", "phd", "research", "fellow",
                 "professor", "faculty", "academician", "researcher", "pursuing")),
    ("farmer", ("farmer", "agricultur", "cultivat", "kisan", "horticultur")),
    ("govt", ("government employee", "govt employee", "civil servant", "public servant")),
]

_VALID_STATES = {s.lower() for s in [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu And Kashmir",
    "Ladakh", "Puducherry", "Chandigarh", "Andaman And Nicobar Islands",
    "Dadra And Nagar Haveli And Daman And Diu", "Lakshadweep", "ALL",
]}


def _normalise_occupation(value: Any) -> Any:
    """Map free-text occupation(s) onto the profile vocabulary; None if unmappable."""
    values = value if isinstance(value, list) else [value]
    mapped = set()
    for v in values:
        text = str(v).strip().lower()
        if text in _OCCUPATION_VOCAB:
            mapped.add(text)
            continue
        for canon, keywords in _OCCUPATION_KEYWORDS:
            if any(k in text for k in keywords):
                mapped.add(canon)
                break
    if not mapped:
        return None
    return sorted(mapped) if len(mapped) > 1 else mapped.pop()


def _normalise_state(value: Any) -> Any:
    """Keep only real states/UTs; None if the value isn't a place at all."""
    values = value if isinstance(value, list) else [value]
    kept = [str(v).strip() for v in values if str(v).strip().lower() in _VALID_STATES]
    if not kept:
        return None
    return kept if len(kept) > 1 else kept[0]


def sanitize_rules(rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Make extracted rules safe for the matcher.

    Unmappable occupation/state values are dropped rather than kept as
    mandatory, because an unsatisfiable mandatory rule denies the scheme
    outright — the failure mode we least want in a welfare-entitlement tool.
    """
    out: List[Dict[str, Any]] = []
    for r in rules or []:
        field = r.get("profile_field")
        rule = dict(r)
        if field == "occupation":
            norm = _normalise_occupation(r.get("value"))
            if norm is None:
                continue
            rule["value"] = norm
            if isinstance(norm, list) and rule.get("operator") == "equals":
                rule["operator"] = "in"
        elif field == "state":
            norm = _normalise_state(r.get("value"))
            if norm is None:
                continue
            rule["value"] = norm
            if isinstance(norm, list) and rule.get("operator") == "equals":
                rule["operator"] = "in"
        elif field == "gender":
            gv = str(r.get("value", "")).strip().lower()
            if gv not in ("male", "female", "transgender", "other", "all", "m", "f", "t", "o"):
                continue
        out.append(rule)
    return out


def derive_rules(tags: List[str], eligibility_text: str = "") -> List[Dict[str, Any]]:
    """Derive conservative eligibility_rules from tags + eligibility prose."""
    rules: List[Dict[str, Any]] = []
    seen: set = set()

    def add(r: Dict[str, Any]) -> None:
        key = (r["profile_field"], r["operator"])
        if key not in seen:
            seen.add(key)
            rules.append(r)

    lowered_tags = {str(t).strip().lower() for t in (tags or [])}

    for tag in lowered_tags:
        if tag in _TAG_RULES:
            field, value = _TAG_RULES[tag]
            add(_rule(field, "equals", value))

    if lowered_tags & _STUDENT_TAGS:
        add(_rule("occupation", "equals", "student"))
    if lowered_tags & _SENIOR_TAGS:
        add(_rule("age", "greater_than_or_equal", 60))

    text = eligibility_text or ""
    if text:
        m = _INCOME_PAT.search(text)
        if m:
            amount = _to_rupees(m.group(1), m.group(2))
            # Sanity-bound: annual family income thresholds realistically sit
            # between 10k and 1cr; anything else is a misparse (e.g. a year).
            if 10_000 <= amount <= 10_000_000:
                add(_rule("income", "less_than_or_equal", amount))

        m = _AGE_RANGE_PAT.search(text)
        if m:
            lo, hi = int(m.group(1)), int(m.group(2))
            if 0 < lo < hi <= 100:
                add(_rule("age", "greater_than_or_equal", lo))
                add(_rule("age", "less_than_or_equal", hi))
        else:
            m = _AGE_MIN_PAT.search(text)
            if m and 0 < int(m.group(1)) <= 100:
                add(_rule("age", "greater_than_or_equal", int(m.group(1))))
            m = _AGE_MAX_PAT.search(text)
            if m and 0 < int(m.group(1)) <= 100:
                add(_rule("age", "less_than_or_equal", int(m.group(1))))

    return rules

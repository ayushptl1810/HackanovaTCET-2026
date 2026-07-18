"""
Eligibility engine — evaluates a citizen's slab profile against a scheme's
structured ``eligibility_rules``, honouring each rule's operator, value, and
is_mandatory flag.

Design for ACCURACY over coarse slab data:
  Citizen data is slab-level (e.g. income "<2L" = a *range*, not a point), so a
  rule can be definitively PASS, definitively FAIL, or UNKNOWN when the slab
  straddles the threshold. We never pretend certainty we don't have:

    - a mandatory rule that definitively FAILs  → NOT_ELIGIBLE
    - all mandatory rules definitively PASS      → ELIGIBLE
    - some mandatory rule UNKNOWN (none FAIL)     → NEEDS_INFO (likely, unconfirmed)

The match_score (0–1) ranks schemes; the verdict + reasons explain *why*.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# Outcomes for a single rule
PASS = "pass"
FAIL = "fail"
UNKNOWN = "unknown"

# Overall verdicts
ELIGIBLE = "eligible"
NOT_ELIGIBLE = "not_eligible"
NEEDS_INFO = "needs_info"


# --- Slab → numeric range maps (min inclusive, max inclusive) --------------

_INCOME_SLAB_RANGES: Dict[str, Tuple[float, float]] = {
    "<2l": (0, 200_000),
    "2-5l": (200_000, 500_000),
    "5l+": (500_000, 10**12),
    "<1l": (0, 100_000),
    "1-2l": (100_000, 200_000),
}

_AGE_SLAB_RANGES: Dict[str, Tuple[float, float]] = {
    "0-17": (0, 17), "18-25": (18, 25), "18-35": (18, 35), "26-39": (26, 39),
    "36-59": (36, 59), "40-59": (40, 59), "60+": (60, 120),
}

_GENDER_NORMALISE = {
    "m": "M", "male": "M", "f": "F", "female": "F",
    "t": "T", "o": "O", "transgender": "T", "other": "O", "all": "ALL", "": "ALL",
}


@dataclass
class RuleOutcome:
    field: str
    operator: str
    value: Any
    is_mandatory: bool
    outcome: str          # pass | fail | unknown
    detail: str = ""


@dataclass
class EligibilityResult:
    verdict: str                       # eligible | not_eligible | needs_info
    score: float                       # 0.0–1.0 (for ranking)
    reasons: List[RuleOutcome] = field(default_factory=list)


# --- Field resolution ------------------------------------------------------

def _numeric_range(field_name: str, profile: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    """Return the (min,max) numeric range implied by the citizen's slab, if any."""
    if field_name in ("income", "income_slab"):
        slab = str(profile.get("income_slab", "")).strip().lower()
        return _INCOME_SLAB_RANGES.get(slab)
    if field_name in ("age", "age_slab"):
        slab = str(profile.get("age_slab", "")).strip()
        return _AGE_SLAB_RANGES.get(slab)
    return None


def _categorical_value(field_name: str, profile: Dict[str, Any]) -> Optional[str]:
    if field_name == "gender":
        return _GENDER_NORMALISE.get(str(profile.get("gender", "")).strip().lower(),
                                     str(profile.get("gender", "")).upper())
    if field_name in ("occupation", "state"):
        v = profile.get(field_name, "")
        return str(v).strip().lower() if v else None
    return None


# --- Operator evaluation ---------------------------------------------------

def _eval_numeric(operator: str, rng: Tuple[float, float], threshold: float) -> str:
    lo, hi = rng
    if operator in ("less_than_or_equal", "less_than"):
        strict = operator == "less_than"
        ok_hi = hi < threshold if strict else hi <= threshold
        bad_lo = lo >= threshold if strict else lo > threshold
        return PASS if ok_hi else (FAIL if bad_lo else UNKNOWN)
    if operator in ("greater_than_or_equal", "greater_than"):
        strict = operator == "greater_than"
        ok_lo = lo > threshold if strict else lo >= threshold
        bad_hi = hi <= threshold if strict else hi < threshold
        return PASS if ok_lo else (FAIL if bad_hi else UNKNOWN)
    if operator == "equals":
        if lo == hi == threshold:
            return PASS
        return UNKNOWN if lo <= threshold <= hi else FAIL
    if operator == "not_equals":
        return FAIL if lo == hi == threshold else PASS
    return UNKNOWN


def _eval_categorical(operator: str, actual: Optional[str], value: Any) -> str:
    if actual is None:
        return UNKNOWN
    if isinstance(value, list):
        vals = {str(v).strip().lower() for v in value}
        if operator in ("in", "equals"):
            return PASS if actual.lower() in vals or "all" in vals else FAIL
        if operator in ("not_in", "not_equals"):
            return FAIL if actual.lower() in vals else PASS
    v = str(value).strip().lower()
    if operator == "equals":
        return PASS if v in ("all", "") or actual.lower() == v else FAIL
    if operator == "not_equals":
        return FAIL if actual.lower() == v else PASS
    return UNKNOWN


def _eval_gender(operator: str, actual: Optional[str], value: Any) -> str:
    """Gender needs value normalisation (female→F etc.) before comparison."""
    def norm(x): return _GENDER_NORMALISE.get(str(x).strip().lower(), str(x).upper())
    if isinstance(value, list):
        vals = {norm(v) for v in value}
        if "ALL" in vals:
            return PASS
        if actual is None:
            return UNKNOWN
        hit = actual in vals
        return (PASS if hit else FAIL) if operator in ("in", "equals") else (FAIL if hit else PASS)
    v = norm(value)
    if v == "ALL":
        return PASS
    if actual is None:
        return UNKNOWN
    if operator == "equals":
        return PASS if actual == v else FAIL
    if operator == "not_equals":
        return FAIL if actual == v else PASS
    return UNKNOWN


def evaluate_rule(rule: Dict[str, Any], profile: Dict[str, Any]) -> RuleOutcome:
    fld = rule.get("profile_field", "")
    op = rule.get("operator", "equals")
    val = rule.get("value")
    mand = bool(rule.get("is_mandatory", False))

    if fld == "gender":
        outcome = _eval_gender(op, _categorical_value("gender", profile), val)
    elif fld in ("income", "income_slab", "age", "age_slab"):
        rng = _numeric_range(fld, profile)
        try:
            threshold = float(val)
        except (TypeError, ValueError):
            outcome = UNKNOWN
            return RuleOutcome(fld, op, val, mand, outcome, "non-numeric rule value")
        outcome = UNKNOWN if rng is None else _eval_numeric(op, rng, threshold)
    else:
        outcome = _eval_categorical(op, _categorical_value(fld, profile), val)

    return RuleOutcome(fld, op, val, mand, outcome,
                       detail=f"{fld} {op} {val} -> {outcome}")


def evaluate_scheme(profile: Dict[str, Any], scheme: Dict[str, Any]) -> EligibilityResult:
    rules = scheme.get("eligibility_rules", []) or []
    if not rules:
        # No rules to evaluate → treat as broadly available, mid score.
        return EligibilityResult(verdict=NEEDS_INFO, score=0.5, reasons=[])

    reasons = [evaluate_rule(r, profile) for r in rules]

    mandatory = [r for r in reasons if r.is_mandatory]
    any_mandatory_fail = any(r.outcome == FAIL for r in mandatory)
    any_mandatory_unknown = any(r.outcome == UNKNOWN for r in mandatory)

    # Weighted score for ranking: mandatory weight 1.0, optional 0.5.
    earned = max_possible = 0.0
    for r in reasons:
        w = 1.0 if r.is_mandatory else 0.5
        max_possible += w
        if r.outcome == PASS:
            earned += w
        elif r.outcome == UNKNOWN:
            earned += w * 0.5
    score = round(earned / max_possible, 3) if max_possible else 0.5

    if any_mandatory_fail:
        verdict = NOT_ELIGIBLE
    elif any_mandatory_unknown:
        verdict = NEEDS_INFO
    else:
        verdict = ELIGIBLE

    return EligibilityResult(verdict=verdict, score=score, reasons=reasons)

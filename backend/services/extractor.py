"""
Agentic scheme extractor.

Reads a welfare scheme's unstructured text (title + eligibility prose +
benefits + document list, as scraped from myScheme) and produces the
STRUCTURED schema the eligibility engine consumes — especially the
``eligibility_rules`` with proper profile_field / operator / value /
is_mandatory. An LLM (Groq, OpenAI-compatible) does the reading; we then
strictly validate/normalise its output so a hallucinated field or operator
can never reach the matcher.

Why "agentic": the LLM interprets messy, varied government prose robustly —
far more resilient than CSS selectors that break on every layout change.

Why validated: for an eligibility engine, an unchecked LLM rule could wrongly
grant or deny a citizen a scheme, so every extracted rule is filtered against
allowed fields/operators before use.
"""

import json
import logging
import re
import time
from typing import Any, Dict, List, Optional

import requests

from core.config import settings

logger = logging.getLogger(__name__)

_MAX_RETRY_WAIT = 60.0  # seconds; longer means the daily quota is exhausted

_ALLOWED_FIELDS = {"income", "age", "gender", "occupation", "state"}
_ALLOWED_OPERATORS = {
    "less_than", "less_than_or_equal", "greater_than", "greater_than_or_equal",
    "equals", "not_equals", "in", "not_in",
}

_SYSTEM_PROMPT = """You extract structured eligibility data for Indian government welfare schemes.
Return ONLY a JSON object with this exact shape:

{
  "eligibility_rules": [
    {"profile_field": "income|age|gender|occupation|state",
     "operator": "less_than|less_than_or_equal|greater_than|greater_than_or_equal|equals|not_equals|in|not_in",
     "value": <number for income/age; string or array of strings for gender/occupation/state>,
     "is_mandatory": true|false}
  ],
  "documents_required": ["aadhaar_card", "income_certificate", ...],
  "benefits": {"description": "<short benefit summary>", "type": "cash_grant|subsidy|loan|scholarship|other"},
  "category": "<short category>",
  "level": "Central|State",
  "state_applicable": ["ALL"] or ["Maharashtra", ...],
  "faqs": [{"question": "<question>", "answer": "<answer>"}],
  "application_process": ["Step 1...", "Step 2..."]
}

Rules:
- income values are annual rupees as plain integers (e.g. 150000), no commas/symbols.
- age values are years as integers.
- gender values: "male", "female", "transgender", or "all".
- Only include a rule when the text clearly states the criterion. Do NOT invent rules.
- Mark a rule is_mandatory=true only when the scheme requires it for eligibility.
- Output valid JSON only. No prose, no markdown."""


def _retry_after_seconds(resp: "requests.Response") -> float:
    """Groq reports the exact wait in the body ('try again in 4.33s') and often
    in Retry-After. Honour it so bulk ingestion doesn't burn through the quota."""
    hdr = resp.headers.get("Retry-After")
    if hdr:
        try:
            return float(hdr)
        except ValueError:
            pass
    m = re.search(r"try again in ([\d.]+)\s*(ms|s)", resp.text)
    if m:
        val = float(m.group(1))
        return val / 1000 if m.group(2) == "ms" else val
    return 5.0


def _call_groq(user_content: str, max_retries: int = 5) -> Optional[Dict[str, Any]]:
    if not settings.groq_api_key:
        logger.warning("GROQ_API_KEY not configured; extractor disabled")
        return None

    for attempt in range(max_retries):
        try:
            resp = requests.post(
                f"{settings.groq_base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.groq_model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                },
                timeout=60,
            )
        except requests.RequestException as exc:
            logger.error("Groq request failed: %s", exc)
            return None

        if resp.status_code == 429 and attempt < max_retries - 1:
            wait = _retry_after_seconds(resp) + 0.5
            if wait > _MAX_RETRY_WAIT:
                # Multi-minute waits mean the daily quota is gone, not a burst
                # limit — fail fast so callers fall back instead of hanging.
                logger.warning("Groq quota exhausted (retry-after %.0fs); giving up", wait)
                return None
            logger.info("Groq rate limited; retrying in %.1fs (attempt %d)", wait, attempt + 1)
            time.sleep(wait)
            continue
        break

    if resp.status_code != 200:
        logger.error("Groq HTTP %s: %s", resp.status_code, resp.text[:300])
        return None
    try:
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        logger.error("Could not parse Groq response: %s", exc)
        return None


def _validate_rules(raw_rules: Any) -> List[Dict[str, Any]]:
    """Keep only rules with allowed field+operator and a usable value."""
    out: List[Dict[str, Any]] = []
    if not isinstance(raw_rules, list):
        return out
    for r in raw_rules:
        if not isinstance(r, dict):
            continue
        fld = str(r.get("profile_field", "")).strip().lower()
        op = str(r.get("operator", "")).strip().lower()
        val = r.get("value")
        if fld not in _ALLOWED_FIELDS or op not in _ALLOWED_OPERATORS or val is None:
            logger.debug("Dropping invalid extracted rule: %s", r)
            continue
        # Numeric fields must have numeric values.
        if fld in ("income", "age"):
            try:
                val = int(float(val))
            except (TypeError, ValueError):
                continue
        out.append({
            "profile_field": fld,
            "operator": op,
            "value": val,
            "is_mandatory": bool(r.get("is_mandatory", False)),
        })
    return out


def extract_scheme_fields(raw_text: str, name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Extract structured fields from a scheme's unstructured text.
    Returns None if the LLM is unavailable or output is unusable.
    """
    prompt = raw_text if not name else f"Scheme name: {name}\n\n{raw_text}"
    data = _call_groq(prompt)
    if not data:
        return None

    from services.rule_extractor import sanitize_rules

    # Validate shape, then normalise free-text values onto the profile
    # vocabulary — an unsatisfiable mandatory rule would deny an eligible citizen.
    rules = sanitize_rules(_validate_rules(data.get("eligibility_rules")))
    benefits = data.get("benefits") if isinstance(data.get("benefits"), dict) else {}
    docs = data.get("documents_required")
    return {
        "eligibility_rules": rules,
        "documents_required": [str(d) for d in docs] if isinstance(docs, list) else [],
        "benefits": {
            "description": str(benefits.get("description", ""))[:500],
            "type": str(benefits.get("type", "other")),
        },
        "category": str(data.get("category", "General")),
        "level": str(data.get("level", "")),
        "state_applicable": data.get("state_applicable") if isinstance(data.get("state_applicable"), list) else ["ALL"],
        "faqs": data.get("faqs", []),
        "application_process": data.get("application_process", []),
    }


def enrich_scheme(scheme: Dict[str, Any], raw_text: Optional[str] = None) -> Dict[str, Any]:
    """
    Enrich a scraped scheme dict with LLM-extracted structured fields.

    Uses ``raw_text`` if given, else composes text from the scheme's own
    description/benefits. Only overwrites fields the extractor confidently
    produced; on failure the original scheme is returned unchanged.
    """
    if raw_text is None:
        b = scheme.get("benefits", {})
        raw_text = " ".join(filter(None, [
            scheme.get("name", ""),
            b.get("description", "") if isinstance(b, dict) else str(b),
            " ".join(scheme.get("documents_required", []) or []),
        ]))
    extracted = extract_scheme_fields(raw_text, name=scheme.get("name"))
    if not extracted:
        return scheme

    merged = dict(scheme)
    if extracted["eligibility_rules"]:
        merged["eligibility_rules"] = extracted["eligibility_rules"]
    if extracted["documents_required"]:
        merged["documents_required"] = extracted["documents_required"]
    if extracted["benefits"]["description"]:
        merged["benefits"] = extracted["benefits"]
    if extracted.get("faqs"):
        merged["faqs"] = extracted["faqs"]
    if extracted.get("application_process"):
        merged["application_process"] = extracted["application_process"]
    merged.setdefault("category", extracted["category"])
    return merged

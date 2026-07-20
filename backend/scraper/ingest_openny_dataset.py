"""
Ingest the OpenNyAI myScheme scrape (real data scraped from myscheme.gov.in,
already containing tags/eligibility/benefits text) and run it through our
existing LLM eligibility extractor so it fits the app's schema.

Source: https://github.com/OpenNyAI/schemes_chatbot_deprecated
        data/myschemes_scraped_combined.json
"""

import json
import os
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.extractor import enrich_scheme

_HERE = os.path.dirname(os.path.abspath(__file__))
_SRC_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(_HERE, "openny_raw.json")
_OUT_PATH = os.path.join(os.path.dirname(_HERE), "data", "schemes_database.json")

_INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu And Kashmir",
    "Ladakh", "Puducherry", "Chandigarh",
]

_lock = threading.Lock()


def _scheme_id_from_link(link: str, sr_no: str) -> str:
    m = re.search(r"/schemes/([^/?#]+)", link or "")
    return m.group(1) if m else f"scheme-{sr_no}"


def _derive_state(tags, details_text):
    hay = " ".join(tags) + " " + (details_text or "")
    for st in _INDIAN_STATES:
        if st.lower() in hay.lower():
            return "State", [st]
    return "Central", ["ALL"]


def _derive_category(tags):
    return tags[0] if tags else "General"


def _convert_one(raw):
    name = raw.get("scheme_name", "").strip()
    link = raw.get("scheme_link", "")
    tags = raw.get("tags", []) or []
    sr_no = str(raw.get("sr_no", ""))
    scheme_id = _scheme_id_from_link(link, sr_no)
    level, states = _derive_state(tags, raw.get("details", ""))

    raw_text = "\n\n".join(filter(None, [
        raw.get("details", ""),
        raw.get("benefits", ""),
        raw.get("eligibility_criteria", ""),
        raw.get("application_process", ""),
    ]))[:6000]

    base = {
        "scheme_id": scheme_id,
        "name": name,
        "level": level,
        "state_applicable": states,
        "category": _derive_category(tags),
        "tags": tags,
        "ministry": "Government of India",
        "official_portal_url": link,
        "benefits": {"description": (raw.get("benefits") or "").replace("Benefits\n", "").strip()[:500] or "See official portal for details.", "type": "other"},
        "documents_required": [],
        "eligibility_rules": [],
        "faqs": [],
        "application_process": [],
    }

    enriched = enrich_scheme(base, raw_text=raw_text)
    # Preserve tags/state derived here even if extractor guesses differently for state.
    enriched["tags"] = tags
    if not enriched.get("state_applicable"):
        enriched["state_applicable"] = states
    return enriched


def main():
    with open(_SRC_PATH, "r", encoding="utf-8") as f:
        raw_list = json.load(f)

    print(f"Loaded {len(raw_list)} raw schemes from {_SRC_PATH}")
    results = []

    def _save():
        with open(_OUT_PATH, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_convert_one, r): r for r in raw_list}
        done = 0
        for fut in as_completed(futures):
            done += 1
            raw = futures[fut]
            try:
                scheme = fut.result()
                with _lock:
                    results.append(scheme)
                print(f"[{done}/{len(raw_list)}] OK: {scheme.get('name')}")
            except Exception as e:
                print(f"[{done}/{len(raw_list)}] FAILED {raw.get('scheme_name')}: {e}")
            if done % 25 == 0:
                with _lock:
                    _save()
                print(f"  -> checkpoint saved ({len(results)} schemes)")

    _save()
    print(f"Saved {len(results)} schemes to {_OUT_PATH}")


if __name__ == "__main__":
    main()

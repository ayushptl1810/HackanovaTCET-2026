"""Backfill eligibility_rules for schemes the LLM extractor couldn't cover
(e.g. API quota exhausted), using the deterministic rule extractor."""

import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.rule_extractor import derive_rules, sanitize_rules

_HERE = os.path.dirname(os.path.abspath(__file__))
_OUT_PATH = os.path.join(os.path.dirname(_HERE), "data", "schemes_database.json")
_RAW_PATH = os.path.join(_HERE, "openny_raw.json")


def main():
    with open(_OUT_PATH, "r", encoding="utf-8") as f:
        schemes = json.load(f)
    with open(_RAW_PATH, "r", encoding="utf-8") as f:
        raw_by_name = {r.get("scheme_name", "").strip(): r for r in json.load(f)}

    # The source dataset contains duplicate entries ("... copy.pdf" pairs).
    deduped, seen_ids = [], set()
    for s in schemes:
        sid = s.get("scheme_id")
        if sid in seen_ids:
            continue
        seen_ids.add(sid)
        deduped.append(s)
    dropped = len(schemes) - len(deduped)
    schemes = deduped

    filled = augmented = 0
    for s in schemes:
        raw = raw_by_name.get(s.get("name", "").strip(), {})
        text = " ".join(filter(None, [raw.get("eligibility_criteria", ""), raw.get("details", "")]))
        derived = derive_rules(s.get("tags", []), text)
        existing = sanitize_rules(s.get("eligibility_rules") or [])

        if not existing:
            if derived:
                s["eligibility_rules"] = derived
                filled += 1
            else:
                s["eligibility_rules"] = []
            continue

        # Merge: the LLM often captures only income and misses the audience the
        # tags state plainly (a "Scholarship" is for students). Without that,
        # the scheme matches every profile and recommendations stop discriminating.
        have = {r["profile_field"] for r in existing}
        added = [r for r in derived if r["profile_field"] not in have]
        if added:
            existing = existing + added
            augmented += 1
        s["eligibility_rules"] = existing

    with open(_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(schemes, f, indent=2, ensure_ascii=False)

    total = sum(1 for s in schemes if s.get("eligibility_rules"))
    print(f"Dropped {dropped} duplicates. Filled {filled}, augmented {augmented}. "
          f"{total}/{len(schemes)} have eligibility_rules.")


if __name__ == "__main__":
    main()

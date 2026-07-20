"""One-off: retry LLM eligibility extraction for schemes that came back with
empty eligibility_rules (e.g. due to Groq rate limiting during bulk ingest),
sequentially with pacing to stay under the TPM limit."""

import json
import os
import sys
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.extractor import extract_scheme_fields

_OUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "schemes_database.json")
_RAW_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "openny_raw.json")


def main():
    with open(_OUT_PATH, "r", encoding="utf-8") as f:
        schemes = json.load(f)
    with open(_RAW_PATH, "r", encoding="utf-8") as f:
        raw_list = json.load(f)
    raw_by_name = {r.get("scheme_name", "").strip(): r for r in raw_list}

    missing = [s for s in schemes if not s.get("eligibility_rules")]
    print(f"{len(missing)} of {len(schemes)} schemes missing eligibility_rules; retrying sequentially...")

    for i, s in enumerate(missing, 1):
        raw = raw_by_name.get(s.get("name", "").strip())
        if not raw:
            continue
        raw_text = "\n\n".join(filter(None, [
            raw.get("details", ""), raw.get("benefits", ""),
            raw.get("eligibility_criteria", ""), raw.get("application_process", ""),
        ]))[:6000]
        extracted = extract_scheme_fields(raw_text, name=s.get("name"))
        if extracted and extracted.get("eligibility_rules"):
            s["eligibility_rules"] = extracted["eligibility_rules"]
            if extracted.get("documents_required"):
                s["documents_required"] = extracted["documents_required"]
            print(f"[{i}/{len(missing)}] fixed: {s.get('name')}")
        else:
            print(f"[{i}/{len(missing)}] still no rules: {s.get('name')}")
        if i % 10 == 0:
            with open(_OUT_PATH, "w", encoding="utf-8") as f:
                json.dump(schemes, f, indent=2, ensure_ascii=False)
            print(f"  -> checkpoint saved")
        time.sleep(1.2)

    with open(_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(schemes, f, indent=2, ensure_ascii=False)
    with_rules = sum(1 for s in schemes if s.get("eligibility_rules"))
    print(f"Done. {with_rules}/{len(schemes)} schemes now have eligibility_rules.")


if __name__ == "__main__":
    main()

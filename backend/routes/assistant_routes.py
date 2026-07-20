"""
Haqq Sahayak — the on-site help assistant (chatbot + voice agent brain).

  POST /api/assistant/chat   → grounded, multilingual welfare assistant

Design
------
The assistant is *grounded*: when the caller is logged in (optional Bearer
token), we load their profile slabs and the welfare schemes matched to them,
and inject a compact summary into the system prompt. The model is told to only
talk about those schemes — never to invent a scheme, benefit amount, or rule.
This keeps the citizen-facing advice safe.

An LLM (Groq, OpenAI-compatible) writes the reply; if the key is missing or the
call fails, a deterministic rule-based fallback answers from the same grounding
data, so the assistant is always available for a demo.

The same endpoint powers both the text chatbot and the browser voice agent —
the voice agent just does speech-to-text in the browser, posts the text here,
and speaks the reply back with the Web Speech API.
"""

import logging
import re
from typing import Any, Dict, List, Optional

import requests
import jwt
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel

from core.config import settings
from core.security import decode_access_token
from services.auth_service import get_profile_by_phone, get_profile_slabs

logger = logging.getLogger(__name__)

assistant_router = APIRouter(prefix="/api/assistant", tags=["assistant"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str            # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    token: Optional[str] = None      # optional citizen JWT for grounding
    lang: Optional[str] = "en"       # preferred reply language hint


class ChatResponse(BaseModel):
    reply: str
    suggestions: List[str] = []
    grounded: bool = False
    reply_lang: str = "en-IN"

class ExplainRequest(BaseModel):
    scheme_id: str
    lang: Optional[str] = "en"


LANG_NAMES = {
    "en": "English", "hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "bn": "Bengali",
}

_LANG_BCP47 = {
    "en": "en-IN", "hi": "hi-IN", "mr": "mr-IN", "ta": "ta-IN", "bn": "bn-IN",
}

# Unicode block → language, so we can honour the script the citizen actually typed
# in even when the UI language selector says something else.
_SCRIPT_RANGES = [
    ("hi", 0x0900, 0x097F),   # Devanagari (also Marathi — UI hint disambiguates)
    ("bn", 0x0980, 0x09FF),
    ("ta", 0x0B80, 0x0BFF),
]


def _detect_lang(text: str, ui_lang: str) -> str:
    for ch in text or "":
        cp = ord(ch)
        for lang, lo, hi in _SCRIPT_RANGES:
            if lo <= cp <= hi:
                # Devanagari is shared; trust the UI hint between hi and mr.
                if lang == "hi" and ui_lang == "mr":
                    return "mr"
                return lang
    return ui_lang if ui_lang in LANG_NAMES else "en"


# ---------------------------------------------------------------------------
# Grounding — build a compact context block from the citizen's data
# ---------------------------------------------------------------------------

def _load_grounding(token: Optional[str]) -> Dict[str, Any]:
    """Return {profile, schemes} for a valid citizen token, else empty."""
    if not token:
        return {}
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        return {}
    phone = payload.get("sub")
    if not phone:
        return {}
    profile = get_profile_by_phone(phone)
    if not profile:
        return {}
    slabs = get_profile_slabs(phone) or {}
    schemes: List[Dict[str, Any]] = []
    try:
        from services.fuzzy_match import get_top_schemes
        for r in get_top_schemes(slabs, limit=8):
            schemes.append({
                "name": r.name,
                "eligibility": r.eligibility,
                "category": r.category,
                "benefit": r.benefit_amount,
            })
    except Exception as exc:
        logger.warning("assistant grounding: scheme match failed: %s", exc)
    return {"profile": profile, "schemes": schemes}


def _profile_line(profile: Dict[str, Any]) -> str:
    if not profile:
        return "The citizen is not logged in yet."
    inc = (f"₹{profile.get('annual_income')}/year" if profile.get("annual_income")
           else profile.get("income_slab") or "unknown")
    return (
        f"Citizen profile — name: {profile.get('name') or 'unknown'}, "
        f"age band: {profile.get('age_slab') or 'unknown'}, "
        f"gender: {profile.get('gender') or 'unknown'}, "
        f"annual income: {inc}, "
        f"occupation: {profile.get('occupation') or 'unknown'}, "
        f"state: {profile.get('state') or 'unknown'}."
    )


def _schemes_block(schemes: List[Dict[str, Any]]) -> str:
    if not schemes:
        return "No matched schemes are loaded for this citizen yet."
    lines = []
    for s in schemes:
        verdict = {"eligible": "ELIGIBLE", "not_eligible": "NOT eligible",
                   "needs_info": "needs more info"}.get(s["eligibility"], s["eligibility"])
        lines.append(f"- {s['name']} [{s['category']}] — {verdict}. Benefit: {s['benefit']}")
    return "Schemes currently matched to this citizen:\n" + "\n".join(lines)


_STOP = {"the", "and", "for", "of", "a", "an", "scheme", "yojana", "tell", "me", "about",
         "what", "is", "how", "do", "i", "to", "in", "my", "can", "get", "apply"}


def _tokens(text: str) -> set:
    return {w for w in re.findall(r"[a-z0-9]+", (text or "").lower())
            if len(w) > 2 and w not in _STOP}


def _find_schemes(user_text: str, limit: int = 2) -> List[Dict[str, Any]]:
    """Full scheme records whose name best overlaps the citizen's question."""
    q = _tokens(user_text)
    if not q:
        return []
    try:
        from services.scheme_cache import get_schemes
        all_schemes = get_schemes()
    except Exception as exc:
        logger.warning("assistant: scheme cache unavailable: %s", exc)
        return []
    scored = []
    for s in all_schemes:
        overlap = len(q & _tokens(s.get("name", "")))
        if overlap >= 2:
            scored.append((overlap, s))
    scored.sort(key=lambda x: -x[0])
    return [s for _, s in scored[:limit]]


def _detail_block(schemes: List[Dict[str, Any]]) -> str:
    """Verbatim facts for the named scheme(s) so the model can answer specifics."""
    if not schemes:
        return ""
    out = []
    for s in schemes:
        b = s.get("benefits", {})
        benefit = b.get("description", "") if isinstance(b, dict) else str(b)
        docs = ", ".join(s.get("documents_required", []) or []) or "not listed"
        steps = s.get("application_process") or []
        rules = []
        for r in s.get("eligibility_rules", []) or []:
            rules.append(f"{r.get('profile_field')} {r.get('operator')} {r.get('value')}")
        faqs = "\n".join(f"    Q: {f.get('question')}\n    A: {f.get('answer')}"
                         for f in (s.get("faqs") or [])[:5])
        out.append(
            f"SCHEME: {s.get('name')}\n"
            f"  Level: {s.get('level')} | Ministry: {s.get('ministry')} | Category: {s.get('category')}\n"
            f"  Benefit: {benefit}\n"
            f"  Eligibility rules: {'; '.join(rules) or 'not listed'}\n"
            f"  Documents required: {docs}\n"
            f"  How to apply:\n" + "".join(f"    {i+1}. {p}\n" for i, p in enumerate(steps)) +
            f"  Official page: {s.get('official_portal_url') or 'n/a'}\n" +
            (f"  FAQs:\n{faqs}" if faqs else "")
        )
    return ("FULL DETAILS of the scheme(s) the citizen is asking about — answer from "
            "these facts, do not say you lack information:\n\n" + "\n\n".join(out))


_SYSTEM = """You are "Haqq Sahayak", a warm, patient assistant on an Indian government
welfare portal. Your job: help citizens understand the rights and welfare schemes they
are entitled to, and guide them to fetch documents (DigiLocker) and apply.

Rules:
- Be brief and plain. Short sentences. No jargon. Assume low digital literacy.
- CRITICAL: The citizen's UI is set to {ui_lang}. NO MATTER WHAT language was used previously in this conversation, you MUST reply in EXACTLY the same language and script as the user's VERY LAST message.
  - If their LAST message is in English, you MUST reply in English.
  - If their LAST message is in Hindi (Devanagari), reply in Hindi (Devanagari).
  - If their LAST message is in Hinglish, reply in Hinglish.
  - If it is a short generic greeting or unclear, default to {ui_lang}.
- Only discuss the schemes listed in the context below. NEVER invent a scheme, a
  benefit amount, an eligibility rule, or a deadline. If unsure, say you are not sure
  and suggest the "Describe your need" search or visiting a nearby CSC centre.
- When relevant, nudge the next concrete step: connect DigiLocker, use auto-fill,
  or complete profile details that unlock more schemes.
- Keep replies under ~90 words unless the citizen asks for detail.
- You MUST output your response as a valid JSON object matching this schema:
{
  "reply": "your message here",
  "reply_lang": "The BCP-47 language code of your reply (e.g., en-IN, hi-IN, mr-IN, ta-IN, bn-IN)",
  "suggestions": ["short followup 1", "short followup 2", "short followup 3"]
}"""


def _groq_once(model: str, messages: List[Dict[str, str]], json_mode: bool) -> Any:
    req_json = {"model": model, "temperature": 0.3,
                "max_tokens": 700, "messages": messages}
    if json_mode:
        req_json["response_format"] = {"type": "json_object"}

    resp = requests.post(
        f"{settings.groq_base_url.rstrip('/')}/chat/completions",
        headers={"Authorization": f"Bearer {settings.groq_api_key}",
                 "Content-Type": "application/json"},
        json=req_json,
        timeout=45,
    )
    if resp.status_code != 200:
        logger.error("Groq assistant [%s] HTTP %s: %s", model, resp.status_code, resp.text[:300])
        # 429 = per-day/per-minute quota; signal so the caller can try a smaller model.
        raise _Retryable() if resp.status_code == 429 else RuntimeError(resp.status_code)

    content = resp.json()["choices"][0]["message"]["content"].strip()
    if json_mode:
        import json
        return json.loads(content)
    return content


class _Retryable(Exception):
    """Quota/rate-limit hit — worth retrying on a cheaper model."""


def _call_groq(messages: List[Dict[str, str]], json_mode: bool = False) -> Any:
    if not settings.groq_api_key:
        return None
    # The primary model shares one daily token budget; when it is exhausted the
    # assistant must not silently degrade to canned text, so fall down a chain.
    models = [settings.groq_model] + [
        m for m in settings.groq_fallback_models if m != settings.groq_model
    ]
    for model in models:
        try:
            return _groq_once(model, messages, json_mode)
        except _Retryable:
            continue
        except Exception as exc:
            logger.error("Groq assistant [%s] failed: %s", model, exc)
            continue
    return None


def _fallback_reply(user_text: str, grounding: Dict[str, Any],
                    named: Optional[List[Dict[str, Any]]] = None) -> str:
    """Deterministic reply when the LLM is unavailable — keeps the demo alive."""
    # If they asked about a specific scheme, answer from its record rather than
    # falling through to the generic "you look eligible for..." blurb.
    if named:
        s = named[0]
        b = s.get("benefits", {})
        benefit = (b.get("description") if isinstance(b, dict) else str(b)) or "not listed"
        docs = ", ".join(s.get("documents_required", []) or []) or "Aadhaar"
        steps = s.get("application_process") or []
        first = steps[0] if steps else "Apply on the official portal."
        return (f"{s.get('name')}.\n"
                f"What you get: {benefit}\n"
                f"Papers needed: {docs}\n"
                f"First step: {first}\n"
                f"Official page: {s.get('official_portal_url') or 'n/a'}")
    schemes = grounding.get("schemes") or []
    eligible = [s for s in schemes if s["eligibility"] == "eligible"]
    # NOTE: match whole words — a substring test made "Scholarship" hit "hi".
    words = set(re.findall(r"[a-z]+", user_text.lower()))
    t = user_text.lower()
    if words & {"hello", "hi", "namaste", "hey", "help"}:
        if eligible:
            names = ", ".join(s["name"] for s in eligible[:3])
            return (f"Namaste! Based on your profile you look eligible for: {names}. "
                    "Open any scheme and tap ‘Auto-fill & Apply’, or ask me about any of them.")
        return ("Namaste! I can help you find welfare schemes you are entitled to. "
                "Log in and tell me your need — for example, ‘money for my child’s study’.")
    if words & {"apply", "form", "fill", "document", "documents", "digilocker"}:
        return ("To apply, first connect DigiLocker so your Aadhaar, PAN and certificates "
                "are fetched. Then press ‘Auto-fill & Apply’ on a scheme — the agent fills "
                "the form for you. You only review and submit.")
    if eligible:
        names = ", ".join(s["name"] for s in eligible[:3])
        return (f"You appear eligible for: {names}. Ask me ‘why do I qualify?’ for any of "
                "them, or use ‘Describe your need’ to search in your own words.")
    return ("Tell me what help you need — money for education, a skill loan, health cover, "
            "pension — and I’ll point you to the right scheme. You can also type in Hindi.")


def _suggestions(grounding: Dict[str, Any]) -> List[str]:
    schemes = grounding.get("schemes") or []
    out = ["What am I eligible for?", "How do I apply?"]
    if schemes:
        out.append(f"Tell me about {schemes[0]['name']}")
    out.append("Money for my child's education")
    return out[:4]


@assistant_router.post("/chat", response_model=ChatResponse)
async def assistant_chat(req: ChatRequest):
    grounding = _load_grounding(req.token)
    user_text = req.messages[-1].content if req.messages else ""

    context_block = (
        f"{_profile_line(grounding.get('profile'))}\n\n"
        f"{_schemes_block(grounding.get('schemes') or [])}"
    )
    reply_in = _detect_lang(user_text, req.lang or "en")
    system_prompt = _SYSTEM.replace("{ui_lang}", LANG_NAMES.get(reply_in, "English"))
    llm_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": "CONTEXT (for grounding, do not repeat verbatim):\n" + context_block},
    ]
    # If the citizen named a specific scheme, hand the model that scheme's full
    # record — without this it only has a name + one-line benefit and answers vaguely.
    named = _find_schemes(user_text)
    if named:
        llm_messages.append({"role": "system", "content": _detail_block(named)})
    # carry recent conversation (cap to last 10 turns)
    for m in req.messages[-10:]:
        role = "assistant" if m.role == "assistant" else "user"
        llm_messages.append({"role": role, "content": m.content})

    llm_resp = _call_groq(llm_messages, json_mode=True)
    if llm_resp and isinstance(llm_resp, dict) and llm_resp.get("reply"):
        reply = llm_resp["reply"]
        reply_lang = llm_resp.get("reply_lang") or _LANG_BCP47.get(reply_in, "en-IN")
        suggestions = llm_resp.get("suggestions") or _suggestions(grounding)
    else:
        # JSON mode failed (bad key, parse error, model quirk). Retry as plain
        # text before dropping to the canned fallback — a real answer in prose
        # beats a generic one.
        plain = _call_groq(
            llm_messages + [{"role": "system",
                             "content": "Reply as plain text only. No JSON, no markdown."}]
        )
        if isinstance(plain, str) and plain.strip():
            reply = plain.strip()
        else:
            reply = _fallback_reply(user_text, grounding, named)
        reply_lang = _LANG_BCP47.get(reply_in, "en-IN")
        suggestions = _suggestions(grounding)

    return ChatResponse(
        reply=reply,
        suggestions=suggestions,
        grounded=bool(grounding.get("profile")),
        reply_lang=reply_lang
    )


@assistant_router.post("/explain")
async def explain_scheme(req: ExplainRequest):
    """Explain one scheme in very simple language, in the citizen's language."""
    from services.scheme_cache import get_schemes
    scheme = next((s for s in get_schemes() if s.get("scheme_id") == req.scheme_id), None)
    if not scheme:
        return {"reply": "Sorry, I could not find that scheme."}

    b = scheme.get("benefits", {})
    benefit = b.get("description", "") if isinstance(b, dict) else str(b)
    docs = ", ".join(scheme.get("documents_required", []) or []) or "Aadhaar"
    scheme_text = (
        f"Scheme name: {scheme.get('name')}\n"
        f"Category: {scheme.get('category')}\n"
        f"Benefit: {benefit}\n"
        f"Documents needed: {docs}"
    )
    lang_name = LANG_NAMES.get(req.lang, "English")
    messages = [
        {"role": "system", "content": (
            "You explain one Indian government welfare scheme to a citizen who may have "
            "low literacy. Use 3–4 very short, simple sentences covering: (1) what the "
            "scheme gives, (2) who it is for, (3) the first step to apply. No jargon, no "
            f"markdown. Reply ONLY in {lang_name}.")},
        {"role": "user", "content": scheme_text},
    ]
    reply = _call_groq(messages) or f"{scheme.get('name')}: {benefit}"
    return {"reply": reply, "scheme_id": req.scheme_id}

@assistant_router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio from the frontend using Sarvam ASR."""
    from services.sarvam_service import SarvamASRService
    audio_bytes = await file.read()
    content_type = file.content_type or "audio/webm"
    filename = file.filename or "audio.webm"
    
    transcript, detected = SarvamASRService().transcribe_detailed(
        audio_bytes=audio_bytes, 
        language="unknown", 
        filename=filename, 
        content_type=content_type
    )
    return {"transcript": transcript, "language": detected}

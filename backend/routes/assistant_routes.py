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
from typing import Any, Dict, List, Optional

import requests
import jwt
from fastapi import APIRouter
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


_SYSTEM = """You are "Haqq Sahayak", a warm, patient assistant on an Indian government
welfare portal. Your job: help citizens understand the rights and welfare schemes they
are entitled to, and guide them to fetch documents (DigiLocker) and apply.

Rules:
- Be brief and plain. Short sentences. No jargon. Assume low digital literacy.
- Reply in the SAME language the citizen writes in (Hindi, Marathi, Tamil, Bengali,
  English, Hinglish...). If they write Hindi in Latin script, reply the same way.
- Only discuss the schemes listed in the context below. NEVER invent a scheme, a
  benefit amount, an eligibility rule, or a deadline. If unsure, say you are not sure
  and suggest the "Describe your need" search or visiting a nearby CSC centre.
- When relevant, nudge the next concrete step: connect DigiLocker, use auto-fill,
  or complete profile details that unlock more schemes.
- Keep replies under ~90 words unless the citizen asks for detail."""


def _call_groq(messages: List[Dict[str, str]]) -> Optional[str]:
    if not settings.groq_api_key:
        return None
    try:
        resp = requests.post(
            f"{settings.groq_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}",
                     "Content-Type": "application/json"},
            json={"model": settings.groq_model, "temperature": 0.3,
                  "max_tokens": 400, "messages": messages},
            timeout=45,
        )
        if resp.status_code != 200:
            logger.error("Groq assistant HTTP %s: %s", resp.status_code, resp.text[:200])
            return None
        return resp.json()["choices"][0]["message"]["content"].strip()
    except (requests.RequestException, KeyError, IndexError) as exc:
        logger.error("Groq assistant call failed: %s", exc)
        return None


def _fallback_reply(user_text: str, grounding: Dict[str, Any]) -> str:
    """Deterministic reply when the LLM is unavailable — keeps the demo alive."""
    schemes = grounding.get("schemes") or []
    eligible = [s for s in schemes if s["eligibility"] == "eligible"]
    t = user_text.lower()
    if any(w in t for w in ("hello", "hi", "namaste", "hey", "help")):
        if eligible:
            names = ", ".join(s["name"] for s in eligible[:3])
            return (f"Namaste! Based on your profile you look eligible for: {names}. "
                    "Open any scheme and tap ‘Auto-fill & Apply’, or ask me about any of them.")
        return ("Namaste! I can help you find welfare schemes you are entitled to. "
                "Log in and tell me your need — for example, ‘money for my child’s study’.")
    if any(w in t for w in ("apply", "form", "fill", "document", "digilocker")):
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
    llm_messages = [
        {"role": "system", "content": _SYSTEM},
        {"role": "system", "content": "CONTEXT (for grounding, do not repeat verbatim):\n" + context_block},
    ]
    # carry recent conversation (cap to last 10 turns)
    for m in req.messages[-10:]:
        role = "assistant" if m.role == "assistant" else "user"
        llm_messages.append({"role": role, "content": m.content})

    reply = _call_groq(llm_messages) or _fallback_reply(user_text, grounding)
    return ChatResponse(
        reply=reply,
        suggestions=_suggestions(grounding),
        grounded=bool(grounding.get("profile")),
    )

"""
Voice IVR routes — Twilio TwiML webhooks.

Fixes vs. original branch:
  - PIN auth for returning callers (bcrypt-verified)
  - Redis-backed call state (no in-memory dict)
  - SQLite profile creation for new callers after slab collection
  - Correct fuzzy_match interface (get_top_schemes)
  - CSC locator behind Redis cache (no synchronous Selenium in webhook)
"""

import io
import json
import logging
import os
import uuid
from dataclasses import asdict
from typing import Dict, List

import requests
from fastapi import APIRouter, Request
from fastapi.responses import Response, StreamingResponse
from twilio.twiml.voice_response import Gather, VoiceResponse

from services.auth_service import (
    is_registered, register_citizen, login_citizen,
    get_profile_slabs, AGE_SLABS, GENDER_MAP, INCOME_SLABS, OCCUPATION_MAP,
)
from services.fuzzy_match import get_top_schemes
from services.csc_locator_service import get_csc_by_pincode
from services.sarvam_service import SarvamTTSService

logger = logging.getLogger(__name__)

voice_router = APIRouter(prefix="/api/voice", tags=["voice"])

# ---------------------------------------------------------------------------
# State management – Redis-backed with in-memory fallback
# ---------------------------------------------------------------------------

def _get_redis():
    try:
        import redis
        return redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            decode_responses=True,
        )
    except Exception:
        return None


# Fallback in-memory store (single-worker dev mode only)
_FALLBACK_STATE: Dict[str, Dict[str, str]] = {}

CALL_STATE_TTL = 1800  # 30 min per call session


def _get_call_state(call_sid: str) -> Dict[str, str]:
    r = _get_redis()
    if r:
        try:
            raw = r.get(f"call:{call_sid}")
            if raw:
                return json.loads(raw)
        except Exception:
            pass

    if call_sid in _FALLBACK_STATE:
        return _FALLBACK_STATE[call_sid]

    state = {"language": "en-IN"}
    _set_call_state(call_sid, state)
    return state


def _set_call_state(call_sid: str, state: Dict[str, str]) -> None:
    r = _get_redis()
    if r:
        try:
            r.setex(f"call:{call_sid}", CALL_STATE_TTL, json.dumps(state))
            return
        except Exception:
            pass
    _FALLBACK_STATE[call_sid] = state


# ---------------------------------------------------------------------------
# Audio cache — same Redis/fallback pattern
# ---------------------------------------------------------------------------

_AUDIO_FALLBACK: Dict[str, bytes] = {}


def _cache_audio(audio_id: str, data: bytes) -> None:
    r = _get_redis()
    if r:
        try:
            r.setex(f"audio:{audio_id}", 600, data)  # 10 min TTL
            return
        except Exception:
            pass
    _AUDIO_FALLBACK[audio_id] = data


def _get_audio(audio_id: str) -> bytes:
    r = _get_redis()
    if r:
        try:
            data = r.get(f"audio:{audio_id}")
            if data:
                return data if isinstance(data, bytes) else data.encode("latin-1")
        except Exception:
            pass
    return _AUDIO_FALLBACK.get(audio_id, b"")


# ---------------------------------------------------------------------------
# Constants & prompts
# ---------------------------------------------------------------------------

WEBSITE_NAME = os.getenv("WEBSITE_NAME", "haqse.in")

LANG_MAP = {
    "1": {"name": "English",  "code": "en-IN", "twilio_say": "en-IN"},
    "2": {"name": "Hindi",    "code": "hi-IN", "twilio_say": "hi-IN"},
    "3": {"name": "Marathi",  "code": "mr-IN", "twilio_say": "mr-IN"},
    "4": {"name": "Tamil",    "code": "ta-IN", "twilio_say": "ta-IN"},
    "5": {"name": "Bengali",  "code": "bn-IN", "twilio_say": "bn-IN"},
}

PROMPTS = {
    "language_menu": {
        "en-IN": "Welcome to Citizen Welfare Service. Press 1 for English. Press 2 for Hindi. Press 3 for Marathi. Press 4 for Tamil. Press 5 for Bengali.",
        "hi-IN": "नागरिक कल्याण सेवा में आपका स्वागत है। अंग्रेज़ी के लिए 1 दबाएं। हिंदी के लिए 2 दबाएं। मराठी के लिए 3 दबाएं। तमिल के लिए 4 दबाएं। बंगाली के लिए 5 दबाएं।",
        "mr-IN": "नागरिक कल्याण सेवेत आपले स्वागत आहे. इंग्रजीसाठी 1 दाबा. हिंदीसाठी 2 दाबा. मराठीसाठी 3 दाबा. तमिळसाठी 4 दाबा. बंगालीसाठी 5 दाबा.",
        "ta-IN": "குடிமக்கள் நல சேவைக்கு வரவேற்கிறோம். ஆங்கிலத்திற்கு 1 அழுத்தவும். இந்திக்கு 2. மராத்திக்கு 3. தமிழுக்கு 4. பெங்காலிக்கு 5 அழுத்தவும்.",
        "bn-IN": "সিটিজেন ওয়েলফেয়ার সার্ভিসে স্বাগতম। ইংরেজির জন্য 1 চাপুন। হিন্দির জন্য 2। মরাঠির জন্য 3। তামিলের জন্য 4। বাংলা জন্য 5 চাপুন।",
    },
    "main_menu": {
        "en-IN": "Press 1 to know welfare schemes. Press 2 to find nearby CSC by pincode.",
        "hi-IN": "योजनाओं की जानकारी के लिए 1 दबाएं। पिनकोड से नज़दीकी सीएससी खोजने के लिए 2 दबाएं।",
        "mr-IN": "योजनांची माहिती मिळवण्यासाठी 1 दाबा. पिनकोडने जवळचे CSC शोधण्यासाठी 2 दाबा.",
        "ta-IN": "திட்ட விவரங்களுக்கு 1 அழுத்தவும். பின்கோட் மூலம் அருகிலுள்ள CSC-ஐ கண்டுபிடிக்க 2 அழுத்தவும்.",
        "bn-IN": "স্কিম জানতে 1 চাপুন। পিনকোড দিয়ে নিকটবর্তী CSC খুঁজতে 2 চাপুন।",
    },
    "pin_prompt": {
        "en-IN": "Please enter your 6-digit security PIN.",
        "hi-IN": "कृपया अपना 6 अंकों का सुरक्षा पिन दर्ज करें।",
        "mr-IN": "कृपया आपला 6 अंकी सुरक्षा पिन टाका.",
        "ta-IN": "தயவுசெய்து உங்கள் 6 இலக்க பாதுகாப்பு PIN-ஐ உள்ளிடுங்கள்.",
        "bn-IN": "অনুগ্রহ করে আপনার 6 সংখ্যার সিকিউরিটি পিন দিন।",
    },
    "pin_fail": {
        "en-IN": "Incorrect PIN. Please try again.",
        "hi-IN": "गलत पिन। कृपया पुनः प्रयास करें।",
        "mr-IN": "चुकीचा पिन. कृपया पुन्हा प्रयत्न करा.",
        "ta-IN": "தவறான PIN. மீண்டும் முயற்சிக்கவும்.",
        "bn-IN": "ভুল পিন। আবার চেষ্টা করুন।",
    },
    "set_pin": {
        "en-IN": "Please set a 6-digit security PIN for your account.",
        "hi-IN": "कृपया अपने खाते के लिए 6 अंकों का सुरक्षा पिन सेट करें।",
        "mr-IN": "कृपया आपल्या खात्यासाठी 6 अंकी सुरक्षा पिन सेट करा.",
        "ta-IN": "தயவுசெய்து உங்கள் கணக்கிற்கு 6 இலக்க பாதுகாப்பு PIN அமைக்கவும்.",
        "bn-IN": "অনুগ্রহ করে আপনার অ্যাকাউন্টের জন্য 6 সংখ্যার সিকিউরিটি পিন সেট করুন।",
    },
    "registered_ok": {
        "en-IN": "Your profile has been saved. You can now use your PIN to log in next time.",
        "hi-IN": "आपकी प्रोफ़ाइल सेव हो गई है। अगली बार आप पिन से लॉगिन कर सकते हैं।",
        "mr-IN": "तुमचे प्रोफाइल सेव झाले आहे. पुढच्या वेळी तुम्ही पिनने लॉगिन करू शकता.",
        "ta-IN": "உங்கள் சுயவிவரம் சேமிக்கப்பட்டது. அடுத்த முறை PIN மூலம் உள்நுழையலாம்.",
        "bn-IN": "আপনার প্রোফাইল সংরক্ষিত হয়েছে। পরের বার পিন দিয়ে লগইন করতে পারবেন।",
    },
    "age_menu": {
        "en-IN": "Select age range. Press 1 for below 18. Press 2 for 18 to 35. Press 3 for 36 to 59. Press 4 for 60 and above.",
        "hi-IN": "आयु वर्ग चुनें। 18 से कम के लिए 1 दबाएं। 18 से 35 के लिए 2। 36 से 59 के लिए 3। 60 और उससे अधिक के लिए 4 दबाएं।",
        "mr-IN": "वयोगट निवडा. 18 पेक्षा कमी साठी 1. 18 ते 35 साठी 2. 36 ते 59 साठी 3. 60 आणि अधिक साठी 4 दाबा.",
        "ta-IN": "வயது வரம்பை தேர்வு செய்யவும். 18 க்கு குறைவாக 1. 18 முதல் 35 வரை 2. 36 முதல் 59 வரை 3. 60 மற்றும் அதற்கு மேல் 4.",
        "bn-IN": "বয়স নির্বাচন করুন। 18 এর কম হলে 1। 18 থেকে 35 হলে 2। 36 থেকে 59 হলে 3। 60 বা তার বেশি হলে 4 চাপুন।",
    },
    "gender_menu": {
        "en-IN": "Select gender. Press 1 for male. Press 2 for female. Press 3 for other.",
        "hi-IN": "लिंग चुनें। पुरुष के लिए 1 दबाएं। महिला के लिए 2। अन्य के लिए 3 दबाएं।",
        "mr-IN": "लिंग निवडा. पुरुषासाठी 1 दाबा. महिलेसाठी 2. इतरासाठी 3 दाबा.",
        "ta-IN": "பாலினத்தை தேர்வு செய்யவும். ஆண் 1. பெண் 2. மற்றவை 3.",
        "bn-IN": "লিঙ্গ নির্বাচন করুন। পুরুষ 1। মহিলা 2। অন্যান্য 3 চাপুন।",
    },
    "income_menu": {
        "en-IN": "Select annual income range. Press 1 for below 2 lakh. Press 2 for 2 to 5 lakh. Press 3 for above 5 lakh.",
        "hi-IN": "वार्षिक आय चुनें। 2 लाख से कम के लिए 1 दबाएं। 2 से 5 लाख के लिए 2। 5 लाख से अधिक के लिए 3 दबाएं।",
        "mr-IN": "वार्षिक उत्पन्न निवडा. 2 लाखांपेक्षा कमी साठी 1. 2 ते 5 लाख साठी 2. 5 लाखांपेक्षा जास्त साठी 3 दाबा.",
        "ta-IN": "வருடாந்திர வருமான வரம்பை தேர்வு செய்யவும். 2 லட்சத்திற்கு குறைவாக 1. 2 முதல் 5 லட்சம் வரை 2. 5 லட்சத்திற்கு மேல் 3.",
        "bn-IN": "বার্ষিক আয় নির্বাচন করুন। 2 লাখের নিচে 1। 2 থেকে 5 লাখ 2। 5 লাখের বেশি 3 চাপুন।",
    },
    "occupation_menu": {
        "en-IN": "Select occupation. Press 1 for student. Press 2 for farmer. Press 3 for government employee. Press 4 for other.",
        "hi-IN": "व्यवसाय चुनें। छात्र के लिए 1 दबाएं। किसान के लिए 2। सरकारी कर्मचारी के लिए 3। अन्य के लिए 4 दबाएं।",
        "mr-IN": "व्यवसाय निवडा. विद्यार्थी साठी 1. शेतकरी साठी 2. सरकारी कर्मचारी साठी 3. इतर साठी 4 दाबा.",
        "ta-IN": "தொழிலை தேர்வு செய்யவும். மாணவர் 1. விவசாயி 2. அரசு ஊழியர் 3. பிறர் 4.",
        "bn-IN": "পেশা নির্বাচন করুন। ছাত্র 1। কৃষক 2। সরকারি কর্মচারী 3। অন্যান্য 4 চাপুন।",
    },
    "pincode_prompt": {
        "en-IN": "Please enter your six digit pincode.",
        "hi-IN": "कृपया अपना छह अंकों का पिनकोड दर्ज करें।",
        "mr-IN": "कृपया आपला सहा अंकी पिनकोड टाका.",
        "ta-IN": "தயவுசெய்து உங்கள் ஆறு இலக்க பின்கோடை உள்ளிடுங்கள்.",
        "bn-IN": "অনুগ্রহ করে আপনার ছয় সংখ্যার পিনকোড দিন।",
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _text(lang: str, key: str) -> str:
    return PROMPTS.get(key, {}).get(lang, PROMPTS.get(key, {}).get("en-IN", ""))


def _register_audio(text: str, language_code: str) -> str:
    tts = SarvamTTSService()
    audio_bytes = tts.generate_tts_audio(text=text, language=language_code)
    audio_id = str(uuid.uuid4())
    _cache_audio(audio_id, audio_bytes if audio_bytes else b"")
    return audio_id


def _append_prompt(response, request: Request, text: str, language_code: str) -> None:
    audio_id = _register_audio(text=text, language_code=language_code)
    audio_url = request.url_for("voice_audio", audio_id=audio_id)

    audio_data = _get_audio(audio_id)
    if audio_data:
        response.play(str(audio_url))
    else:
        twilio_lang = next(
            (m["twilio_say"] for m in LANG_MAP.values() if m["code"] == language_code),
            "en-IN",
        )
        response.say(text, language=twilio_lang, voice="alice")


def _build_gather(action_url: str, digits: int = 1, timeout: int = 7) -> Gather:
    return Gather(
        input="dtmf",
        num_digits=digits,
        timeout=timeout,
        action=action_url,
        method="POST",
    )


def _parse_phone(from_number: str) -> str:
    return from_number.replace("+", "").strip()


def _end_line(language: str) -> str:
    endings = {
        "en-IN": f"For other schemes, visit {WEBSITE_NAME} or your nearby CSC centre. Thank you.",
        "hi-IN": f"अन्य योजनाओं के लिए {WEBSITE_NAME} पर जाएं या नज़दीकी सीएससी केंद्र पर जाएं। धन्यवाद।",
        "mr-IN": f"इतर योजनांसाठी {WEBSITE_NAME} वेबसाइटला भेट द्या किंवा जवळच्या CSC केंद्रात जा. धन्यवाद.",
        "ta-IN": f"மற்ற திட்டங்களுக்கு {WEBSITE_NAME} செல்லவும் அல்லது அருகிலுள்ள CSC மையத்தை பார்வையிடவும். நன்றி.",
        "bn-IN": f"অন্যান্য স্কিমের জন্য {WEBSITE_NAME} এ যান অথবা নিকটবর্তী CSC কেন্দ্রে যান। ধন্যবাদ।",
    }
    return endings.get(language, endings["en-IN"])


# ===========================================================================
# ROUTES
# ===========================================================================

@voice_router.post("/incoming")
async def voice_incoming(request: Request):
    """Entry point — language selection."""
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    from_number = _parse_phone(form.get("From", ""))

    state = {"language": "en-IN", "phone": from_number}
    _set_call_state(call_sid, state)

    response = VoiceResponse()
    gather = _build_gather(str(request.url_for("voice_language_selected")), digits=1)
    _append_prompt(gather, request, _text("en-IN", "language_menu"), "en-IN")
    response.append(gather)
    response.redirect(str(request.url_for("voice_incoming")), method="POST")

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/language-selected")
async def voice_language_selected(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    selected = form.get("Digits", "1")

    lang = LANG_MAP.get(selected, LANG_MAP["1"])["code"]
    state = _get_call_state(call_sid)
    state["language"] = lang
    _set_call_state(call_sid, state)

    response = VoiceResponse()
    gather = _build_gather(str(request.url_for("voice_option_selected")), digits=1)
    _append_prompt(gather, request, _text(lang, "main_menu"), lang)
    response.append(gather)
    response.redirect(str(request.url_for("voice_language_selected")), method="POST")

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/option-selected")
async def voice_option_selected(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    choice = form.get("Digits", "")

    state = _get_call_state(call_sid)
    language = state.get("language", "en-IN")

    response = VoiceResponse()

    if choice == "1":
        # Scheme discovery — check if registered
        response.redirect(str(request.url_for("voice_schemes_check")), method="POST")
    elif choice == "2":
        # CSC locator
        gather = _build_gather(str(request.url_for("voice_csc_results")), digits=6, timeout=10)
        _append_prompt(gather, request, _text(language, "pincode_prompt"), language)
        response.append(gather)
        response.redirect(str(request.url_for("voice_option_selected")), method="POST")
    else:
        gather = _build_gather(str(request.url_for("voice_option_selected")), digits=1)
        _append_prompt(gather, request, _text(language, "main_menu"), language)
        response.append(gather)

    return Response(content=str(response), media_type="application/xml")


# ---------------------------------------------------------------------------
# Scheme flow — returning caller (with PIN auth)
# ---------------------------------------------------------------------------

@voice_router.post("/schemes/check")
async def voice_schemes_check(request: Request):
    """Branch: registered → PIN auth, new → slab collection."""
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    from_number = _parse_phone(form.get("From", ""))

    state = _get_call_state(call_sid)
    language = state.get("language", "en-IN")
    state["phone"] = from_number
    _set_call_state(call_sid, state)

    response = VoiceResponse()

    if is_registered(from_number):
        # Returning caller → ask for PIN before showing schemes
        gather = _build_gather(str(request.url_for("voice_pin_verify")), digits=6, timeout=10)
        _append_prompt(gather, request, _text(language, "pin_prompt"), language)
        response.append(gather)
        response.redirect(str(request.url_for("voice_schemes_check")), method="POST")
    else:
        # New caller → collect slabs
        gather = _build_gather(str(request.url_for("voice_schemes_gender")), digits=1)
        _append_prompt(gather, request, _text(language, "age_menu"), language)
        response.append(gather)
        response.redirect(str(request.url_for("voice_schemes_check")), method="POST")

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/schemes/pin-verify")
async def voice_pin_verify(request: Request):
    """Verify PIN for returning caller, then show matched schemes."""
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    entered_pin = form.get("Digits", "")

    state = _get_call_state(call_sid)
    language = state.get("language", "en-IN")
    phone = state.get("phone", "")

    response = VoiceResponse()

    profile = login_citizen(phone, entered_pin)
    if profile is None:
        # Wrong PIN — let them retry once
        attempts = int(state.get("pin_attempts", "0")) + 1
        state["pin_attempts"] = str(attempts)
        _set_call_state(call_sid, state)

        if attempts >= 3:
            _append_prompt(response, request, "Too many failed attempts. Goodbye.", language)
            response.hangup()
            return Response(content=str(response), media_type="application/xml")

        gather = _build_gather(str(request.url_for("voice_pin_verify")), digits=6, timeout=10)
        _append_prompt(gather, request, _text(language, "pin_fail"), language)
        response.append(gather)
        return Response(content=str(response), media_type="application/xml")

    # PIN verified — get profile slabs and run fuzzy_match
    slabs = get_profile_slabs(phone) or {}
    matched = get_top_schemes(slabs, limit=3)

    if matched:
        names = ", ".join([s.name for s in matched])
        result_text = {
            "en-IN": f"Top matching schemes for you: {names}.",
            "hi-IN": f"आपके लिए शीर्ष मिलान योजनाएं: {names}.",
        }.get(language, f"Top matching schemes: {names}.")
    else:
        result_text = _text(language, "pin_prompt").replace(
            _text(language, "pin_prompt"),
            "No matching schemes found at this time."
        )
        result_text = "No matching schemes found at this time."

    _append_prompt(response, request, result_text, language)
    _append_prompt(response, request, _end_line(language), language)
    response.hangup()

    return Response(content=str(response), media_type="application/xml")


# ---------------------------------------------------------------------------
# Scheme flow — new caller (slab collection → register → results)
# ---------------------------------------------------------------------------

@voice_router.post("/schemes/gender")
async def voice_schemes_gender(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    age_choice = form.get("Digits", "2")

    state = _get_call_state(call_sid)
    state["age_choice"] = age_choice
    language = state.get("language", "en-IN")
    _set_call_state(call_sid, state)

    response = VoiceResponse()
    gather = _build_gather(str(request.url_for("voice_schemes_income")), digits=1)
    _append_prompt(gather, request, _text(language, "gender_menu"), language)
    response.append(gather)

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/schemes/income")
async def voice_schemes_income(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    gender_choice = form.get("Digits", "3")

    state = _get_call_state(call_sid)
    state["gender_choice"] = gender_choice
    language = state.get("language", "en-IN")
    _set_call_state(call_sid, state)

    response = VoiceResponse()
    gather = _build_gather(str(request.url_for("voice_schemes_occupation")), digits=1)
    _append_prompt(gather, request, _text(language, "income_menu"), language)
    response.append(gather)

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/schemes/occupation")
async def voice_schemes_occupation(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    income_choice = form.get("Digits", "2")

    state = _get_call_state(call_sid)
    state["income_choice"] = income_choice
    language = state.get("language", "en-IN")
    _set_call_state(call_sid, state)

    response = VoiceResponse()
    gather = _build_gather(str(request.url_for("voice_schemes_results")), digits=1)
    _append_prompt(gather, request, _text(language, "occupation_menu"), language)
    response.append(gather)

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/schemes/results")
async def voice_schemes_results(request: Request):
    """Show top schemes for a new caller, then prompt for PIN registration."""
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    occupation_choice = form.get("Digits", "4")

    state = _get_call_state(call_sid)
    state["occupation_choice"] = occupation_choice
    language = state.get("language", "en-IN")
    _set_call_state(call_sid, state)

    # Build profile dict from collected slabs
    profile_dict = {
        "age_slab":    AGE_SLABS.get(state.get("age_choice", "2"), "18-35"),
        "gender":      GENDER_MAP.get(state.get("gender_choice", "3"), "O"),
        "income_slab": INCOME_SLABS.get(state.get("income_choice", "2"), "2-5L"),
        "occupation":  OCCUPATION_MAP.get(occupation_choice, "other"),
        "state":       "",
        "docs_available": "[]",
        "verified_tier": 0,
    }

    # Run eligibility engine
    matched = get_top_schemes(profile_dict, limit=3)

    response = VoiceResponse()

    if matched:
        names = ", ".join([s.name for s in matched])
        result_text = {
            "en-IN": f"Top matching schemes: {names}.",
            "hi-IN": f"शीर्ष मिलान योजनाएं: {names}.",
        }.get(language, f"Top matching schemes: {names}.")
    else:
        result_text = "No relevant schemes found at this time."

    _append_prompt(response, request, result_text, language)

    # Prompt new user to set a PIN for registration
    gather = _build_gather(str(request.url_for("voice_register_pin")), digits=6, timeout=15)
    _append_prompt(gather, request, _text(language, "set_pin"), language)
    response.append(gather)

    # If they don't enter a PIN, still end gracefully
    _append_prompt(response, request, _end_line(language), language)
    response.hangup()

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/register/pin")
async def voice_register_pin(request: Request):
    """Save the new caller's profile to SQLite with their chosen PIN."""
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    pin = form.get("Digits", "")

    state = _get_call_state(call_sid)
    language = state.get("language", "en-IN")
    phone = state.get("phone", "")

    response = VoiceResponse()

    if len(pin) != 6 or not pin.isdigit():
        _append_prompt(response, request, _text(language, "set_pin"), language)
        gather = _build_gather(str(request.url_for("voice_register_pin")), digits=6, timeout=15)
        _append_prompt(gather, request, _text(language, "set_pin"), language)
        response.append(gather)
        return Response(content=str(response), media_type="application/xml")

    # Register in SQLite
    try:
        register_citizen(
            phone=phone,
            pin=pin,
            age_choice=state.get("age_choice", ""),
            gender_choice=state.get("gender_choice", ""),
            income_choice=state.get("income_choice", ""),
            occupation_choice=state.get("occupation_choice", ""),
            preferred_lang=language.split("-")[0],  # "hi-IN" → "hi"
        )
        _append_prompt(response, request, _text(language, "registered_ok"), language)
    except ValueError:
        # Already registered (edge case: race condition or re-call)
        _append_prompt(response, request, _text(language, "registered_ok"), language)
    except Exception as exc:
        logger.exception("Registration failed: %s", exc)
        _append_prompt(response, request, "Registration could not be completed. Please try on the website.", language)

    _append_prompt(response, request, _end_line(language), language)
    response.hangup()

    return Response(content=str(response), media_type="application/xml")


# ---------------------------------------------------------------------------
# CSC locator
# ---------------------------------------------------------------------------

@voice_router.post("/csc/results")
async def voice_csc_results(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    pincode = (form.get("Digits") or "").strip()

    state = _get_call_state(call_sid)
    language = state.get("language", "en-IN")

    response = VoiceResponse()

    if len(pincode) != 6 or not pincode.isdigit():
        gather = _build_gather(str(request.url_for("voice_csc_results")), digits=6, timeout=10)
        _append_prompt(gather, request, _text(language, "pincode_prompt"), language)
        response.append(gather)
        return Response(content=str(response), media_type="application/xml")

    centers = get_csc_by_pincode(pincode)

    if centers:
        lines = []
        for idx, c in enumerate(centers[:3], start=1):
            lines.append(
                f"Center {idx}: {c.get('name', 'N/A')}, "
                f"Address: {c.get('address', 'N/A')}, "
                f"Contact: {c.get('contact', 'N/A')}"
            )
        result_text = " ".join(lines)
    else:
        result_text = "No CSC centres found for this pincode. Please try the website."

    _append_prompt(response, request, result_text, language)
    _append_prompt(response, request, _end_line(language), language)
    response.hangup()

    return Response(content=str(response), media_type="application/xml")


# ---------------------------------------------------------------------------
# Audio serve endpoint
# ---------------------------------------------------------------------------

@voice_router.get("/audio/{audio_id}", name="voice_audio")
async def voice_audio(audio_id: str):
    audio_bytes = _get_audio(audio_id)
    if not audio_bytes:
        return Response(content=b"", media_type="audio/mpeg")
    return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")

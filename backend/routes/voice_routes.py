import asyncio
import io
import logging
import os
import uuid
from typing import Dict, List

import requests
from fastapi import APIRouter, Request, BackgroundTasks
from fastapi.responses import Response, StreamingResponse
from twilio.twiml.voice_response import Gather, VoiceResponse

from services.scheme_matcher_service import match_schemes_from_json, get_scheme_name, get_scheme_source
from services.csc_locator_service import get_csc_by_pincode
from services.sarvam_service import SarvamTTSService
from services.scheme_matching_service import SchemeMatchingService

logger = logging.getLogger(__name__)

voice_router = APIRouter(prefix="/api/voice", tags=["voice"])

# In-memory session/cache for prototype.
CALL_STATE: Dict[str, Dict[str, str]] = {}
AUDIO_CACHE: Dict[str, bytes] = {}

# TODO: Replace with final production website name when available.
WEBSITE_NAME = "hackanova.in"

LANG_MAP = {
    "1": {
        "name": "English",
        "code": "en-IN",
        "twilio_say": "en-IN",
    },
    "2": {
        "name": "Hindi",
        "code": "hi-IN",
        "twilio_say": "hi-IN",
    },
    "3": {
        "name": "Marathi",
        "code": "mr-IN",
        "twilio_say": "mr-IN",
    },
    "4": {
        "name": "Tamil",
        "code": "ta-IN",
        "twilio_say": "ta-IN",
    },
    "5": {
        "name": "Bengali",
        "code": "bn-IN",
        "twilio_say": "bn-IN",
    },
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


def _get_call_state(call_sid: str) -> Dict[str, str]:
    if call_sid not in CALL_STATE:
        CALL_STATE[call_sid] = {"language": "en-IN"}
    return CALL_STATE[call_sid]


def _text(lang: str, key: str) -> str:
    return PROMPTS.get(key, {}).get(lang, PROMPTS.get(key, {}).get("en-IN", ""))


def _register_audio(text: str, language_code: str) -> str:
    tts = SarvamTTSService()
    audio_bytes = tts.generate_tts_audio(text=text, language=language_code)
    audio_id = str(uuid.uuid4())

    if audio_bytes:
        AUDIO_CACHE[audio_id] = audio_bytes
    else:
        AUDIO_CACHE[audio_id] = b""

    return audio_id


def _append_prompt(response: VoiceResponse, request: Request, text: str, language_code: str) -> None:
    audio_id = _register_audio(text=text, language_code=language_code)
    audio_url = request.url_for("voice_audio", audio_id=audio_id)

    if AUDIO_CACHE.get(audio_id):
        response.play(str(audio_url))
    else:
        # Fallback to Twilio built-in TTS if Sarvam fails/unavailable.
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


def _parse_phone_number(from_number: str) -> str:
    return from_number.replace("+", "").strip()


def _is_registered_caller(phone_number: str) -> bool:
    """
    Check whether the caller already has a stored citizen profile.

    Uses the local SQLite-backed auth service. Falls back to an optional
    external lookup endpoint (CITIZEN_DB_LOOKUP_URL) if configured, for
    deployments where the citizen DB lives in a separate service.
    """
    try:
        from services.auth_service import is_registered
        if is_registered(phone_number):
            return True
    except Exception as exc:
        logger.warning("Local caller lookup failed: %s", exc)

    lookup_url = os.getenv("CITIZEN_DB_LOOKUP_URL")
    if not lookup_url:
        return False

    try:
        response = requests.get(lookup_url, params={"mobile_number": phone_number}, timeout=8)
        response.raise_for_status()
        body = response.json()
        return bool(body.get("exists", False))
    except Exception as exc:
        logger.warning("Caller lookup failed: %s", exc)
        return False


def _end_line(language: str) -> str:
    endings = {
        "en-IN": f"For other schemes, go to our website {WEBSITE_NAME} or visit your nearby CSC centre. Thank you.",
        "hi-IN": f"अन्य योजनाओं के लिए हमारी वेबसाइट {WEBSITE_NAME} पर जाएं या नज़दीकी सीएससी केंद्र पर जाएं। धन्यवाद।",
        "mr-IN": f"इतर योजनांसाठी आमच्या {WEBSITE_NAME} या वेबसाइटला भेट द्या किंवा जवळच्या CSC केंद्रात जा. धन्यवाद.",
        "ta-IN": f"மற்ற திட்டங்களுக்கு எங்கள் இணையதளம் {WEBSITE_NAME} செல்லவும் அல்லது அருகிலுள்ள CSC மையத்தை பார்வையிடவும். நன்றி.",
        "bn-IN": f"অন্যান্য স্কিমের জন্য আমাদের ওয়েবসাইট {WEBSITE_NAME} এ যান অথবা নিকটবর্তী CSC কেন্দ্রে যান। ধন্যবাদ।",
    }
    return endings.get(language, endings["en-IN"])


@voice_router.post("/incoming")
async def voice_incoming(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    state = _get_call_state(call_sid)
    state["language"] = "en-IN"

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
        response.redirect(str(request.url_for("voice_schemes_check")), method="POST")
    elif choice == "2":
        gather = _build_gather(str(request.url_for("voice_csc_results")), digits=6, timeout=10)
        _append_prompt(gather, request, _text(language, "pincode_prompt"), language)
        response.append(gather)
        response.redirect(str(request.url_for("voice_option_selected")), method="POST")
    else:
        gather = _build_gather(str(request.url_for("voice_option_selected")), digits=1)
        _append_prompt(gather, request, _text(language, "main_menu"), language)
        response.append(gather)

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/schemes/check")
async def voice_schemes_check(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    from_number = form.get("From", "")

    state = _get_call_state(call_sid)
    language = state.get("language", "en-IN")

    mobile_number = _parse_phone_number(from_number)
    response = VoiceResponse()

    if _is_registered_caller(mobile_number):
        matched = SchemeMatchingService.get_matched_schemes(
            mobile_number=mobile_number, language_code=language
        )

        if matched:
            top_three = matched[:3]
            names = ", ".join([scheme.get("name", "Unnamed scheme") for scheme in top_three])
            source = top_three[0].get("source", "trusted sources")
            text = f"Top relevant schemes are: {names}. Source: {source}."
        else:
            text = "Your profile was found. Fuzzy scheme matching module will return the best schemes once activated."

        _append_prompt(response, request, text, language)
        _append_prompt(response, request, _end_line(language), language)
        response.hangup()
        return Response(content=str(response), media_type="application/xml")

    # New user flow
    gather = _build_gather(str(request.url_for("voice_schemes_gender")), digits=1)
    _append_prompt(gather, request, _text(language, "age_menu"), language)
    response.append(gather)
    response.redirect(str(request.url_for("voice_schemes_check")), method="POST")

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/schemes/gender")
async def voice_schemes_gender(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    age_choice = form.get("Digits", "2")

    state = _get_call_state(call_sid)
    state["age_choice"] = age_choice
    language = state.get("language", "en-IN")

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

    response = VoiceResponse()
    gather = _build_gather(str(request.url_for("voice_schemes_results")), digits=1)
    _append_prompt(gather, request, _text(language, "occupation_menu"), language)
    response.append(gather)

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/schemes/results")
async def voice_schemes_results(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    occupation_choice = form.get("Digits", "4")

    state = _get_call_state(call_sid)
    state["occupation_choice"] = occupation_choice
    language = state.get("language", "en-IN")

    age_choice = state.get("age_choice", "2")
    gender_choice = state.get("gender_choice", "3")
    income_choice = state.get("income_choice", "2")

    # Match against scraped schemes_database.json (falls back to test_delete_data if JSON not yet generated)
    schemes = match_schemes_from_json(
        age_range_choice=age_choice,
        gender_choice=gender_choice,
        income_choice=income_choice,
        occupation_choice=occupation_choice,
        limit=3,
    )

    if schemes:
        scheme_names = ", ".join([get_scheme_name(s) for s in schemes])
        sources = ", ".join(sorted(set([get_scheme_source(s) for s in schemes])))
        result_text = f"Top matching schemes are: {scheme_names}. Source: {sources}."
    else:
        result_text = "No relevant schemes found at this moment."

    response = VoiceResponse()
    _append_prompt(response, request, result_text, language)
    _append_prompt(response, request, _end_line(language), language)
    response.hangup()

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/csc/results")
async def voice_csc_results(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    pincode = (form.get("Digits") or "").strip()

    state = _get_call_state(call_sid)
    language = state.get("language", "en-IN")

    response = VoiceResponse()

    # Validate pincode
    if len(pincode) != 6 or not pincode.isdigit():
        gather = _build_gather(str(request.url_for("voice_csc_results")), digits=6, timeout=10)
        _append_prompt(gather, request, _text(language, "pincode_prompt"), language)
        response.append(gather)
        return Response(content=str(response), media_type="application/xml")

    # Fetch CSC centers with timeout (5 seconds to stay safe with Twilio's 15s limit)
    # If timed out, will use cached result on next request
    logger.info(f"📍 Fetching CSC centers for pincode {pincode} with 5s timeout...")
    try:
        loop = asyncio.get_event_loop()
        centers = await asyncio.wait_for(
            loop.run_in_executor(None, get_csc_by_pincode, pincode),
            timeout=5.0
        )
        state["csc_centers"] = centers
        state["csc_pincode"] = pincode
        logger.info(f"✅ CSC lookup complete for {call_sid}: found {len(centers)} centers")
    except asyncio.TimeoutError:
        logger.warning(f"⏱️ CSC lookup timed out after 5s for pincode {pincode}")
        # Use any cached results from previous calls
        centers = state.get("csc_centers", [])
    except Exception as exc:
        logger.exception(f"❌ CSC lookup failed: {exc}")
        centers = []

    # Format and return results
    if centers:
        lines: List[str] = []
        for idx, c in enumerate(centers[:3], start=1):
            lines.append(
                f"Center {idx}: {c.get('name', 'N/A')}, Address: {c.get('address', 'N/A')}, Contact: {c.get('contact', 'N/A')}, Distance: {c.get('distance', 'N/A')}"
            )
        result_text = " ".join(lines)
    else:
        result_text = "We are searching for CSC details in your area. Please try again in a moment, or visit our website for more options."

    _append_prompt(response, request, result_text, language)
    _append_prompt(response, request, _end_line(language), language)

    # Add menu for user to repeat results or end call
    gather = _build_gather(str(request.url_for("voice_csc_menu")), digits=1, timeout=10)
    menu_text = _text(language, "csc_menu_prompt") if language in ["hi-IN", "mr-IN", "ta-IN", "bn-IN"] else "Press 1 to hear the centers again, or press 2 to end the call."
    _append_prompt(gather, request, menu_text, language)
    response.append(gather)

    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/csc/menu", name="voice_csc_menu")
async def voice_csc_menu(request: Request):
    form = await request.form()
    call_sid = form.get("CallSid", "default")
    choice = (form.get("Digits") or "").strip()

    state = _get_call_state(call_sid)
    language = state.get("language", "en-IN")
    centers = state.get("csc_centers", [])

    response = VoiceResponse()

    if choice == "1":
        # Repeat centers
        if centers:
            lines: List[str] = []
            for idx, c in enumerate(centers[:3], start=1):
                lines.append(
                    f"Center {idx}: {c.get('name', 'N/A')}, Address: {c.get('address', 'N/A')}, Contact: {c.get('contact', 'N/A')}, Distance: {c.get('distance', 'N/A')}"
                )
            result_text = " ".join(lines)
            _append_prompt(response, request, result_text, language)
        else:
            _append_prompt(response, request, "No CSC centers found.", language)

        # Ask again
        gather = _build_gather(str(request.url_for("voice_csc_menu")), digits=1, timeout=10)
        menu_text = "Press 1 to hear again, or press 2 to end the call."
        _append_prompt(gather, request, menu_text, language)
        response.append(gather)
    elif choice == "2":
        # End call
        _append_prompt(response, request, "Thank you for using our service. Goodbye.", language)
        response.hangup()
    else:
        # Invalid choice
        gather = _build_gather(str(request.url_for("voice_csc_menu")), digits=1, timeout=10)
        _append_prompt(gather, request, "Invalid option. Press 1 to hear the centers again, or press 2 to end the call.", language)
        response.append(gather)

    return Response(content=str(response), media_type="application/xml")


@voice_router.get("/audio/{audio_id}", name="voice_audio")
async def voice_audio(audio_id: str):
    audio_bytes = AUDIO_CACHE.get(audio_id)
    if not audio_bytes:
        # Empty response lets caller fallback to <Say> path on next step.
        return Response(content=b"", media_type="audio/mpeg")

    return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")

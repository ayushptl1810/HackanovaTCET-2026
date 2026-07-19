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
        "en-IN": "Press 1 to know welfare schemes. Press 2 to find nearby CSC by pincode. Press 3 to describe your need in your own words.",
        "hi-IN": "योजनाओं की जानकारी के लिए 1 दबाएं। पिनकोड से नज़दीकी सीएससी खोजने के लिए 2 दबाएं। अपनी ज़रूरत अपने शब्दों में बताने के लिए 3 दबाएं।",
        "mr-IN": "योजनांची माहिती मिळवण्यासाठी 1 दाबा. पिनकोडने जवळचे CSC शोधण्यासाठी 2 दाबा. तुमची गरज तुमच्या शब्दांत सांगण्यासाठी 3 दाबा.",
        "ta-IN": "திட்ட விவரங்களுக்கு 1 அழுத்தவும். பின்கோட் மூலம் அருகிலுள்ள CSC-ஐ கண்டுபிடிக்க 2 அழுத்தவும். உங்கள் தேவையை உங்கள் சொந்த வார்த்தைகளில் சொல்ல 3 அழுத்தவும்.",
        "bn-IN": "স্কিম জানতে 1 চাপুন। পিনকোড দিয়ে নিকটবর্তী CSC খুঁজতে 2 চাপুন। নিজের ভাষায় আপনার প্রয়োজন বলতে 3 চাপুন।",
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
    "top_matching": {
        "en-IN": "Top matching schemes are: {names}.",
        "hi-IN": "आपकी सबसे उपयुक्त योजनाएं हैं: {names}।",
        "mr-IN": "तुमच्यासाठी सर्वोत्तम योजना आहेत: {names}.",
        "ta-IN": "உங்களுக்கு ஏற்ற சிறந்த திட்டங்கள்: {names}.",
        "bn-IN": "আপনার জন্য সেরা স্কিমগুলো হলো: {names}।",
    },
    "no_schemes": {
        "en-IN": "No relevant schemes found at this moment.",
        "hi-IN": "इस समय कोई प्रासंगिक योजना नहीं मिली।",
        "mr-IN": "याक्षणी कोणतीही संबंधित योजना सापडली नाही.",
        "ta-IN": "இந்த நேரத்தில் தொடர்புடைய திட்டங்கள் எதுவும் கிடைக்கவில்லை.",
        "bn-IN": "এই মুহূর্তে কোনো উপযুক্ত স্কিম পাওয়া যায়নি।",
    },
    "profile_found_fuzzy_pending": {
        "en-IN": "Your profile was found. Fuzzy scheme matching module will return the best schemes once activated.",
        "hi-IN": "आपकी प्रोफ़ाइल मिल गई है। फज़ी स्कीम मैचिंग मॉड्यूल चालू होने पर बेहतरीन योजनाएं बताएगा।",
        "mr-IN": "तुमची प्रोफाईल सापडली आहे. फझी स्कीम मॅचिंग मॉड्यूल सक्रिय झाल्यावर सर्वोत्तम योजना सांगेल.",
        "ta-IN": "உங்கள் விவரங்கள் கிடைத்துள்ளன. ஃபஸி ஸ்கீம் மேட்சிங் மாட்யூல் ஆக்டிவேட் ஆனதும் சிறந்த திட்டங்களை வழங்கும்.",
        "bn-IN": "আপনার প্রোফাইল পাওয়া গেছে। ফাজি স্কিম ম্যাচিং মডিউল চালু হলে সেরা স্কিমগুলো জানাবে।",
    },
    "csc_not_found": {
        "en-IN": "We are searching for CSC details in your area. Please try again in a moment.",
        "hi-IN": "हम आपके क्षेत्र में सीएससी खोज रहे हैं। कृपया कुछ समय बाद पुनः प्रयास करें।",
        "mr-IN": "आम्ही तुमच्या परिसरातील CSC तपशील शोधत आहोत. कृपया काही वेळानंतर पुन्हा प्रयत्न करा.",
        "ta-IN": "உங்கள் பகுதியில் சிஎஸ்சி விவரங்களை தேடுகிறோம். சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.",
        "bn-IN": "আমরা আপনার এলাকায় সিএসসি விவரங்கள் খুঁজছি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।",
    },
    "csc_menu_prompt": {
        "en-IN": "Press 1 to hear the centers again, or press 2 to end the call.",
        "hi-IN": "केंद्रों को फिर से सुनने के लिए 1 दबाएं, या कॉल समाप्त करने के लिए 2 दबाएं।",
        "mr-IN": "केंद्रे पुन्हा ऐकण्यासाठी 1 दाबा, किंवा कॉल संपवण्यासाठी 2 दाबा.",
        "ta-IN": "மையங்களை மீண்டும் கேட்க 1 ஐ அழுத்தவும், அல்லது அழைப்பை முடிக்க 2 ஐ அழுத்தவும்.",
        "bn-IN": "কেন্দ্রগুলো আবার শুনতে 1 চাপুন, অথবা কল শেষ করতে 2 চাপুন।",
    },
    "csc_no_centers": {
        "en-IN": "No CSC centers found.",
        "hi-IN": "कोई सीएससी केंद्र नहीं मिला।",
        "mr-IN": "कोणतेही CSC केंद्र सापडले नाही.",
        "ta-IN": "எந்த சிஎஸ்சி மையமும் கிடைக்கவில்லை.",
        "bn-IN": "কোনো সিএসসি কেন্দ্র পাওয়া যায়নি।",
    },
    "goodbye": {
        "en-IN": "Thank you for using our service. Goodbye.",
        "hi-IN": "हमारी सेवा का उपयोग करने के लिए धन्यवाद। अलविदा।",
        "mr-IN": "आमच्या सेवेचा वापर केल्याबद्दल धन्यवाद. निरोप.",
        "ta-IN": "எங்கள் சேவையை பயன்படுத்தியதற்கு நன்றி. போய் வாருங்கள்.",
        "bn-IN": "আমাদের সেবা ব্যবহারের জন্য ধন্যবাদ। বিদায়।",
    },
    "invalid_option_csc": {
        "en-IN": "Invalid option. Press 1 to hear the centers again, or press 2 to end the call.",
        "hi-IN": "अमान्य विकल्प। केंद्रों को फिर से सुनने के लिए 1 दबाएं, या कॉल समाप्त करने के लिए 2 दबाएं।",
        "mr-IN": "अवैध पर्याय. केंद्रे पुन्हा ऐकण्यासाठी 1 दाबा, किंवा कॉल संपवण्यासाठी 2 दाबा.",
        "ta-IN": "தவறான விருப்பம். மையங்களை மீண்டும் கேட்க 1 ஐ அழுத்தவும், அல்லது அழைப்பை முடிக்க 2 ஐ அழுத்தவும்.",
        "bn-IN": "অবৈধ অপশন। কেন্দ্রগুলো আবার শুনতে 1 চাপুন, অথবা কল শেষ করতে 2 চাপুন।",
    },
    "not_understand": {
        "en-IN": "Sorry, we could not understand. Please try again.",
        "hi-IN": "क्षमा करें, हम समझ नहीं पाए। कृपया पुनः प्रयास करें।",
        "mr-IN": "क्षमस्व, आम्हाला समजले नाही. कृपया पुन्हा प्रयत्न करा.",
        "ta-IN": "மன்னிக்கவும், எங்களுக்கு புரியவில்லை. மீண்டும் முயற்சிக்கவும்.",
        "bn-IN": "দুঃখিত, আমরা বুঝতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।",
    },
    "press_any_key_retry": {
        "en-IN": "Press any key to try again.",
        "hi-IN": "पुनः प्रयास करने के लिए कोई भी कुंजी दबाएं।",
        "mr-IN": "पुन्हा प्रयत्न करण्यासाठी कोणतेही बटण दाबा.",
        "ta-IN": "மீண்டும் முயற்சிக்க ஏதேனும் ஒரு விசையை அழுத்தவும்.",
        "bn-IN": "আবার চেষ্টা করতে যেকোনো কী চাপুন।",
    },
    "search_results_found": {
        "en-IN": "We found {count} schemes for you. {details}",
        "hi-IN": "हमें आपके लिए {count} योजनाएं मिलीं। {details}",
        "mr-IN": "आम्हाला तुमच्यासाठी {count} योजना सापडल्या. {details}",
        "ta-IN": "உங்களுக்காக {count} திட்டங்களை கண்டுபிடித்துள்ளோம். {details}",
        "bn-IN": "আমরা আপনার জন্য {count} স্কিম খুঁজে পেয়েছি। {details}",
    },
    "search_no_match": {
        "en-IN": "We could not find a matching scheme for your request.",
        "hi-IN": "हम आपके अनुरोध के लिए कोई उपयुक्त योजना नहीं खोज पाए।",
        "mr-IN": "आम्ही तुमच्या विनंतीसाठी कोणतीही योग्य योजना शोधू शकलो नाही.",
        "ta-IN": "உங்கள் கோரிக்கைக்கு ஏற்ற எந்த திட்டத்தையும் நாங்கள் கண்டுபிடிக்க முடியவில்லை.",
        "bn-IN": "আমরা আপনার অনুরোধের জন্য কোনো উপযুক্ত স্কিম খুঁজে পাইনি।",
    },
    "press_any_key_search_again": {
        "en-IN": "Press any key to search again, or hang up to end.",
        "hi-IN": "फिर से खोजने के लिए कोई भी कुंजी दबाएं, या समाप्त करने के लिए कॉल काट दें।",
        "mr-IN": "पुन्हा शोधण्यासाठी कोणतेही बटण दाबा, किंवा संपवण्यासाठी कॉल कट करा.",
        "ta-IN": "மீண்டும் தேட ஏதேனும் ஒரு விசையை அழுத்தவும், அல்லது முடிக்க அழைப்பை துண்டிக்கவும்.",
        "bn-IN": "আবার খুঁজতে যেকোনো কী চাপুন, অথবা শেষ করতে কল কেটে দিন।",
    }
}


def _get_call_state(call_sid: str) -> Dict[str, str]:
    if call_sid not in CALL_STATE:
        CALL_STATE[call_sid] = {"language": "en-IN"}
    return CALL_STATE[call_sid]


def _text(lang: str, key: str, **kwargs) -> str:
    template = PROMPTS.get(key, {}).get(lang, PROMPTS.get(key, {}).get("en-IN", ""))
    return template.format(**kwargs) if kwargs else template


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
    elif choice == "3":
        # Voice-driven semantic search: let the caller speak their need.
        response.redirect(str(request.url_for("voice_search_start")), method="POST")
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
            text = _text(language, "top_matching", names=names)
        else:
            text = _text(language, "profile_found_fuzzy_pending")

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
        result_text = _text(language, "top_matching", names=scheme_names)
    else:
        result_text = _text(language, "no_schemes")

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
            lines.append(f"Center {idx}: {c.get('name', 'N/A')}")
        result_text = " ".join(lines)
    else:
        result_text = _text(language, "csc_not_found")

    _append_prompt(response, request, result_text, language)
    if centers:
        _append_prompt(response, request, _end_line(language), language)

    # Add menu for user to repeat results or end call
    gather = _build_gather(str(request.url_for("voice_csc_menu")), digits=1, timeout=10)
    menu_text = _text(language, "csc_menu_prompt")
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
                lines.append(f"Center {idx}: {c.get('name', 'N/A')}")
            result_text = " ".join(lines)
            _append_prompt(response, request, result_text, language)
        else:
            _append_prompt(response, request, _text(language, "csc_no_centers"), language)

        # Ask again
        gather = _build_gather(str(request.url_for("voice_csc_menu")), digits=1, timeout=10)
        _append_prompt(gather, request, _text(language, "csc_menu_prompt"), language)
        response.append(gather)
    elif choice == "2":
        # End call
        _append_prompt(response, request, _text(language, "goodbye"), language)
        response.hangup()
    else:
        # Invalid choice
        gather = _build_gather(str(request.url_for("voice_csc_menu")), digits=1, timeout=10)
        _append_prompt(gather, request, _text(language, "invalid_option_csc"), language)
        response.append(gather)

    return Response(content=str(response), media_type="application/xml")


# ---------------------------------------------------------------------------
# Voice-driven semantic search (ASR) — lets low-literacy callers SPEAK their
# need instead of pressing digits. Flow:
#   /search/start  → prompt + <Record> the caller's spoken need
#   /search/results → download recording → Sarvam ASR → semantic search
#                     → eligibility → speak the top matches
# ---------------------------------------------------------------------------

_SEARCH_PROMPT = {
    "en-IN": "After the beep, tell us in a few words what help you need. For example, money for my child's education.",
    "hi-IN": "बीप के बाद, कुछ शब्दों में बताइए कि आपको किस मदद की ज़रूरत है। जैसे, मेरे बच्चे की पढ़ाई के लिए पैसे।",
    "mr-IN": "बीप नंतर, थोडक्यात सांगा तुम्हाला कोणती मदत हवी आहे. उदाहरणार्थ, माझ्या मुलाच्या शिक्षणासाठी पैसे.",
    "ta-IN": "பீப் ஒலிக்குப் பிறகு, உங்களுக்கு என்ன உதவி தேவை என்பதை சில வார்த்தைகளில் சொல்லுங்கள்.",
    "bn-IN": "বীপের পরে, কয়েকটি শব্দে বলুন আপনার কী সাহায্য দরকার। যেমন, আমার সন্তানের পড়াশোনার জন্য টাকা।",
}


def _download_twilio_recording(recording_url: str) -> bytes:
    """Fetch a Twilio recording (WAV) using the account credentials."""
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    url = recording_url if recording_url.endswith((".wav", ".mp3")) else recording_url + ".wav"
    auth = (sid, token) if sid and token else None
    for _ in range(3):  # recording may lag a moment behind the callback
        r = requests.get(url, auth=auth, timeout=20)
        if r.status_code == 200 and r.content:
            return r.content
    return b""


@voice_router.post("/search/start", name="voice_search_start")
async def voice_search_start(request: Request):
    """Prompt the caller to speak their need, then record it."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    language = _get_call_state(call_sid).get("language", "en-IN")

    response = VoiceResponse()
    prompt = _SEARCH_PROMPT.get(language, _SEARCH_PROMPT["en-IN"])
    _append_prompt(response, request, prompt, language)
    response.record(
        action=str(request.url_for("voice_search_results")),
        method="POST",
        max_length=10,
        play_beep=True,
        timeout=3,
        trim="trim-silence",
    )
    return Response(content=str(response), media_type="application/xml")


@voice_router.post("/search/results", name="voice_search_results")
async def voice_search_results(request: Request):
    """Transcribe the recording (Sarvam ASR) → semantic search → speak matches."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    from_number = _parse_phone_number(form.get("From", ""))
    recording_url = form.get("RecordingUrl", "")
    language = _get_call_state(call_sid).get("language", "en-IN")

    response = VoiceResponse()

    # 1) Speech → text (auto-detect language; reply in the caller's language)
    transcript = ""
    audio = _download_twilio_recording(recording_url) if recording_url else b""
    if audio:
        from services.sarvam_service import SarvamASRService
        transcript, detected = SarvamASRService().transcribe_detailed(audio, language="unknown")
        transcript = transcript or ""
        if detected:
            language = detected                 # speak results back in their language
            _get_call_state(call_sid)["language"] = detected

    if not transcript:
        _append_prompt(response, request, _text(language, "not_understand"), language)
        gather = _build_gather(str(request.url_for("voice_search_start")), digits=1, timeout=8)
        _append_prompt(gather, request, _text(language, "press_any_key_retry"), language)
        response.append(gather)
        return Response(content=str(response), media_type="application/xml")

    logger.info("Voice search transcript: %r", transcript)

    # 2) Semantic search + eligibility for this caller
    try:
        from services.semantic import search as semantic_search
        from services.eligibility import evaluate_scheme, ELIGIBLE
        from services.auth_service import get_profile_slabs
        from services.scheme_cache import get_schemes

        slabs = get_profile_slabs(from_number) or {}
        by_id = {s.get("scheme_id"): s for s in get_schemes()}
        hits = semantic_search(transcript, top_k=10)
        ranked = []
        for sid, sim in hits:
            scheme = by_id.get(sid)
            if not scheme:
                continue
            verdict = evaluate_scheme(slabs, scheme).verdict
            if verdict != "not_eligible":
                ranked.append((scheme.get("name", ""), verdict, sim))
        ranked.sort(key=lambda r: (r[1] != ELIGIBLE, -r[2]))
    except Exception as exc:
        logger.exception("Voice semantic search failed: %s", exc)
        ranked = []

    # 3) Speak results
    if ranked:
        top = ranked[:3]
        spoken = ""
        for i, (name, _v, _s) in enumerate(top, start=1):
            spoken += f"Scheme {i}: {name}. "
        _append_prompt(response, request, _text(language, "search_results_found", count=len(top), details=spoken), language)
    else:
        _append_prompt(response, request, _text(language, "search_no_match"), language)

    gather = _build_gather(str(request.url_for("voice_search_start")), digits=1, timeout=8)
    _append_prompt(gather, request, _text(language, "press_any_key_search_again"), language)
    response.append(gather)
    return Response(content=str(response), media_type="application/xml")


@voice_router.get("/audio/{audio_id}", name="voice_audio")
async def voice_audio(audio_id: str):
    audio_bytes = AUDIO_CACHE.get(audio_id)
    if not audio_bytes:
        # Empty response lets caller fallback to <Say> path on next step.
        return Response(content=b"", media_type="audio/mpeg")

    return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")

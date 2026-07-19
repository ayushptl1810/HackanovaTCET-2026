import { createContext, useContext, useState, useCallback, useMemo } from "react";

/*
 * Lightweight i18n for the Haqq UI.
 *
 * `t(key)` returns the string for the active language, falling back to English
 * when a translation is missing — so partially-translated languages still work.
 * Language choice is persisted in localStorage. The Web Speech voice agent reuses
 * the same language codes (see LANG_CODES) for STT/TTS.
 */

export const LANGS = [
  { id: "en", label: "English", native: "English" },
  { id: "hi", label: "Hindi", native: "हिन्दी" },
  { id: "mr", label: "Marathi", native: "मराठी" },
  { id: "ta", label: "Tamil", native: "தமிழ்" },
  { id: "bn", label: "Bengali", native: "বাংলা" },
];
export const LANG_CODES = { en: "en-IN", hi: "hi-IN", mr: "mr-IN", ta: "ta-IN", bn: "bn-IN" };

// key: { en, hi, mr, ta, bn }
const T = {
  // nav / header
  "nav.home": { en: "Home", hi: "होम", mr: "मुख्यपृष्ठ", ta: "முகப்பு", bn: "হোম" },
  "nav.schemes": { en: "Schemes", hi: "योजनाएँ", mr: "योजना", ta: "திட்டங்கள்", bn: "স্কিম" },
  "nav.how": { en: "How it works", hi: "यह कैसे काम करता है", mr: "हे कसे कार्य करते", ta: "இது எப்படி வேலை செய்கிறது", bn: "কীভাবে কাজ করে" },
  "nav.about": { en: "About", hi: "परिचय", mr: "आमच्याबद्दल", ta: "பற்றி", bn: "সম্পর্কে" },
  "cta.login": { en: "Citizen Login", hi: "नागरिक लॉगिन", mr: "नागरिक लॉगिन", ta: "குடிமகன் உள்நுழைவு", bn: "নাগরিক লগইন" },
  "cta.logout": { en: "Logout", hi: "लॉग आउट", mr: "बाहेर पडा", ta: "வெளியேறு", bn: "লগআউট" },
  "cta.dashboard": { en: "Dashboard", hi: "डैशबोर्ड", mr: "डॅशबोर्ड", ta: "டாஷ்போர்டு", bn: "ড্যাশবোর্ড" },

  // dashboard
  "dash.greeting": { en: "Namaste", hi: "नमस्ते", mr: "नमस्कार", ta: "வணக்கம்", bn: "নমস্কার" },
  "dash.subtitle": { en: "Here are the welfare schemes you're entitled to.", hi: "यहाँ वे कल्याण योजनाएँ हैं जिनके आप हक़दार हैं।", mr: "तुम्ही पात्र असलेल्या कल्याण योजना येथे आहेत.", ta: "நீங்கள் உரிமையுள்ள நலத்திட்டங்கள் இங்கே.", bn: "আপনি যেসব কল্যাণ প্রকল্পের অধিকারী তা এখানে।" },
  "dash.describe": { en: "Describe what help you need — in your own words", hi: "बताइए आपको किस मदद की ज़रूरत है — अपने शब्दों में", mr: "तुम्हाला कोणती मदत हवी ते सांगा — तुमच्या शब्दांत", ta: "உங்களுக்கு என்ன உதவி தேவை என்பதை உங்கள் சொந்த வார்த்தைகளில் சொல்லுங்கள்", bn: "আপনার কী সাহায্য দরকার তা নিজের ভাষায় বলুন" },
  "dash.search": { en: "Search", hi: "खोजें", mr: "शोधा", ta: "தேடு", bn: "খুঁজুন" },
  "dash.eligible": { en: "Your eligible schemes", hi: "आपकी पात्र योजनाएँ", mr: "तुमच्या पात्र योजना", ta: "உங்கள் தகுதியான திட்டங்கள்", bn: "আপনার যোগ্য প্রকল্প" },
  "dash.found": { en: "found", hi: "मिलीं", mr: "सापडल्या", ta: "கண்டறியப்பட்டது", bn: "পাওয়া গেছে" },
  "dash.myApplications": { en: "My applications", hi: "मेरे आवेदन", mr: "माझे अर्ज", ta: "எனது விண்ணப்பங்கள்", bn: "আমার আবেদন" },
  "dash.rights": { en: "Your rights, in numbers", hi: "आपके अधिकार, आँकड़ों में", mr: "तुमचे हक्क, आकड्यांत", ta: "உங்கள் உரிமைகள், எண்களில்", bn: "আপনার অধিকার, সংখ্যায়" },
  "dash.potential": { en: "potential benefits you may claim", hi: "संभावित लाभ जो आप ले सकते हैं", mr: "संभाव्य लाभ जे तुम्ही घेऊ शकता", ta: "நீங்கள் பெறக்கூடிய சாத்தியமான நன்மைகள்", bn: "সম্ভাব্য সুবিধা যা আপনি নিতে পারেন" },
  "dash.matched": { en: "schemes matched to you", hi: "आपसे मेल खाती योजनाएँ", mr: "तुमच्याशी जुळणाऱ्या योजना", ta: "உங்களுக்கு பொருந்திய திட்டங்கள்", bn: "আপনার সাথে মিলে যাওয়া প্রকল্প" },
  "dash.completeness": { en: "Profile completeness", hi: "प्रोफ़ाइल पूर्णता", mr: "प्रोफाइल पूर्णता", ta: "சுயவிவரம் முழுமை", bn: "প্রোফাইল সম্পূর্ণতা" },
  "dash.checkRelative": { en: "Check for a family member", hi: "परिवार के सदस्य के लिए जाँचें", mr: "कुटुंबातील सदस्यासाठी तपासा", ta: "குடும்ப உறுப்பினருக்குச் சரிபார்க்கவும்", bn: "পরিবারের সদস্যের জন্য দেখুন" },
  "dash.lifeEvents": { en: "Life events", hi: "जीवन की घटनाएँ", mr: "जीवनातील घटना", ta: "வாழ்க்கை நிகழ்வுகள்", bn: "জীবনের ঘটনা" },
  "dash.lifeEventsSub": { en: "Something changed? Find schemes for your situation.", hi: "कुछ बदला? अपनी स्थिति के लिए योजनाएँ खोजें।", mr: "काही बदलले? तुमच्या परिस्थितीसाठी योजना शोधा.", ta: "ஏதேனும் மாறியதா? உங்கள் நிலைமைக்கான திட்டங்களைக் கண்டறியுங்கள்.", bn: "কিছু বদলেছে? আপনার পরিস্থিতির জন্য প্রকল্প খুঁজুন।" },

  // scheme card
  "card.apply": { en: "Auto-fill & Apply", hi: "स्वतः भरें और आवेदन करें", mr: "स्वयं भरा आणि अर्ज करा", ta: "தானாக நிரப்பி விண்ணப்பிக்கவும்", bn: "স্বয়ংক্রিয় পূরণ ও আবেদন" },
  "card.explain": { en: "Explain simply", hi: "आसान भाषा में समझाएँ", mr: "सोप्या भाषेत समजावा", ta: "எளிமையாக விளக்கு", bn: "সহজভাবে বোঝান" },
  "card.why": { en: "Why do I qualify?", hi: "मैं क्यों पात्र हूँ?", mr: "मी का पात्र आहे?", ta: "நான் ஏன் தகுதி பெறுகிறேன்?", bn: "আমি কেন যোগ্য?" },
  "card.share": { en: "Share", hi: "साझा करें", mr: "शेअर करा", ta: "பகிர்", bn: "শেয়ার" },
  "badge.eligible": { en: "Eligible", hi: "पात्र", mr: "पात्र", ta: "தகுதியானது", bn: "যোগ্য" },
  "badge.needsInfo": { en: "Needs info", hi: "जानकारी चाहिए", mr: "माहिती हवी", ta: "தகவல் தேவை", bn: "তথ্য দরকার" },
  "badge.notEligible": { en: "Not eligible", hi: "पात्र नहीं", mr: "पात्र नाही", ta: "தகுதியில்லை", bn: "যোগ্য নয়" },
  "badge.closingSoon": { en: "Closing soon", hi: "जल्द बंद", mr: "लवकरच बंद", ta: "விரைவில் முடிகிறது", bn: "শীঘ্রই বন্ধ" },
  "badge.openAllYear": { en: "Open all year", hi: "पूरे साल खुला", mr: "वर्षभर खुले", ta: "ஆண்டு முழுவதும்", bn: "সারা বছর খোলা" },

  // common
  "common.close": { en: "Close", hi: "बंद करें", mr: "बंद करा", ta: "மூடு", bn: "বন্ধ" },
  "common.readAloud": { en: "Read aloud", hi: "पढ़कर सुनाएँ", mr: "मोठ्याने वाचा", ta: "சத்தமாக படி", bn: "জোরে পড়ুন" },
};

function translate(lang, key) {
  const row = T[key];
  if (!row) return key;
  return row[lang] || row.en || key;
}

const LangCtx = createContext({ lang: "en", setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("haqq_lang") || "en");
  const setLang = useCallback((l) => { setLangState(l); localStorage.setItem("haqq_lang", l); }, []);
  const t = useCallback((key) => translate(lang, key), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, code: LANG_CODES[lang] || "en-IN" }), [lang, setLang, t]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() { return useContext(LangCtx); }

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX, Bot, Loader2, Sparkles,
} from "lucide-react";
import { api } from "../api";
import { useLang, LANGS as UI_LANGS } from "../lib/i18n";

/*
 * Assistant — "Haqq Sahayak": help chatbot + browser voice agent.
 *
 * - Chatbot: posts the conversation to /api/assistant/chat (grounded on the
 *   citizen's profile + matched schemes, answered by Groq/Llama server-side).
 * - Voice agent: uses the free, browser-native Web Speech API —
 *   SpeechRecognition (speech-to-text) to let low-literacy users SPEAK their
 *   need, and speechSynthesis (text-to-speech) to read replies aloud.
 *   Supports English (en-IN) and Hindi (hi-IN).
 */

const GREET = {
  en: "Namaste 🙏 I'm Haqq Sahayak. Ask me what schemes you're entitled to, or how to apply. You can also tap the mic and speak.",
  hi: "नमस्ते 🙏 मैं हक़ सहायक हूँ। पूछिए आप किन योजनाओं के हक़दार हैं, या आवेदन कैसे करें। आप माइक दबाकर बोल भी सकते हैं।",
  mr: "नमस्कार 🙏 मी हक़ सहायक आहे. तुम्ही कोणत्या योजनांसाठी पात्र आहात ते विचारा. माइक दाबून बोलूही शकता.",
  ta: "வணக்கம் 🙏 நான் ஹக் சகாயக். நீங்கள் எந்த திட்டங்களுக்கு தகுதியானவர் என்று கேளுங்கள். மைக்கை அழுத்தி பேசலாம்.",
  bn: "নমস্কার 🙏 আমি হক় সহায়ক। আপনি কোন প্রকল্পের যোগ্য জানতে জিজ্ঞাসা করুন। মাইকে চেপে বলতেও পারেন।",
};

const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const canTTS = typeof window !== "undefined" && "speechSynthesis" in window;

export default function Assistant() {
  const { lang, setLang, code } = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: GREET[lang] || GREET.en }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);       // auto-speak replies
  const [suggestions, setSuggestions] = useState(["What am I eligible for?", "How do I apply?", "Money for my child's education"]);

  const recogRef = useRef(null);
  const scrollRef = useRef(null);
  const langRef = useRef(lang);
  langRef.current = lang;
  const codeRef = useRef(code);
  codeRef.current = code;
  const cycleLang = () => {
    const ids = UI_LANGS.map((l) => l.id);
    setLang(ids[(ids.indexOf(lang) + 1) % ids.length]);
  };
  const langShort = (UI_LANGS.find((l) => l.id === lang) || UI_LANGS[0]).native;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const speak = useCallback((text) => {
    if (!canTTS) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = codeRef.current;
      u.rate = 0.98;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }, []);

  const send = useCallback(async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    try {
      const r = await api.chat(next.map(({ role, content }) => ({ role, content })), langRef.current);
      const reply = r.reply || "Sorry, I couldn't respond just now.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (Array.isArray(r.suggestions) && r.suggestions.length) setSuggestions(r.suggestions);
      if (voiceOn) speak(reply);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "I'm having trouble connecting. Please try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, voiceOn, speak]);

  // ---- Voice input (speech-to-text) ----
  const toggleListen = useCallback(() => {
    if (!SR) return;
    if (listening) { recogRef.current?.stop(); return; }
    const recog = new SR();
    recogRef.current = recog;
    recog.lang = codeRef.current;
    recog.interimResults = true;
    recog.continuous = false;
    let finalText = "";
    recog.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      setInput(finalText || interim);
    };
    recog.onend = () => {
      setListening(false);
      const t = finalText.trim();
      if (t) { setVoiceOn(true); send(t); }   // speaking implies they want a spoken reply
    };
    recog.onerror = () => setListening(false);
    setListening(true);
    setInput("");
    recog.start();
  }, [listening, send]);

  useEffect(() => () => { try { recogRef.current?.stop(); window.speechSynthesis?.cancel(); } catch {} }, []);

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[var(--navy)] text-white pl-4 pr-5 py-3 shadow-[var(--shadow-lg)] hover:bg-[var(--navy-700)] transition-colors">
          <MessageCircle size={20} />
          <span className="font-semibold text-sm">Ask Haqq</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[380px] h-[70vh] sm:h-[560px] max-h-[calc(100vh-2.5rem)] card shadow-[var(--shadow-lg)] flex flex-col overflow-hidden fade-up">
          {/* header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[var(--navy)] text-white">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0"><Bot size={18} /></div>
              <div className="min-w-0">
                <div className="font-bold text-sm leading-tight">Haqq Sahayak</div>
                <div className="text-[0.7rem] text-white/70 leading-tight flex items-center gap-1">
                  <Sparkles size={10} /> AI help · voice ready
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={cycleLang}
                title="Switch language" className="text-xs font-bold px-2 py-1 rounded-md bg-white/15 hover:bg-white/25">
                {langShort}
              </button>
              {canTTS && (
                <button onClick={() => { setVoiceOn((v) => !v); if (voiceOn) window.speechSynthesis.cancel(); }}
                  title={voiceOn ? "Mute voice" : "Speak replies"}
                  className="p-1.5 rounded-md hover:bg-white/15">
                  {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-white/15"><X size={18} /></button>
            </div>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="grow overflow-y-auto p-3 space-y-3 bg-[var(--surface-2)]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-[var(--radius)] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[var(--navy)] text-white rounded-br-sm"
                    : "bg-white border border-[var(--line)] text-[var(--body)] rounded-bl-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white border border-[var(--line)] rounded-[var(--radius)] rounded-bl-sm px-3 py-2 text-[var(--muted)]">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* suggestions */}
          {!busy && (
            <div className="px-3 pt-2 flex flex-wrap gap-1.5">
              {suggestions.slice(0, 3).map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-[var(--line-strong)] bg-white text-[var(--navy)] hover:bg-[var(--blue-50)] hover:border-[var(--blue)] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* input */}
          <div className="p-3 flex items-end gap-2">
            {SR && (
              <button onClick={toggleListen}
                title={listening ? "Stop" : "Speak"}
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  listening ? "bg-[var(--err)] text-white animate-pulse" : "bg-[var(--surface-2)] border border-[var(--line-strong)] text-[var(--navy)] hover:bg-[var(--blue-50)]"}`}>
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <textarea
              rows={1}
              className="field !py-2.5 resize-none max-h-24"
              placeholder={listening ? "Listening…" : "Type or speak your question…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button onClick={() => send()} disabled={busy || !input.trim()}
              className="shrink-0 w-10 h-10 rounded-full bg-[var(--navy)] text-white flex items-center justify-center hover:bg-[var(--navy-700)] disabled:opacity-50">
              <Send size={17} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

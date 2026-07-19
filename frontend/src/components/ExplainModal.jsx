import { useEffect, useState, useCallback } from "react";
import { X, Volume2, Square, Loader2, Sparkles, BookOpen } from "lucide-react";
import { api } from "../api";
import { useLang, LANG_CODES } from "../lib/i18n";

/*
 * ExplainModal — "Explain simply".
 * Asks the LLM to explain one scheme in 3–4 plain sentences in the citizen's
 * language, and can read it aloud (Web Speech TTS) for low-literacy users.
 */
const canTTS = typeof window !== "undefined" && "speechSynthesis" in window;

export default function ExplainModal({ scheme, onClose }) {
  const { lang, t } = useLang();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!scheme) return;
    let alive = true;
    setBusy(true); setText("");
    api.explainScheme(scheme.scheme_id, lang)
      .then((r) => { if (alive) setText(r.reply || ""); })
      .catch(() => { if (alive) setText("Sorry, I couldn't explain this right now."); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; window.speechSynthesis?.cancel(); };
  }, [scheme, lang]);

  const speak = useCallback(() => {
    if (!canTTS || !text) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_CODES[lang] || "en-IN";
    u.rate = 0.96;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, [text, speaking, lang]);

  if (!scheme) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-[var(--navy)]/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="card shadow-[var(--shadow-lg)] w-full max-w-md p-6 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="badge badge-info mb-2"><Sparkles size={12} /> {t("card.explain")}</span>
            <h3 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
              <BookOpen size={19} className="text-[var(--navy)]" /> {scheme.name}
            </h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm !px-2"><X size={20} /></button>
        </div>

        <div className="mt-4 min-h-[6rem] rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--line)] p-4">
          {busy ? (
            <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
              <Loader2 size={16} className="animate-spin" /> Explaining in simple words…
            </div>
          ) : (
            <p className="text-[var(--body)] leading-relaxed whitespace-pre-wrap">{text}</p>
          )}
        </div>

        {canTTS && !busy && (
          <button onClick={speak} className="btn btn-outline w-full mt-4">
            {speaking ? <Square size={16} /> : <Volume2 size={16} />}
            {speaking ? "Stop" : t("common.readAloud")}
          </button>
        )}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Languages, Check, ChevronDown } from "lucide-react";
import { useLang, LANGS } from "../lib/i18n";

/*
 * LanguageSwitcher — switches the whole UI language (and the voice agent's
 * STT/TTS language, since they share the same codes).
 */
export default function LanguageSwitcher({ compact = false }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGS.find((l) => l.id === lang) || LANGS[0];

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white px-2.5 py-1.5 text-sm font-semibold text-[var(--navy)] hover:bg-[var(--blue-50)] ${compact ? "" : ""}`}>
        <Languages size={15} /> {current.native}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 card shadow-[var(--shadow-lg)] p-1 z-50">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => { setLang(l.id); setOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] text-sm hover:bg-[var(--surface-2)] text-left">
              <span><span className="font-semibold text-[var(--ink)]">{l.native}</span> <span className="text-[var(--muted)] text-xs">{l.label}</span></span>
              {l.id === lang && <Check size={14} className="text-[var(--green)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

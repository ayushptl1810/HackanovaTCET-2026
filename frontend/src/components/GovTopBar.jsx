import NationalEmblem from "./gov/NationalEmblem";
import { useLang } from "../lib/i18n";

// Minimalistic Government-of-India style utility strip
export default function GovTopBar() {
  // Drive the real app-wide i18n (shared with the dashboard, assistant & voice),
  // toggling between English and Hindi — the two most common choices here.
  const { lang, setLang, t } = useLang();
  const isHindi = lang === "hi";

  const setScale = (s) =>
    document.documentElement.style.setProperty("--font-scale", String(s));

  return (
    <div className="bg-[#F8FAFC] border-b border-[var(--line)] text-[var(--muted)] text-[0.7rem] py-1.5 transition-colors">
      <div className="wrap flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 opacity-80 hover:opacity-100 transition-opacity cursor-default">
          <NationalEmblem size={16} motto={false} />
          <span className="truncate tracking-wide">
            <span className="font-medium text-[var(--ink)]">भारत सरकार</span>
            <span className="opacity-50 mx-1">|</span>{t("chrome.govOfIndia")}
          </span>
          <span className="hidden md:inline opacity-40 mx-1">|</span>
          <span className="hidden md:inline font-medium">{t("chrome.ministry")}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-0.5" aria-label={t("chrome.textSize")}>
            <button onClick={() => setScale(0.9)}  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--line)] hover:text-[var(--ink)] transition-colors" aria-label="Decrease text size">A-</button>
            <button onClick={() => setScale(1)}    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--line)] hover:text-[var(--ink)] transition-colors" aria-label="Reset text size">A</button>
            <button onClick={() => setScale(1.15)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--line)] hover:text-[var(--ink)] transition-colors" aria-label="Increase text size">A+</button>
          </div>
          <span className="hidden sm:inline opacity-20">|</span>
          <button
            onClick={() => setLang(isHindi ? "en" : "hi")}
            className="px-2 py-0.5 rounded text-[0.65rem] border border-transparent hover:border-[var(--line-strong)] hover:bg-white text-[var(--navy)] font-semibold transition-all"
          >
            {isHindi ? "English" : "हिंदी"}
          </button>
        </div>
      </div>
    </div>
  );
}

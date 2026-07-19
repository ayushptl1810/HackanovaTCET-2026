import { useState } from "react";
import NationalEmblem from "./gov/NationalEmblem";

// Government-of-India style utility strip: national identity line +
// accessibility text sizing (A- A A+) + language switch.
export default function GovTopBar() {
  const [lang, setLang] = useState("EN");

  const setScale = (s) =>
    document.documentElement.style.setProperty("--font-scale", String(s));

  return (
    <div className="bg-[var(--surface-2)] border-b border-[var(--line)] text-[var(--muted)] text-[0.78rem]">
      <div className="wrap flex items-center justify-between gap-3 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <NationalEmblem size={20} motto={false} />
          <span className="truncate">
            <span className="font-semibold text-[var(--ink)]">भारत सरकार</span>
            <span className="opacity-50"> · </span>Government of India
          </span>
          <span className="hidden md:inline opacity-40">|</span>
          <span className="hidden md:inline">Ministry of Social Justice &amp; Empowerment</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-0.5" aria-label="Text size">
            <button onClick={() => setScale(0.9)}  className="w-6 h-6 rounded hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Decrease text size">A-</button>
            <button onClick={() => setScale(1)}    className="w-6 h-6 rounded hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Reset text size">A</button>
            <button onClick={() => setScale(1.15)} className="w-6 h-6 rounded hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Increase text size">A+</button>
          </div>
          <span className="hidden sm:inline opacity-30">|</span>
          <button
            onClick={() => setLang(lang === "EN" ? "HI" : "EN")}
            className="px-2.5 py-1 rounded-md border border-[var(--line-strong)] hover:border-[var(--blue)] hover:text-[var(--navy)] font-medium transition-colors"
          >
            {lang === "EN" ? "हिंदी" : "English"}
          </button>
        </div>
      </div>
    </div>
  );
}

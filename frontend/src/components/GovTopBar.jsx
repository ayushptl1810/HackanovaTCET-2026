import { useState } from "react";

// Government-style utility bar: tricolor strip + accessibility (A- A A+) + language.
export default function GovTopBar() {
  const [lang, setLang] = useState("EN");

  const setScale = (s) =>
    document.documentElement.style.setProperty("--font-size-scale", String(s));

  return (
    <>
      <div className="tricolor" />
      <div className="w-full bg-[var(--gov-blue-dark)] text-white text-xs">
        <div className="container-gov flex items-center justify-between py-1.5">
          <span className="opacity-90">
            A citizen welfare initiative · भारत के नागरिकों के लिए
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1" aria-label="Text size">
              <button onClick={() => setScale(0.9)} className="px-1.5 hover:underline" aria-label="Decrease text size">A-</button>
              <button onClick={() => setScale(1)} className="px-1.5 hover:underline" aria-label="Reset text size">A</button>
              <button onClick={() => setScale(1.15)} className="px-1.5 hover:underline" aria-label="Increase text size">A+</button>
            </div>
            <button
              onClick={() => setLang(lang === "EN" ? "हिं" : "EN")}
              className="px-2 py-0.5 rounded border border-white/30 hover:bg-white/10"
            >
              {lang === "EN" ? "हिंदी" : "English"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

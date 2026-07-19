import { Sparkles } from "lucide-react";
import { useLang } from "../lib/i18n";

/*
 * LifeEvents — "something changed in my life" → curated scheme bundles.
 * Each card maps a life event to a natural-language query that drives the same
 * semantic search the dashboard already uses, so a citizen lands on the right
 * schemes without knowing any scheme names.
 */
const EVENTS = [
  { emoji: "👶", label: "New baby", q: "maternity benefit newborn child care nutrition" },
  { emoji: "🎓", label: "Started studying", q: "scholarship student education fees tuition" },
  { emoji: "💼", label: "Lost a job", q: "unemployment skill training livelihood support" },
  { emoji: "🌾", label: "Took up farming", q: "farmer agriculture income support kisan" },
  { emoji: "🏠", label: "Need a home", q: "housing home construction subsidy awas" },
  { emoji: "👵", label: "Turned 60", q: "pension senior citizen old age support" },
  { emoji: "⚕️", label: "Health issue", q: "health insurance medical treatment hospital" },
  { emoji: "💍", label: "Got married", q: "marriage assistance women support" },
];

export default function LifeEvents({ onPick }) {
  const { t } = useLang();
  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center gap-2 text-[var(--navy)] font-bold">
        <Sparkles size={16} /> {t("dash.lifeEvents")}
      </div>
      <p className="text-sm text-[var(--muted)] mt-1">{t("dash.lifeEventsSub")}</p>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {EVENTS.map((e) => (
          <button key={e.label} onClick={() => onPick(e.q, e.label)}
            className="rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white hover:border-[var(--blue)] hover:bg-[var(--blue-50)] transition-colors p-3 text-center">
            <div className="text-2xl">{e.emoji}</div>
            <div className="text-xs font-semibold text-[var(--ink)] mt-1 leading-tight">{e.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

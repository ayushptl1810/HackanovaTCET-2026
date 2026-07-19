import { Sparkles, Baby, GraduationCap, Briefcase, Wheat, House, UserRound, HeartPulse, Heart } from "lucide-react";
import { useLang } from "../lib/i18n";

/*
 * LifeEvents — "something changed in my life" → curated scheme bundles.
 * Each card maps a life event to a natural-language query that drives the same
 * semantic search the dashboard already uses, so a citizen lands on the right
 * schemes without knowing any scheme names.
 */
const EVENTS = [
  { Icon: Baby, label: "New baby", q: "maternity benefit newborn child care nutrition" },
  { Icon: GraduationCap, label: "Started studying", q: "scholarship student education fees tuition" },
  { Icon: Briefcase, label: "Lost a job", q: "unemployment skill training livelihood support" },
  { Icon: Wheat, label: "Took up farming", q: "farmer agriculture income support kisan" },
  { Icon: House, label: "Need a home", q: "housing home construction subsidy awas" },
  { Icon: UserRound, label: "Turned 60", q: "pension senior citizen old age support" },
  { Icon: HeartPulse, label: "Health issue", q: "health insurance medical treatment hospital" },
  { Icon: Heart, label: "Got married", q: "marriage assistance women support" },
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
        {EVENTS.map(({ Icon, label, q }) => (
          <button key={label} onClick={() => onPick(q, label)}
            className="rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white hover:border-[var(--blue)] hover:bg-[var(--blue-50)] transition-colors p-3 flex flex-col items-center text-center gap-1.5">
            <span className="w-9 h-9 rounded-full bg-[var(--blue-50)] text-[var(--navy)] flex items-center justify-center">
              <Icon size={18} />
            </span>
            <span className="text-xs font-semibold text-[var(--ink)] leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

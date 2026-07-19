import { useLocation, Link } from "react-router-dom";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useLang } from "../lib/i18n";

export default function GuestResults() {
  const { t } = useLang();
  const { state } = useLocation();
  const results = state?.results || [];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-2)] selection:bg-blue-100">
      <GovHeader />
      <main className="flex-1 wrap py-12">
        <div className="text-center mb-10 fade-up">
          <h1 className="font-heading text-3xl font-bold">{t("guest.found1")} {results.length} {t("guest.found2")}</h1>
          <p className="text-[var(--muted)] mt-2">{t("guest.sub")}</p>
          <Link to="/login" className="btn btn-primary mt-6 inline-flex shadow-lg shadow-blue-900/10 hover:shadow-blue-900/20">
            {t("guest.signInApply")} <ArrowRight size={16} className="ml-2" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 fade-up" style={{ animationDelay: '100ms' }}>
          {results.map((s, i) => (
            <div key={i} className="card p-6 bg-white border border-[var(--line)] rounded-[20px] flex flex-col hover:border-blue-200 transition-colors">
              <div className="flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-1 rounded-md mb-3 inline-block">
                  <CheckCircle2 size={12} className="inline mr-1 mb-0.5" /> {t("guest.matched")}
                </span>
                <h3 className="font-heading text-lg font-bold text-[var(--ink)] leading-snug">{s.name}</h3>
                <p className="mt-3 text-[14px] font-medium text-[var(--muted)] line-clamp-3">
                  {s.benefit_amount || t("guest.defaultBenefit")}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-center justify-between">
                <span className="text-xs text-[var(--muted)] font-bold">{s.category}</span>
                <Link to="/login" className="text-[13px] font-bold text-blue-600 hover:text-blue-700">{t("common.apply")}</Link>
              </div>
            </div>
          ))}
        </div>
      </main>
      <GovFooter />
    </div>
  );
}

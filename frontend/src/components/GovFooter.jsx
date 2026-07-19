import { Link } from "react-router-dom";
import HaqqLogo from "./HaqqLogo";
import NationalEmblem from "./gov/NationalEmblem";
import IndianFlag from "./gov/IndianFlag";
import { useLang } from "../lib/i18n";

// Every footer link routes to a real, reachable destination in the app
// (internal `to`, or a hash section on the landing page). No dead "#" links.
// Labels are translation keys resolved with t() at render.
const columns = [
  {
    titleKey: "foot.colFind",
    links: [
      { key: "foot.findSchemes", to: "/find" },
      { key: "foot.checkEligibility", to: "/find" },
      { key: "foot.browseCatalog", to: "/schemes" },
      { key: "foot.scholarshipsLoans", to: "/schemes" },
    ],
  },
  {
    titleKey: "foot.colDocuments",
    links: [
      { key: "foot.digilocker", to: "/login", literal: "DigiLocker" },
      { key: "foot.aadhaar", to: "/login", literal: "Aadhaar" },
      { key: "foot.voiceAccess", to: "/login" },
      { key: "foot.csc", to: "/find" },
    ],
  },
  {
    titleKey: "foot.colSupport",
    links: [
      { key: "foot.howItWorks", to: "/#how" },
      { key: "foot.accessibility", to: "/#about" },
      { key: "foot.privacy", to: "/#about" },
      { key: "foot.grievance", to: "/login" },
    ],
  },
];

export default function GovFooter() {
  const { t } = useLang();
  return (
    <footer className="mt-auto">
      <div className="tricolor" />
      <div className="bg-white border-t border-[var(--line)] text-[var(--body)] pt-12 pb-6">
        <div className="wrap grid gap-12 md:gap-10 md:grid-cols-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-5 lg:col-span-4">
            <HaqqLogo size={36} />
            <p className="mt-5 text-[15px] font-medium text-[var(--muted)] max-w-sm leading-relaxed">
              {t("foot.tagline")}
            </p>
            <div className="mt-6 flex items-center gap-3 bg-gray-50/80 p-3 rounded-xl border border-gray-100 inline-flex">
              <IndianFlag width={36} wave={false} />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{t("foot.serving")}</span>
            </div>
          </div>

          {/* Link columns */}
          <div className="md:col-span-7 lg:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-8">
            {columns.map((c) => (
              <div key={c.titleKey} className="lg:col-span-1">
                <h4 className="font-heading font-bold text-[var(--ink)] mb-4 text-[15px] uppercase tracking-wider">{t(c.titleKey)}</h4>
                <ul className="space-y-3 text-[15px] font-medium text-[var(--muted)]">
                  {c.links.map((l) => (
                    <li key={l.key}>
                      <Link to={l.to} className="hover:text-blue-600 transition-colors">{l.literal || t(l.key)}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Emblem */}
            <div className="col-span-2 lg:col-span-1 flex flex-col items-start lg:items-end lg:text-right">
              <div className="inline-block p-4 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                <NationalEmblem size={48} />
                <div className="text-[0.7rem] font-bold text-[var(--navy)] uppercase tracking-wider mt-3">{t("chrome.govOfIndia")}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--line)] pt-6">
          <div className="wrap text-[13px] font-medium text-[var(--muted)] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <span>© {new Date().getFullYear()} Haqq · {t("foot.copyright")}</span>
            <span>{t("foot.dpdpNote")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

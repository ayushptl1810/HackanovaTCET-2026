import { Link } from "react-router-dom";
import HaqqLogo from "./HaqqLogo";
import NationalEmblem from "./gov/NationalEmblem";
import IndianFlag from "./gov/IndianFlag";

// Every footer link routes to a real, reachable destination in the app
// (internal `to`, or a hash section on the landing page). No dead "#" links.
const columns = [
  {
    title: "Find welfare",
    links: [
      { label: "Find Schemes", to: "/find" },
      { label: "Check Eligibility", to: "/find" },
      { label: "Browse Catalog", to: "/schemes" },
      { label: "Scholarships & Loans", to: "/schemes" },
    ],
  },
  {
    title: "Documents",
    links: [
      { label: "DigiLocker", to: "/login" },
      { label: "Aadhaar", to: "/login" },
      { label: "Voice Access", to: "/login" },
      { label: "Common Service Centres", to: "/find" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "How it works", to: "/#how" },
      { label: "Accessibility", to: "/#about" },
      { label: "Privacy (DPDP)", to: "/#about" },
      { label: "Grievance Redressal", to: "/login" },
    ],
  },
];

export default function GovFooter() {
  return (
    <footer className="mt-auto">
      <div className="tricolor" />
      <div className="bg-white border-t border-[var(--line)] text-[var(--body)] pt-12 pb-6">
        <div className="wrap grid gap-12 md:gap-10 md:grid-cols-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-5 lg:col-span-4">
            <HaqqLogo size={36} />
            <p className="mt-5 text-[15px] font-medium text-[var(--muted)] max-w-sm leading-relaxed">
              Haqq helps every citizen of India discover the welfare schemes they are entitled
              to, fetch their documents securely, and apply with ease — in their own language,
              by web or phone.
            </p>
            <div className="mt-6 flex items-center gap-3 bg-gray-50/80 p-3 rounded-xl border border-gray-100 inline-flex">
              <IndianFlag width={36} wave={false} />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Serving the citizens of India</span>
            </div>
          </div>

          {/* Link columns */}
          <div className="md:col-span-7 lg:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-8">
            {columns.map((c) => (
              <div key={c.title} className="lg:col-span-1">
                <h4 className="font-heading font-bold text-[var(--ink)] mb-4 text-[15px] uppercase tracking-wider">{c.title}</h4>
                <ul className="space-y-3 text-[15px] font-medium text-[var(--muted)]">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className="hover:text-blue-600 transition-colors">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            
            {/* Emblem */}
            <div className="col-span-2 lg:col-span-1 flex flex-col items-start lg:items-end lg:text-right">
              <div className="inline-block p-4 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                <NationalEmblem size={48} />
                <div className="text-[0.7rem] font-bold text-[var(--navy)] uppercase tracking-wider mt-3">Government of India</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--line)] pt-6">
          <div className="wrap text-[13px] font-medium text-[var(--muted)] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <span>© {new Date().getFullYear()} Haqq · A Citizen Welfare Initiative.</span>
            <span>Data is processed with consent under the DPDP Act, 2023.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

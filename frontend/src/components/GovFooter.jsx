import HaqqLogo from "./HaqqLogo";
import NationalEmblem from "./gov/NationalEmblem";
import IndianFlag from "./gov/IndianFlag";

const columns = [
  { title: "Find welfare", links: ["Find Schemes", "Check Eligibility", "Scholarships", "Skill & Loans"] },
  { title: "Documents", links: ["DigiLocker", "Aadhaar", "Voice Access (IVR)", "Common Service Centres"] },
  { title: "Support", links: ["Accessibility", "Privacy (DPDP)", "Grievance Redressal", "Contact Us"] },
];

export default function GovFooter() {
  return (
    <footer>
      <div className="tricolor" />
      <div className="bg-[var(--surface-2)] border-t border-[var(--line)] text-[var(--body)]">
        <div className="wrap py-10 md:py-12 grid gap-8 md:gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-4">
            <HaqqLogo size={38} />
            <p className="mt-4 text-sm text-[var(--muted)] max-w-sm leading-relaxed">
              Haqq helps every citizen of India discover the welfare schemes they are entitled
              to, fetch their documents securely, and apply with ease — in their own language,
              by web or phone.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <IndianFlag width={40} wave={false} />
              <span className="text-xs text-[var(--muted)]">Proudly serving the citizens of India</span>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((c) => (
            <div key={c.title} className="md:col-span-2">
              <h4 className="font-bold text-[var(--ink)] mb-3 text-sm">{c.title}</h4>
              <ul className="space-y-2.5 text-sm text-[var(--muted)]">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="hover:text-[var(--navy)] hover:underline transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Emblem */}
          <div className="md:col-span-2 flex md:justify-end">
            <div className="text-center">
              <NationalEmblem size={56} />
              <div className="text-[0.7rem] text-[var(--muted)] mt-1">Government of India</div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--line)]">
          <div className="wrap py-4 text-xs text-[var(--muted)] flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
            <span>© {new Date().getFullYear()} Haqq · A Citizen Welfare Initiative, Government of India.</span>
            <span>Data is processed with consent under the DPDP Act, 2023.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

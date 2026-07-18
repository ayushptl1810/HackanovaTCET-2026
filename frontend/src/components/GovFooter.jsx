import HaqqLogo from "./HaqqLogo";

export default function GovFooter() {
  return (
    <footer className="mt-16">
      <div className="tricolor" />
      <div className="bg-[var(--gov-blue-dark)] text-white">
        <div className="container-gov py-10 grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="bg-white inline-block rounded-lg px-3 py-2"><HaqqLogo size={38} /></div>
            <p className="mt-4 text-sm text-white/80 max-w-md">
              Haqq helps every citizen of India discover the welfare schemes they are
              entitled to, fetch their documents securely, and apply with ease — in
              their own language, by web or phone.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-white/80">
              <li>Find Schemes</li>
              <li>Eligibility</li>
              <li>DigiLocker</li>
              <li>Voice Access (IVR)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-white/80">
              <li>Common Service Centres</li>
              <li>Accessibility</li>
              <li>Privacy (DPDP)</li>
              <li>Contact</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/15">
          <div className="container-gov py-4 text-xs text-white/70 flex flex-col sm:flex-row justify-between gap-2">
            <span>© {new Date().getFullYear()} Haqq · A citizen welfare initiative.</span>
            <span>Data is processed with consent under the DPDP Act, 2023.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

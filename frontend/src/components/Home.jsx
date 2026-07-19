import { Link } from "react-router-dom";
import {
  Search, FileCheck2, FilePlus2, Phone, ShieldCheck, Languages,
  ArrowRight, BadgeIndianRupee, UserCheck, CheckCircle2,
} from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { auth } from "../api";

const features = [
  { icon: Search, title: "Discover eligible schemes",
    desc: "Answer a few details and instantly see the Central and State welfare schemes you actually qualify for — no jargon, no guesswork." },
  { icon: FileCheck2, title: "Fetch documents automatically",
    desc: "Securely pull your Aadhaar, PAN and certificates from DigiLocker with your consent — no scanning, no queues." },
  { icon: FilePlus2, title: "Apply with ease",
    desc: "Haqq pre-fills applications from your profile and documents, so form-filling becomes a few taps instead of hours." },
  { icon: Phone, title: "Works over a phone call",
    desc: "No smartphone or literacy needed — call in and speak your need in your own language to find your schemes." },
];

const steps = [
  { n: 1, title: "Tell us about yourself", desc: "Age, income, occupation — once. Your details stay private and consented." },
  { n: 2, title: "See what you're entitled to", desc: "We match you to schemes and show exactly why you're eligible." },
  { n: 3, title: "Fetch documents & apply", desc: "Pull documents from DigiLocker and submit a pre-filled application." },
];

const stats = [
  { value: "3,000+", label: "Welfare schemes" },
  { value: "22", label: "Languages supported" },
  { value: "₹0", label: "Cost to citizens" },
];

export default function Home() {
  const loggedIn = auth.isLoggedIn();
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <GovHeader />

      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-[var(--line)] bg-white hero-grid">
        <div className="wrap py-12 md:py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div className="fade-up">
            <span className="badge badge-info mb-4">
              <ShieldCheck size={14} /> Consent-based · Secure · Multilingual
            </span>
            <h1 className="text-[2.1rem] md:text-5xl font-extrabold leading-[1.08] text-[var(--ink)]">
              Know your <span className="text-[var(--saffron)]">Haqq</span>.<br />
              Claim what is <span className="text-[var(--navy)]">rightfully yours.</span>
            </h1>
            <p className="mt-4 text-base md:text-lg text-[var(--muted)] max-w-xl leading-relaxed">
              Millions of eligible citizens never receive the welfare they deserve — simply
              because finding and applying is hard. Haqq finds the schemes you qualify for,
              fetches your documents, and helps you apply — in your language.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={loggedIn ? "/dashboard" : "/login"} className="btn btn-primary btn-lg">
                {loggedIn ? "Go to my dashboard" : "Find my schemes"} <ArrowRight size={18} />
              </Link>
              <a href="#how" className="btn btn-outline btn-lg">How it works</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm text-[var(--body)]">
              <span className="flex items-center gap-2"><Languages size={16} className="text-[var(--blue)]" /> 22 languages</span>
              <span className="flex items-center gap-2"><Phone size={16} className="text-[var(--blue)]" /> Call-in access</span>
              <span className="flex items-center gap-2"><UserCheck size={16} className="text-[var(--blue)]" /> Real eligibility check</span>
            </div>
          </div>

          {/* Hero preview card */}
          <div className="fade-up lg:justify-self-end w-full max-w-md">
            <div className="card card-hover p-6 md:p-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--navy)]">
                  <BadgeIndianRupee size={18} /> Schemes matched to you
                </div>
                <span className="badge badge-ok">3 eligible</span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { name: "Post-Matric Scholarship", tag: "ok" },
                  { name: "Skill Loan Scheme", tag: "ok" },
                  { name: "Income-based Housing Support", tag: "warn" },
                ].map((s) => (
                  <div key={s.name}
                    className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
                    <span className="font-medium text-[var(--ink)] text-sm">{s.name}</span>
                    <span className={`badge ${s.tag === "ok" ? "badge-ok" : "badge-warn"}`}>
                      {s.tag === "ok" ? "Eligible" : "Needs info"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[var(--radius-sm)] bg-[var(--saffron-50)] border border-[#f7dcc4] p-3 text-sm text-[var(--body)]">
                🔊 “पैसा मेरी बेटी की पढ़ाई के लिए” → matched to scholarships, instantly.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Stats */}
      <section className="bg-[var(--surface-2)] border-b border-[var(--line)]">
        <div className="wrap grid grid-cols-3 divide-x divide-[var(--line)] py-7">
          {stats.map((s) => (
            <div key={s.label} className="text-center px-2">
              <div className="text-2xl md:text-4xl font-extrabold text-[var(--navy)]">{s.value}</div>
              <div className="text-xs md:text-sm text-[var(--muted)] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------- Features */}
      <section className="wrap py-12 md:py-16" id="about">
        <div className="text-center max-w-2xl mx-auto">
          <span className="eyebrow">What Haqq does</span>
          <h2 className="text-2xl md:text-3xl font-bold mt-2">
            One place for every right you're entitled to
          </h2>
          <p className="text-[var(--muted)] mt-3">
            Haqq bridges the last mile between citizens and welfare — discovery, documents, and application.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mt-12">
          {features.map((f) => (
            <div key={f.title} className="card card-hover p-6">
              <div className="w-12 h-12 rounded-[var(--radius-sm)] bg-[var(--blue-50)] text-[var(--navy)]
                flex items-center justify-center">
                <f.icon size={22} />
              </div>
              <h3 className="mt-4 text-base font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- How it works */}
      <section className="bg-[var(--surface-2)] border-y border-[var(--line)]" id="how">
        <div className="wrap py-12 md:py-16">
          <div className="text-center max-w-2xl mx-auto">
            <span className="eyebrow">Simple process</span>
            <h2 className="text-2xl md:text-3xl font-bold mt-2">How Haqq works</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3 mt-12 relative">
            {steps.map((s) => (
              <div key={s.n} className="text-center relative">
                <div className="mx-auto w-14 h-14 rounded-full bg-white border-2 border-[var(--navy)] text-[var(--navy)]
                  flex items-center justify-center text-xl font-extrabold shadow-[var(--shadow-sm)]">
                  {s.n}
                </div>
                <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)] max-w-xs mx-auto leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to={loggedIn ? "/dashboard" : "/login"} className="btn btn-saffron btn-lg">
              Get started <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- CTA band */}
      <section className="wrap py-12 md:py-16">
        <div className="card overflow-hidden border-l-4 border-l-[var(--saffron)]">
          <div className="grid md:grid-cols-2">
            <div className="p-8 md:p-10 bg-[var(--surface-2)] border-b md:border-b-0 md:border-r border-[var(--line)]">
              <h2 className="text-2xl md:text-3xl font-bold">Welfare should reach everyone.</h2>
              <p className="mt-3 text-[var(--muted)] leading-relaxed">
                Whether you have a smartphone or just a basic phone, Haqq meets you where you are —
                in the language you speak, with the documents you already have.
              </p>
              <Link to={loggedIn ? "/dashboard" : "/login"} className="btn btn-primary mt-6">
                {loggedIn ? "Open my dashboard" : "Check my eligibility"} <ArrowRight size={17} />
              </Link>
            </div>
            <div className="p-8 md:p-10">
              <ul className="space-y-4">
                {[
                  "Encrypted PIN — your mobile number is never stored in the clear.",
                  "Documents fetched only with your explicit consent (DPDP Act, 2023).",
                  "Transparent eligibility — see exactly why you qualify.",
                  "Free forever for every citizen of India.",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-sm text-[var(--body)]">
                    <CheckCircle2 size={18} className="text-[var(--green)] shrink-0 mt-0.5" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="flex-1" />
      <GovFooter />
    </div>
  );
}

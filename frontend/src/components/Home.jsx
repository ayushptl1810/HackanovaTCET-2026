import { Link } from "react-router-dom";
import {
  Search, FileCheck2, FilePlus2, Phone, ShieldCheck, Languages,
  ArrowRight, BadgeIndianRupee, UserCheck,
} from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { auth } from "../api";

const features = [
  { icon: Search, title: "Discover eligible schemes",
    desc: "Answer a few details and instantly see the Central and State welfare schemes you actually qualify for — no jargon, no guesswork." },
  { icon: FileCheck2, title: "Fetch documents automatically",
    desc: "Securely pull your Aadhaar, PAN, certificates and more from DigiLocker with your consent — no scanning, no queues." },
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

export default function Home() {
  const loggedIn = auth.isLoggedIn();
  return (
    <div className="min-h-screen flex flex-col">
      <GovHeader />

      {/* Hero */}
      <section className="bg-gradient-to-b from-[#eef3fb] to-[var(--bg)] border-b border-[var(--border)]">
        <div className="container-gov py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="badge badge-eligible mb-4">
              <ShieldCheck size={14} /> Consent-based · Secure · Multilingual
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--gov-navy)] leading-tight">
              Know your <span className="text-[var(--saffron)]">Haqq</span>.<br />
              Claim what is rightfully yours.
            </h1>
            <p className="mt-5 text-lg text-[var(--muted)] max-w-xl">
              Millions of eligible citizens never receive the welfare they deserve —
              simply because finding and applying is hard. Haqq finds the schemes you
              qualify for, fetches your documents, and helps you apply — in your language.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={loggedIn ? "/dashboard" : "/login"} className="btn btn-primary text-base">
                {loggedIn ? "Go to my dashboard" : "Find my schemes"} <ArrowRight size={18} />
              </Link>
              <a href="#how" className="btn btn-outline text-base">How it works</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-[var(--muted)]">
              <span className="flex items-center gap-2"><Languages size={16} className="text-[var(--gov-blue)]" /> 5+ languages</span>
              <span className="flex items-center gap-2"><Phone size={16} className="text-[var(--gov-blue)]" /> Call-in access</span>
              <span className="flex items-center gap-2"><UserCheck size={16} className="text-[var(--gov-blue)]" /> Real eligibility check</span>
            </div>
          </div>

          {/* Hero card */}
          <div className="card p-6 md:p-7">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gov-navy)]">
              <BadgeIndianRupee size={18} /> Schemes matched to you
            </div>
            <div className="mt-4 space-y-3">
              {[
                { name: "Post-Matric Scholarship", tag: "eligible" },
                { name: "Skill Loan Scheme", tag: "eligible" },
                { name: "Income-based Housing Support", tag: "needs" },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between border border-[var(--border)] rounded-lg px-4 py-3">
                  <span className="font-medium">{s.name}</span>
                  <span className={`badge ${s.tag === "eligible" ? "badge-eligible" : "badge-needs"}`}>
                    {s.tag === "eligible" ? "Eligible" : "Needs info"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-[#eef3fb] p-3 text-sm text-[var(--muted)]">
              🔊 "पैसा मेरी बेटी की पढ़ाई के लिए" → matched to scholarships, instantly.
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-gov py-14" id="about">
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--gov-navy)] text-center">
          One place for every right you're entitled to
        </h2>
        <p className="text-center text-[var(--muted)] mt-2 max-w-2xl mx-auto">
          Haqq bridges the last mile between citizens and welfare — discovery, documents, and application.
        </p>
        <div className="grid gap-5 md:grid-cols-4 mt-10">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="w-11 h-11 rounded-lg bg-[#eef3fb] flex items-center justify-center text-[var(--gov-navy)]">
                <f.icon size={22} />
              </div>
              <h3 className="mt-4 font-semibold text-[var(--ink)]">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-[var(--border)]" id="how">
        <div className="container-gov py-14">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--gov-navy)] text-center">How Haqq works</h2>
          <div className="grid gap-6 md:grid-cols-3 mt-10">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-[var(--gov-navy)] text-white flex items-center justify-center text-lg font-bold">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)] max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to={loggedIn ? "/dashboard" : "/login"} className="btn btn-saffron text-base">
              Get started <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <div className="flex-1" />
      <GovFooter />
    </div>
  );
}

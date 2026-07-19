import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Search, FileCheck2, FilePlus2, Phone, ShieldCheck, Languages,
  ArrowRight, BadgeIndianRupee, UserCheck, CheckCircle2, Bot, Layers
} from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { auth, api } from "../api";
import { useLang } from "../lib/i18n";

export default function Home() {
  const { t } = useLang();
  const loggedIn = auth.isLoggedIn();
  const location = useLocation();
  const [schemes, setSchemes] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.publicSchemes();
        setSchemes(res.schemes || []);
      } catch (e) {
        console.error("Failed to load public schemes", e);
      }
    })();
  }, []);

  // Handle smooth scrolling for hash links
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [location]);

  const categories = useMemo(() => {
    const cats = new Set(schemes.map(s => s.category).filter(Boolean));
    return ["All", ...Array.from(cats)].slice(0, 8); // Limit to top categories for UI
  }, [schemes]);

  const displayedSchemes = useMemo(() => {
    let filtered = schemes;
    if (activeCategory !== "All") {
      filtered = schemes.filter(s => s.category === activeCategory);
    }
    return filtered.slice(0, 9); // Show up to 9 on landing page
  }, [schemes, activeCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] selection:bg-blue-100">
      <GovHeader />

      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden bg-white hero-grid pb-20 pt-4 md:pt-8">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white pointer-events-none" />
        <div className="wrap grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className="fade-up">
            <span className="badge badge-info mb-6 bg-blue-50/80 border-blue-100 backdrop-blur-sm px-4 py-1.5 shadow-sm">
              <ShieldCheck size={16} /> {t("home.badge")}
            </span>
            <h1 className="font-heading text-[2.5rem] md:text-6xl font-extrabold leading-[1.1] text-[var(--ink)]">
              {t("home.heroKnow")} <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Haqq</span>.<br />
              {t("home.heroRest")}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-[var(--muted)] max-w-xl leading-relaxed">
              {t("home.heroSub")}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to={loggedIn ? "/dashboard" : "/find"} className="btn btn-primary btn-lg group shadow-blue-900/10 hover:shadow-blue-900/20">
                {loggedIn ? t("home.ctaDashboard") : t("home.ctaFind")}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#schemes" className="btn btn-outline btn-lg bg-white/50 backdrop-blur-sm">{t("home.ctaBrowse")}</a>
            </div>
          </div>

          <div className="fade-up lg:justify-self-end w-full max-w-md" style={{ animationDelay: '150ms' }}>
            <div className="glass-card rounded-[24px] p-6 md:p-8 border border-blue-100/50 bg-gradient-to-br from-blue-50/30 to-white">
              <div className="flex items-center gap-3 text-sm font-bold text-blue-600 mb-6 bg-blue-50 p-3 rounded-xl border border-blue-100/50">
                <Bot size={24} /> {t("home.agentName")}
              </div>
              <p className="text-[15px] font-medium text-[var(--body)] leading-relaxed">
                {t("home.agentQuote")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Public Schemes */}
      <section className="bg-[var(--surface-2)] border-y border-[var(--line)] py-16 md:py-24" id="schemes">
        <div className="wrap">
          <div className="text-center max-w-2xl mx-auto fade-up">
            <span className="eyebrow bg-white border border-[var(--line)] px-3 py-1 rounded-full shadow-sm">{t("home.catalogEyebrow")}</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mt-4">
              {t("home.catalogTitle")}
            </h2>
            <p className="text-[var(--muted)] text-lg mt-4 leading-relaxed">
              {t("home.catalogSub")}
            </p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2 fade-up" style={{ animationDelay: '100ms' }}>
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeCategory === c 
                    ? "bg-[var(--navy)] text-white shadow-md scale-105" 
                    : "bg-white text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]"
                }`}>
                {c}
              </button>
            ))}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-10 fade-up" style={{ animationDelay: '200ms' }}>
            {displayedSchemes.map((s) => (
              <div key={s.scheme_id} className="card card-hover p-6 rounded-[20px] flex flex-col bg-white border-[var(--line)] border">
                <div className="flex-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-1 rounded-md mb-3 inline-block">
                    {s.category || "General"}
                  </span>
                  <h3 className="font-heading text-lg font-bold text-[var(--ink)] leading-snug">{s.name}</h3>
                  <p className="mt-3 text-[14px] font-medium text-[var(--muted)] line-clamp-2">
                    {s.benefit_amount || t("home.defaultBenefit")}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)]">
                  <Link to="/login" className="text-[13px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group">
                    {t("common.signInApply")} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {schemes.length > 9 && (
            <div className="text-center mt-10">
              <Link to="/login" className="btn btn-outline bg-white">{t("home.viewAll")} {schemes.length} {t("common.schemes")}</Link>
            </div>
          )}
        </div>
      </section>

      {/* --------------------------------------------------- How it works */}
      <section className="wrap py-16 md:py-24" id="how">
        <div className="text-center max-w-2xl mx-auto fade-up">
          <span className="eyebrow bg-blue-50 px-3 py-1 rounded-full text-blue-600">{t("home.processEyebrow")}</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold mt-4">
            {t("home.processTitle")}
          </h2>
          <p className="text-[var(--muted)] text-lg mt-4 leading-relaxed">
            {t("home.processSub")}
          </p>
        </div>
        
        <div className="grid gap-10 md:grid-cols-3 mt-16 relative">
          <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-[var(--line-strong)] to-transparent" />
          
          <div className="text-center relative group">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-white border border-blue-200 text-blue-600 flex items-center justify-center shadow-sm relative z-10">
              <Search size={32} />
            </div>
            <h3 className="font-heading mt-6 text-xl font-bold">{t("home.step1Title")}</h3>
            <p className="mt-3 text-[15px] text-[var(--muted)] max-w-xs mx-auto leading-relaxed">
              {t("home.step1Body")}
            </p>
          </div>

          <div className="text-center relative group">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-white border border-blue-200 text-blue-600 flex items-center justify-center shadow-sm relative z-10">
              <Layers size={32} />
            </div>
            <h3 className="font-heading mt-6 text-xl font-bold">{t("home.step2Title")}</h3>
            <p className="mt-3 text-[15px] text-[var(--muted)] max-w-xs mx-auto leading-relaxed">
              {t("home.step2Body")}
            </p>
          </div>

          <div className="text-center relative group">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-white border border-blue-200 text-blue-600 flex items-center justify-center shadow-sm relative z-10">
              <Bot size={32} />
            </div>
            <h3 className="font-heading mt-6 text-xl font-bold">{t("home.step3Title")}</h3>
            <p className="mt-3 text-[15px] text-[var(--muted)] max-w-xs mx-auto leading-relaxed">
              {t("home.step3Body")}
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- About */}
      <section className="bg-[var(--surface-2)] py-16 md:py-24" id="about">
        <div className="wrap">
          <div className="glass-card overflow-hidden rounded-[24px] border border-[var(--line)] shadow-sm bg-white p-8 md:p-16 text-center max-w-4xl mx-auto fade-up">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-600 mx-auto flex items-center justify-center mb-6">
              <ShieldCheck size={32} />
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold leading-tight text-[var(--ink)]">
              {t("home.aboutTitle")}
            </h2>
            <div className="mt-6 text-[16px] md:text-lg text-[var(--muted)] leading-relaxed space-y-4 max-w-2xl mx-auto">
              <p>{t("home.aboutP1")}</p>
              <p>{t("home.aboutP2")}</p>
              <p>{t("home.aboutP3")}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex-1" />
      <GovFooter />
    </div>
  );
}

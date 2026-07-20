import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search, ShieldCheck, ArrowRight, Bot, Layers, Landmark, MapPin, Grid3X3, ChevronDown
} from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { auth, api } from "../api";
import { useLang } from "../lib/i18n";

const EXPLORE_TABS = [
  { key: "categories", label: "Categories", icon: Grid3X3 },
  { key: "states", label: "States/UTs", icon: MapPin },
  { key: "ministries", label: "Central Ministries", icon: Landmark },
];

// Two rows on desktop; the rest sits behind "View more".
const TILE_PREVIEW_COUNT = 8;

export default function Home() {
  const { t } = useLang();
  const loggedIn = auth.isLoggedIn();
  const location = useLocation();
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState([]);
  const [tab, setTab] = useState("categories");
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");

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

  const centralCount = useMemo(
    () => schemes.filter(s => s.level === "Central").length,
    [schemes]
  );

  // Category → count, biggest first (the myScheme "Explore by category" grid).
  const categoryTiles = useMemo(() => {
    const counts = new Map();
    schemes.forEach(s => {
      const c = s.category || "General";
      counts.set(c, (counts.get(c) || 0) + 1);
    });
    return Array.from(counts, ([name, count]) => ({ name, count, param: "category" }))
      .sort((a, b) => b.count - a.count);
  }, [schemes]);

  // Each state card shows its own schemes plus the central ones it can claim.
  const stateTiles = useMemo(() => {
    const counts = new Map();
    schemes.forEach(s => {
      (s.state_applicable || []).forEach(st => {
        if (st === "ALL") return;
        counts.set(st, (counts.get(st) || 0) + 1);
      });
    });
    return Array.from(counts, ([name, count]) => ({ name, count, param: "state" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [schemes]);

  const ministryTiles = useMemo(() => {
    const counts = new Map();
    schemes.filter(s => s.level === "Central").forEach(s => {
      const m = s.ministry || "Government of India";
      counts.set(m, (counts.get(m) || 0) + 1);
    });
    return Array.from(counts, ([name, count]) => ({ name, count, param: "ministry" }))
      .sort((a, b) => b.count - a.count);
  }, [schemes]);

  const allTiles = tab === "categories" ? categoryTiles : tab === "states" ? stateTiles : ministryTiles;
  const tiles = showAll ? allTiles : allTiles.slice(0, TILE_PREVIEW_COUNT);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/schemes${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] selection:bg-blue-100">
      <GovHeader />

      {/* ------------------------------------------------- Hero / search band */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#eaf3ff] via-[#f4f9ff] to-[#fff6ee] border-b border-[var(--line)]">
        <div className="absolute inset-0 hero-grid opacity-60 pointer-events-none" />
        <div className="wrap relative z-10 py-14 md:py-20 text-center">
          <span className="badge badge-info bg-white/80 border-blue-100 backdrop-blur-sm px-4 py-1.5 shadow-sm">
            <ShieldCheck size={16} /> {t("home.badge")}
          </span>

          <h1 className="font-heading mt-6 text-[2.25rem] md:text-[3.5rem] font-extrabold leading-[1.1] text-[var(--ink)]">
            {t("home.heroKnow")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Haqq</span>.
            <br />
            {t("home.heroRest")}
          </h1>

          <p className="mt-5 text-base md:text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
            {t("home.heroSub")}
          </p>

          {/* Search bar — the front door, same as myScheme's */}
          <form onSubmit={submitSearch} className="mt-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 bg-white rounded-2xl border-2 border-[var(--line-strong)] shadow-lg shadow-blue-900/5 p-2 focus-within:border-blue-500 transition-colors">
              <Search size={20} className="ml-3 text-[var(--muted)] shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Enter scheme name to search..."
                aria-label="Search schemes"
                className="flex-1 bg-transparent py-2.5 text-[15px] font-medium outline-none placeholder:text-[var(--muted)]"
              />
              <button type="submit" className="btn btn-primary rounded-xl px-5 py-2.5 shrink-0">
                Search
              </button>
            </div>
          </form>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to={loggedIn ? "/dashboard" : "/find"}
              className="btn btn-primary btn-lg group shadow-blue-900/10 hover:shadow-blue-900/20"
            >
              {loggedIn ? t("home.ctaDashboard") : t("home.ctaFind")}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#explore" className="btn btn-outline btn-lg bg-white/70 backdrop-blur-sm">
              {t("home.ctaBrowse")}
            </a>
          </div>

          {/* Live counts pulled from the catalog itself */}
          {schemes.length > 0 && (
            <div className="mt-10 flex flex-wrap justify-center gap-8 md:gap-14 text-center">
              {[
                { n: schemes.length, l: t("common.schemes") },
                { n: centralCount, l: "Central Schemes" },
                { n: stateTiles.length, l: "States & UTs" },
                { n: categoryTiles.length, l: "Categories" },
              ].map(x => (
                <div key={x.l}>
                  <div className="font-heading text-2xl md:text-3xl font-extrabold text-[var(--navy)]">{x.n}</div>
                  <div className="text-[13px] font-bold text-[var(--muted)] mt-1">{x.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ Agent introduction */}
      <section className="wrap py-10">
        <div className="glass-card rounded-[24px] p-6 md:p-8 border border-blue-100/60 bg-gradient-to-br from-blue-50/40 to-white max-w-4xl mx-auto fade-up">
          <div className="flex items-center gap-3 text-sm font-bold text-blue-600 mb-4">
            <Bot size={24} /> {t("home.agentName")}
          </div>
          <p className="text-[15px] md:text-base font-medium text-[var(--body)] leading-relaxed">
            {t("home.agentQuote")}
          </p>
        </div>
      </section>

      {/* --------------------------------------------------- Explore schemes */}
      <section className="bg-[var(--surface-2)] border-y border-[var(--line)] py-16 md:py-20" id="explore">
        <div className="wrap">
          <div className="flex flex-wrap justify-center gap-2 fade-up">
            {EXPLORE_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setShowAll(false); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  tab === key
                    ? "bg-[var(--navy)] text-white shadow-md"
                    : "bg-white text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]"
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          <h2 className="font-heading text-3xl md:text-4xl font-bold mt-8 text-center leading-tight">
            Explore schemes of
            <br />
            <span className="text-blue-600">
              {tab === "categories" ? "every category" : tab === "states" ? "States/UTs" : "Central Ministries"}
            </span>
          </h2>
          <p className="text-[var(--muted)] text-center mt-4 max-w-2xl mx-auto leading-relaxed">
            {t("home.catalogSub")}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-10 fade-up" style={{ animationDelay: "120ms" }}>
            {tiles.map(tile => (
              <Link
                key={tile.name}
                to={`/schemes?${tile.param}=${encodeURIComponent(tile.name)}`}
                className="card card-hover bg-white border border-[var(--line)] rounded-[18px] p-5 flex flex-col gap-2 border-l-4 border-l-blue-500 hover:border-l-orange-500 transition-colors"
              >
                <h3 className="font-heading text-[15px] font-bold text-[var(--ink)] leading-snug line-clamp-2">
                  {tile.name}
                </h3>
                <span className="text-[13px] font-bold text-[var(--muted)] mt-auto">
                  <span className="text-blue-600">{tile.count}</span> {tile.count === 1 ? "Scheme" : "Schemes"}
                </span>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10 flex flex-wrap justify-center gap-3">
            {allTiles.length > TILE_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="btn btn-outline bg-white group"
              >
                {showAll ? "Show less" : `View more (${allTiles.length - TILE_PREVIEW_COUNT})`}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${showAll ? "rotate-180" : ""}`}
                />
              </button>
            )}
            <Link to="/schemes" className="btn btn-primary">
              {t("home.viewAll")} {schemes.length} {t("common.schemes")}
              <ArrowRight size={16} />
            </Link>
          </div>
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

          {[
            { Icon: Search, title: t("home.step1Title"), body: t("home.step1Body") },
            { Icon: Layers, title: t("home.step2Title"), body: t("home.step2Body") },
            { Icon: Bot, title: t("home.step3Title"), body: t("home.step3Body") },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="text-center relative group">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-white border border-blue-200 text-blue-600 flex items-center justify-center shadow-sm relative z-10">
                <Icon size={32} />
              </div>
              <h3 className="font-heading mt-6 text-xl font-bold">{title}</h3>
              <p className="mt-3 text-[15px] text-[var(--muted)] max-w-xs mx-auto leading-relaxed">{body}</p>
            </div>
          ))}
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

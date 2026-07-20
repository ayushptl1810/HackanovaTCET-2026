import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, CheckCircle2, Sparkles } from "lucide-react";
import { api, auth } from "../api";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { useLang } from "../lib/i18n";

// Tag vocabularies from the scraped myScheme data, grouped into the facets the
// real portal exposes. A scheme matches a facet when it carries any of its tags.
const TAG_FACETS = {
  gender: {
    Female: ["Women", "Girl Child", "Woman", "Widow", "Mother", "Girl"],
    Male: ["Male", "Boy"],
    Transgender: ["Transgender"],
  },
  caste: {
    "Scheduled Caste": ["Scheduled Caste", "SC"],
    "Scheduled Tribe": ["Scheduled Tribe", "ST"],
    OBC: ["OBC", "Other Backward Class"],
    General: ["General"],
    Minority: ["Minority", "Minorities"],
  },
  beneficiary: {
    Student: ["Student", "Scholarship", "Fellowship", "Education", "Research"],
    "Person With Disability": ["Person With Disability", "PwD", "Differently Abled", "Disability"],
    Farmer: ["Farmer", "Agriculture", "Agricultural Inputs"],
    "Senior Citizen": ["Senior Citizen", "Old Age", "Pension"],
    "Ex-Servicemen": ["Ex-Servicemen", "Widow Of Ex-Servicemen"],
    Entrepreneur: ["Entrepreneur", "Business", "Startup", "Skill", "Skill Development"],
    Worker: ["Worker", "Labour", "Safai Karamcharis", "Manual Scavengers", "Waste Pickers"],
    "Below Poverty Line": ["BPL", "Below Poverty Line"],
  },
  benefitType: {
    "Financial Assistance": ["Financial Assistance", "Cash", "Grant"],
    Scholarship: ["Scholarship", "Fellowship"],
    Pension: ["Pension"],
    Loan: ["Loan", "Credit", "Subsidy"],
    Insurance: ["Insurance", "Accident Insurance", "Health"],
    Training: ["Training", "Skill", "Apprenticeship"],
  },
};

const EMPTY_FILTERS = { state: "", category: "", gender: "", caste: "", beneficiary: "", benefitType: "" };

function matchesFacet(scheme, facet, value) {
  if (!value) return true;
  const wanted = (TAG_FACETS[facet]?.[value] || []).map(x => x.toLowerCase());
  if (!wanted.length) return true;
  const haystack = [...(scheme.tags || []), scheme.category || ""].map(x => String(x).toLowerCase());
  return haystack.some(h => wanted.some(w => h === w || h.includes(w)));
}

export default function SchemeBrowser() {
  const { t } = useLang();
  // The landing page links here with a pre-set facet (?q=, ?category=, ?state=,
  // ?ministry=), so seed the initial state from the URL.
  const [params] = useSearchParams();
  const [schemes, setSchemes] = useState([]);
  const [search, setSearch] = useState(params.get("q") || "");
  const [activeTab, setActiveTab] = useState("all");
  const [recs, setRecs] = useState(null);      // null = not loaded / not logged in
  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    category: params.get("category") || "",
    state: params.get("state") || "",
  });
  const ministry = params.get("ministry") || "";

  useEffect(() => {
    (async () => {
      try {
        const res = await api.publicSchemes();
        setSchemes(res.schemes || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Personalised recommendations: the backend scores every scheme against the
  // citizen's profile and returns them ranked, eligible-first.
  useEffect(() => {
    if (!auth.token()) return;
    (async () => {
      try {
        const res = await api.mySchemes(20);
        setRecs((res.schemes || []).filter(s => s.eligibility !== "not_eligible"));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const displayedSchemes = useMemo(() => {
    return schemes.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filters.category && s.category !== filters.category) return false;
      if (filters.state && !(s.state_applicable || []).includes("ALL") && !(s.state_applicable || []).includes(filters.state)) return false;
      if (ministry && (s.ministry || "Government of India") !== ministry) return false;
      if (activeTab === "state" && s.level !== "State") return false;
      if (activeTab === "central" && s.level !== "Central") return false;
      if (!matchesFacet(s, "gender", filters.gender)) return false;
      if (!matchesFacet(s, "caste", filters.caste)) return false;
      if (!matchesFacet(s, "beneficiary", filters.beneficiary)) return false;
      if (!matchesFacet(s, "benefitType", filters.benefitType)) return false;
      return true;
    });
  }, [schemes, search, filters, activeTab, ministry]);

  const categories = useMemo(() => {
    return Array.from(new Set(schemes.map(s => s.category).filter(Boolean))).sort();
  }, [schemes]);

  const states = useMemo(() => {
    const allStates = new Set();
    schemes.forEach(s => (s.state_applicable || []).forEach(st => allStates.add(st)));
    return Array.from(allStates).filter(s => s !== "ALL").sort();
  }, [schemes]);

  const facetSelect = (key, labelKey) => (
    <div>
      <label className="text-sm font-bold text-[var(--ink)] block mb-2">{t(labelKey)}</label>
      <select
        className="w-full field py-2 text-sm"
        value={filters[key]}
        onChange={e => setFilters({ ...filters, [key]: e.target.value })}
      >
        <option value="">{t("browse.select")}</option>
        {Object.keys(TAG_FACETS[key]).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] selection:bg-blue-100">
      <GovHeader />

      <main className="flex-1 wrap py-8">
        <div className="flex items-center gap-2 mb-6">
          <Link to="/" className="text-blue-600 hover:underline text-sm font-bold flex items-center gap-1">
             &larr; {t("common.back")}
          </Link>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-8">
          
          {/* Sidebar */}
          <aside className="bg-white border border-[var(--line)] rounded-xl p-6 h-max sticky top-24 shadow-sm hidden lg:block">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4 mb-4">
              <h3 className="font-heading font-bold text-[var(--ink)]">{t("browse.filterBy")}</h3>
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs font-bold text-green-700 hover:underline"
              >
                {t("browse.reset")}
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-[var(--ink)] block mb-2">{t("browse.stateUt")}</label>
                <select
                  className="w-full field py-2 text-sm"
                  value={filters.state}
                  onChange={e => setFilters({...filters, state: e.target.value})}
                >
                  <option value="">{t("browse.select")}</option>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-[var(--ink)] block mb-2">{t("browse.category")}</label>
                <select
                  className="w-full field py-2 text-sm"
                  value={filters.category}
                  onChange={e => setFilters({...filters, category: e.target.value})}
                >
                  <option value="">{t("browse.select")}</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {facetSelect("gender", "browse.gender")}
              {facetSelect("caste", "browse.caste")}
              {facetSelect("beneficiary", "browse.beneficiary")}
              {facetSelect("benefitType", "browse.benefitType")}

            </div>
          </aside>

          {/* Main List */}
          <section>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder={t("browse.searchPlaceholder")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full field py-3 pl-10 pr-4 text-[15px] border-gray-300 rounded-full shadow-sm"
              />
            </div>

            {recs && recs.length > 0 && (
              <div className="mb-8 rounded-xl border border-green-600/40 bg-green-50/60 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={18} className="text-green-700" />
                  <h2 className="font-heading font-bold text-[var(--ink)]">{t("browse.forYou")}</h2>
                </div>
                <p className="text-sm text-[var(--muted)] mb-4">{t("browse.forYouDesc")}</p>
                <div className="space-y-3">
                  {recs.slice(0, 5).map(r => (
                    <Link
                      to={`/schemes/${r.scheme_id}`}
                      key={r.scheme_id}
                      className="block bg-white border border-[var(--line)] rounded-lg p-4 hover:border-green-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-[var(--ink)]">{r.name}</h3>
                        <span className={`shrink-0 px-2 py-1 text-xs font-bold rounded-full flex items-center gap-1 ${
                          r.eligibility === "eligible"
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {r.eligibility === "eligible" && <CheckCircle2 size={12} />}
                          {r.eligibility === "eligible" ? t("browse.eligible") : t("browse.needsInfo")}
                        </span>
                      </div>
                      {r.benefit_amount && (
                        <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">{r.benefit_amount}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex border-b border-[var(--line)] mb-6 gap-6">
              <button 
                className={`font-bold pb-2 text-sm ${activeTab === 'all' ? 'border-b-2 border-green-700 text-green-800' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                onClick={() => setActiveTab('all')}
              >{t("browse.tabAll")}</button>
              <button 
                className={`font-bold pb-2 text-sm ${activeTab === 'state' ? 'border-b-2 border-green-700 text-green-800' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                onClick={() => setActiveTab('state')}
              >{t("browse.tabState")}</button>
              <button 
                className={`font-bold pb-2 text-sm ${activeTab === 'central' ? 'border-b-2 border-green-700 text-green-800' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                onClick={() => setActiveTab('central')}
              >{t("browse.tabCentral")}</button>
            </div>

            <p className="text-sm font-bold text-[var(--muted)] mb-6">
              {t("browse.total1")} <span className="text-[var(--ink)]">{displayedSchemes.length}</span> {t("browse.total2")}
            </p>

            <div className="space-y-4">
              {displayedSchemes.map(s => (
                <Link to={`/schemes/${s.scheme_id}`} key={s.scheme_id} className="block card p-6 bg-white border border-[var(--line)] rounded-xl hover:border-green-600 hover:shadow-md transition-all">
                  <h2 className="text-xl font-heading font-bold text-[var(--ink)]">{s.name}</h2>
                  <p className="text-sm text-[var(--muted)] mt-1">{s.ministry || "Government of India"}</p>
                  
                  <p className="mt-4 text-sm text-[var(--ink)] line-clamp-2">
                    {s.benefits?.description || t("browse.defaultDesc")}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {Array.from(new Set([
                      ...(s.tags || []).slice(0, 4),
                      s.category,
                      s.level,
                    ].filter(Boolean))).map(tag => (
                      <span key={tag} className="px-3 py-1 text-xs font-bold text-green-700 border border-green-600 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
            
            {displayedSchemes.length === 0 && (
              <div className="text-center py-20 text-[var(--muted)]">
                {t("browse.noResults")}
              </div>
            )}
          </section>
        </div>
      </main>

      <GovFooter />
    </div>
  );
}

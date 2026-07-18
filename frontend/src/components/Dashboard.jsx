import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Search, Sparkles, FileCheck2, FolderDown, Loader2, ChevronDown, ChevronUp,
  BadgeIndianRupee, ShieldCheck, X, CheckCircle2, CircleAlert,
} from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { api, auth } from "../api";

const verdictBadge = (v) =>
  v === "eligible" ? ["badge-eligible", "Eligible"]
  : v === "not_eligible" ? ["badge-not", "Not eligible"]
  : ["badge-needs", "Needs info"];

function SchemeCard({ s, docs, onApply }) {
  const [open, setOpen] = useState(false);
  const [cls, label] = verdictBadge(s.eligibility);
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--ink)]">{s.name}</h3>
          <div className="mt-1 text-xs text-[var(--muted)]">{s.category}</div>
        </div>
        <span className={`badge ${cls}`}>{label}</span>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)] line-clamp-2">{s.benefit_amount}</p>
      <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted)]">
        <span>Match {Math.round((s.match_score || 0) * 100)}%</span>
        {typeof s.semantic_score === "number" && <span>· Relevance {Math.round(s.semantic_score * 100)}%</span>}
      </div>

      {s.reasons?.length > 0 && (
        <button onClick={() => setOpen(!open)} className="mt-3 text-xs font-medium text-[var(--gov-blue)] flex items-center gap-1">
          Why? {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
      {open && (
        <ul className="mt-2 space-y-1">
          {s.reasons.map((r, i) => (
            <li key={i} className="text-xs flex items-center gap-2">
              {r.outcome === "pass" ? <CheckCircle2 size={13} className="text-[var(--green)]" />
                : r.outcome === "fail" ? <CircleAlert size={13} className="text-red-500" />
                : <CircleAlert size={13} className="text-amber-500" />}
              <span className="text-[var(--muted)]">{r.field} {r.operator} {String(r.value)}</span>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => onApply(s)} disabled={s.eligibility === "not_eligible"}
        className="btn btn-outline w-full mt-4 text-sm">
        <FileCheck2 size={15} /> Apply with my documents
      </button>
    </div>
  );
}

function ApplyModal({ scheme, profile, docs, onClose }) {
  if (!scheme) return null;
  const filled = [
    ["Full name", profile?.name || "—"],
    ["Mobile", auth.user()?.mobile_number || "—"],
    ["Age band", profile?.age_slab || "—"],
    ["Gender", profile?.gender || "—"],
    ["Annual income", profile?.annual_income ? `₹${profile.annual_income}` : (profile?.income_slab || "—")],
    ["Occupation", profile?.occupation || "—"],
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--gov-navy)]">Apply — {scheme.name}</h3>
            <p className="text-sm text-[var(--muted)]">Haqq has pre-filled your application from your profile and documents.</p>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold mb-2">Pre-filled details</h4>
          <div className="grid grid-cols-2 gap-2">
            {filled.map(([k, v]) => (
              <div key={k} className="border border-[var(--border)] rounded-lg px-3 py-2">
                <div className="text-[0.7rem] text-[var(--muted)]">{k}</div>
                <div className="text-sm font-medium">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold mb-2">Documents attached from DigiLocker</h4>
          {docs?.length ? (
            <ul className="space-y-1">
              {docs.map((d) => (
                <li key={d.uri} className="text-sm flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[var(--green)]" /> {d.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">No documents connected yet — connect DigiLocker to auto-attach.</p>
          )}
        </div>

        <button className="btn btn-primary w-full mt-6"
          onClick={() => { toast.success("Application prepared and ready to submit"); onClose(); }}>
          Submit application
        </button>
        <p className="text-[0.7rem] text-[var(--muted)] mt-2 text-center">
          Demo: submission endpoint is not yet connected to a government portal.
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState("eligible"); // eligible | search
  const [docs, setDocs] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [applyScheme, setApplyScheme] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [me, sc] = await Promise.all([api.me(), api.mySchemes()]);
        setProfile(me.profile);
        setSchemes(sc.schemes || []);
      } catch (e) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const runSearch = async () => {
    if (q.trim().length < 2) return;
    setSearching(true); setMode("search");
    try {
      const r = await api.searchSchemes(q.trim());
      setSchemes(r.results || []);
    } catch (e) { toast.error(e.message); }
    finally { setSearching(false); }
  };

  const showEligible = async () => {
    setMode("eligible");
    try { const sc = await api.mySchemes(); setSchemes(sc.schemes || []); }
    catch (e) { toast.error(e.message); }
  };

  const connectDigiLocker = async () => {
    setConnecting(true);
    try {
      const { authorization_url, state } = await api.digilockerLogin();
      // Mock-aware: the mock consent URL carries the code; complete the flow.
      const url = new URL(authorization_url);
      const code = url.searchParams.get("code");
      if (code) {
        const cb = await api.digilockerCallback(code, state || url.searchParams.get("state"));
        setDocs(cb.documents || []);
        toast.success(`Connected — ${cb.documents?.length || 0} documents fetched`);
      } else {
        // Real provider: send the user to DigiLocker for consent.
        window.location.href = authorization_url;
      }
    } catch (e) { toast.error(e.message); }
    finally { setConnecting(false); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <GovHeader />
      <main className="flex-1 container-gov py-8">
        {/* Greeting + profile strip */}
        <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--gov-navy)]">
              Namaste{profile?.name ? `, ${profile.name}` : ""} 🙏
            </h1>
            <p className="text-sm text-[var(--muted)]">Here are the welfare schemes you're entitled to.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {profile && (
              <>
                <span className="badge badge-eligible">Age {profile.age_slab || "—"}</span>
                <span className="badge badge-eligible">{profile.gender || "—"}</span>
                <span className="badge badge-eligible">
                  {profile.annual_income ? `₹${profile.annual_income}/yr` : (profile.income_slab || "—")}
                </span>
                <span className="badge badge-eligible">{profile.occupation || "—"}</span>
              </>
            )}
          </div>
        </div>

        {/* Semantic search */}
        <div className="card p-5 mt-6">
          <label className="text-sm font-semibold flex items-center gap-2 text-[var(--gov-navy)]">
            <Sparkles size={16} /> Describe what help you need — in your own words
          </label>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                className="field pl-9"
                placeholder="e.g. money for my daughter's education, help to learn a skill…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
            <button onClick={runSearch} disabled={searching} className="btn btn-primary">
              {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Search
            </button>
          </div>
          {mode === "search" && (
            <button onClick={showEligible} className="mt-3 text-xs text-[var(--gov-blue)] font-medium">
              ← Back to all my eligible schemes
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          {/* Schemes */}
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[var(--ink)]">
                {mode === "search" ? `Results for "${q}"` : "Your eligible schemes"}
              </h2>
              <span className="text-sm text-[var(--muted)]">{schemes.length} found</span>
            </div>
            {loading ? (
              <div className="card p-10 text-center text-[var(--muted)]"><Loader2 className="animate-spin mx-auto" /></div>
            ) : schemes.length === 0 ? (
              <div className="card p-10 text-center text-[var(--muted)]">No schemes to show yet.</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {schemes.map((s) => (
                  <SchemeCard key={s.scheme_id} s={s} docs={docs} onApply={setApplyScheme} />
                ))}
              </div>
            )}
          </section>

          {/* Sidebar: DigiLocker */}
          <aside className="space-y-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 font-semibold text-[var(--gov-navy)]">
                <FolderDown size={18} /> Your documents
              </div>
              <p className="text-sm text-[var(--muted)] mt-2">
                Connect DigiLocker to auto-fetch your Aadhaar, PAN and certificates for applications.
              </p>
              {docs.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {docs.map((d) => (
                    <li key={d.uri} className="flex items-center gap-2 text-sm border border-[var(--border)] rounded-lg px-3 py-2">
                      <FileCheck2 size={15} className="text-[var(--green)]" />
                      <span className="font-medium">{d.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <button onClick={connectDigiLocker} disabled={connecting} className="btn btn-saffron w-full mt-4">
                  {connecting ? <Loader2 className="animate-spin" size={16} /> : <FolderDown size={16} />}
                  Connect DigiLocker
                </button>
              )}
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 font-semibold text-[var(--gov-navy)]">
                <ShieldCheck size={18} /> Your privacy
              </div>
              <p className="text-sm text-[var(--muted)] mt-2">
                Documents are fetched only with your consent and used solely to check
                eligibility and pre-fill applications, under the DPDP Act, 2023.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <ApplyModal scheme={applyScheme} profile={profile} docs={docs} onClose={() => setApplyScheme(null)} />
      <GovFooter />
    </div>
  );
}

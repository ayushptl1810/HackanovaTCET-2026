import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Search, Sparkles, FileCheck2, FolderDown, Loader2, ChevronDown, ChevronUp,
  ShieldCheck, LayoutGrid, BadgeIndianRupee, ScanFace, Bot, TrendingUp, CircleAlert,
  CheckCircle2,
} from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import FaceGate from "./FaceGate";
import AutofillAgent from "./AutofillAgent";
import { api, auth } from "../api";
import {
  entitlementValue, formatINR, completeness, profileGaps, buildApplicant,
} from "../lib/rights";

const verdictBadge = (v) =>
  v === "eligible" ? ["badge-ok", "Eligible"]
  : v === "not_eligible" ? ["badge-err", "Not eligible"]
  : ["badge-warn", "Needs info"];

function SchemeCard({ s, verified, onApply }) {
  const [open, setOpen] = useState(false);
  const [cls, label] = verdictBadge(s.eligibility);
  const match = Math.round((s.match_score || 0) * 100);
  return (
    <div className="card card-hover p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-[var(--ink)] leading-snug">{s.name}</h3>
          <div className="mt-1 text-xs text-[var(--muted)]">{s.category}</div>
        </div>
        <span className={`badge ${cls} shrink-0`}>{label}</span>
      </div>

      <p className="mt-3 text-sm text-[var(--muted)] line-clamp-2">{s.benefit_amount}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
          <span>Match score</span>
          <span className="font-semibold text-[var(--navy)]">{match}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--navy)]" style={{ width: `${match}%` }} />
        </div>
        {typeof s.semantic_score === "number" && (
          <div className="text-xs text-[var(--muted)] mt-1.5">
            Relevance {Math.round(s.semantic_score * 100)}%
          </div>
        )}
      </div>

      {s.reasons?.length > 0 && (
        <button onClick={() => setOpen(!open)}
          className="mt-3 text-xs font-semibold text-[var(--blue)] flex items-center gap-1 self-start">
          Why do I qualify? {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
      {open && (
        <ul className="mt-2 space-y-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3">
          {s.reasons.map((r, i) => (
            <li key={i} className="text-xs flex items-center gap-2">
              {r.outcome === "pass" ? <CheckCircle2 size={13} className="text-[var(--green)] shrink-0" />
                : r.outcome === "fail" ? <CircleAlert size={13} className="text-[var(--err)] shrink-0" />
                : <CircleAlert size={13} className="text-[var(--warn)] shrink-0" />}
              <span className="text-[var(--body)]">{r.field} {r.operator} {String(r.value)}</span>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => onApply(s)} disabled={s.eligibility === "not_eligible"}
        className="btn btn-primary w-full mt-4 btn-sm">
        <Bot size={15} /> Auto-fill &amp; Apply
      </button>
    </div>
  );
}

/* Know-your-rights summary: total entitlement value + profile completeness + nudges */
function RightsSummary({ schemes, profile, digilocker, onConnect }) {
  const { total, count, ready } = useMemo(() => entitlementValue(schemes), [schemes]);
  const pct = completeness(profile, digilocker);
  const gaps = profileGaps(profile, digilocker);

  return (
    <div className="card p-5 md:p-6 bg-gradient-to-br from-[var(--blue-50)] to-white border-[var(--blue-100)]">
      <div className="flex items-center gap-2 text-[var(--navy)] font-bold">
        <BadgeIndianRupee size={18} /> Your rights, in numbers
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-2xl md:text-3xl font-extrabold text-[var(--ink)] tabular-nums">{formatINR(total)}</div>
          <div className="text-xs text-[var(--muted)] mt-0.5 flex items-center gap-1">
            <TrendingUp size={12} className="text-[var(--green)]" /> potential benefits you may claim
          </div>
        </div>
        <div>
          <div className="text-2xl md:text-3xl font-extrabold text-[var(--green)] tabular-nums">{count}</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">
            schemes matched to you{ready > 0 ? ` · ${ready} ready` : ""}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
          <span>Profile completeness</span>
          <span className="font-semibold text-[var(--navy)]">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white border border-[var(--line)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--saffron)]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-[var(--ink)] mb-1.5">Unlock more of your rights:</div>
          <ul className="space-y-1.5">
            {gaps.slice(0, 3).map((g) => (
              <li key={g.key} className="text-xs flex items-start gap-2">
                <CircleAlert size={13} className="text-[var(--warn)] mt-0.5 shrink-0" />
                <span className="text-[var(--body)]">
                  <button
                    onClick={g.key === "digilocker" ? onConnect : undefined}
                    className={g.key === "digilocker" ? "font-semibold text-[var(--blue)] underline" : "font-semibold"}>
                    {g.label}
                  </button>
                  <span className="text-[var(--muted)]"> — {g.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState("eligible");
  const [docs, setDocs] = useState([]);
  const [digilocker, setDigilocker] = useState(null);   // DigiLocker identity profile
  const [connecting, setConnecting] = useState(false);
  const [verified, setVerified] = useState(false);       // face-verified this session

  // Face gate + autofill agent orchestration
  const [faceGate, setFaceGate] = useState(null);        // { purpose, onPass }
  const [agentScheme, setAgentScheme] = useState(null);

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

  const doDigiLockerConnect = async () => {
    setConnecting(true);
    try {
      const { authorization_url, state } = await api.digilockerLogin();
      const url = new URL(authorization_url);
      const code = url.searchParams.get("code");
      if (code) {
        const cb = await api.digilockerCallback(code, state || url.searchParams.get("state"));
        setDocs(cb.documents || []);
        setDigilocker(cb.profile || null);
        toast.success(`Connected — ${cb.documents?.length || 0} documents fetched`);
      } else {
        window.location.href = authorization_url;
      }
    } catch (e) { toast.error(e.message); }
    finally { setConnecting(false); }
  };

  // DigiLocker fetch is consent-sensitive → require a face liveness check first.
  const connectDigiLocker = () => {
    if (verified) return doDigiLockerConnect();
    setFaceGate({
      purpose: "authorise fetching your documents",
      onPass: () => { setVerified(true); setFaceGate(null); doDigiLockerConnect(); },
    });
  };

  // Apply → face-gate once, then launch the auto-fill agent.
  const applyToScheme = (scheme) => {
    if (verified) { setAgentScheme(scheme); return; }
    setFaceGate({
      purpose: "confirm it's really you before applying",
      onPass: () => { setVerified(true); setFaceGate(null); setAgentScheme(scheme); },
    });
  };

  const applicant = useMemo(
    () => buildApplicant({ profile, user: auth.user(), digilocker, docs }),
    [profile, digilocker, docs]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <GovHeader />
      <main className="flex-1 wrap py-8">
        {/* Greeting + profile strip */}
        <div className="card p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
              Namaste{profile?.name ? `, ${profile.name}` : ""} 🙏
              {verified && <span className="badge badge-ok"><ScanFace size={12} /> Verified</span>}
            </h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              Here are the welfare schemes you're entitled to.
            </p>
          </div>
          {profile && (
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-neutral">Age {profile.age_slab || "—"}</span>
              <span className="badge badge-neutral">{profile.gender || "—"}</span>
              <span className="badge badge-neutral">
                {profile.annual_income ? `₹${profile.annual_income}/yr` : (profile.income_slab || "—")}
              </span>
              <span className="badge badge-neutral">{profile.occupation || "—"}</span>
            </div>
          )}
        </div>

        {/* Semantic search */}
        <div className="card p-5 md:p-6 mt-6">
          <label className="text-sm font-bold flex items-center gap-2 text-[var(--navy)]">
            <Sparkles size={16} /> Describe what help you need — in your own words
          </label>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
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
            <button onClick={showEligible} className="mt-3 text-xs font-semibold text-[var(--blue)]">
              ← Back to all my eligible schemes
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          {/* Schemes */}
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[var(--ink)] flex items-center gap-2">
                <LayoutGrid size={17} className="text-[var(--navy)]" />
                {mode === "search" ? `Results for “${q}”` : "Your eligible schemes"}
              </h2>
              <span className="badge badge-neutral">{schemes.length} found</span>
            </div>
            {loading ? (
              <div className="card p-12 text-center text-[var(--muted)]">
                <Loader2 className="animate-spin mx-auto" />
              </div>
            ) : schemes.length === 0 ? (
              <div className="card p-12 text-center text-[var(--muted)]">No schemes to show yet.</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {schemes.map((s) => (
                  <SchemeCard key={s.scheme_id} s={s} verified={verified} onApply={applyToScheme} />
                ))}
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-6">
            {mode === "eligible" && (
              <RightsSummary schemes={schemes} profile={profile} digilocker={digilocker} onConnect={connectDigiLocker} />
            )}

            <div className="card p-5 md:p-6">
              <div className="flex items-center gap-2 font-bold text-[var(--navy)]">
                <FolderDown size={18} /> Your documents
              </div>
              <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
                Connect DigiLocker to auto-fetch your Aadhaar, PAN and certificates. A quick face check
                protects your consent.
              </p>
              {docs.length > 0 ? (
                <>
                  <ul className="mt-4 space-y-2">
                    {docs.map((d) => (
                      <li key={d.uri}
                        className="flex items-center gap-2 text-sm border border-[var(--line)] bg-[var(--surface-2)] rounded-[var(--radius-sm)] px-3 py-2">
                        <FileCheck2 size={15} className="text-[var(--green)]" />
                        <span className="font-medium text-[var(--ink)]">{d.name}</span>
                      </li>
                    ))}
                  </ul>
                  {digilocker?.name && (
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      Identity: <span className="font-semibold text-[var(--ink)]">{digilocker.name}</span>
                      {digilocker.masked_aadhaar ? ` · Aadhaar ${digilocker.masked_aadhaar}` : ""}
                    </p>
                  )}
                </>
              ) : (
                <button onClick={connectDigiLocker} disabled={connecting} className="btn btn-saffron w-full mt-4">
                  {connecting ? <Loader2 className="animate-spin" size={16} /> : <ScanFace size={16} />}
                  Verify &amp; Connect DigiLocker
                </button>
              )}
            </div>

            <div className="card p-5 md:p-6 bg-[var(--blue-50)] border-[var(--blue-100)]">
              <div className="flex items-center gap-2 font-bold text-[var(--navy)]">
                <ShieldCheck size={18} /> Your privacy
              </div>
              <p className="text-sm text-[var(--body)] mt-2 leading-relaxed">
                The face check runs on your device and no image is stored. Documents are fetched only with
                your consent and used solely to check eligibility and pre-fill applications, under the DPDP Act, 2023.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Face liveness gate */}
      <FaceGate
        open={!!faceGate}
        purpose={faceGate?.purpose}
        onVerified={() => faceGate?.onPass?.()}
        onCancel={() => setFaceGate(null)}
      />

      {/* Auto-fill agent */}
      {agentScheme && (
        <AutofillAgent
          scheme={agentScheme}
          applicant={applicant}
          docs={docs}
          onClose={() => setAgentScheme(null)}
          onSubmitted={() => {
            toast.success("Application prepared — review the highlighted fields and submit.");
            setAgentScheme(null);
          }}
        />
      )}

      <GovFooter />
    </div>
  );
}

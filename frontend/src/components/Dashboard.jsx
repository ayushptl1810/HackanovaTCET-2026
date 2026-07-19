import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Search, Sparkles, FileCheck2, FolderDown, Loader2, ChevronDown, ChevronUp,
  ShieldCheck, LayoutGrid, BadgeIndianRupee, ScanFace, Bot, TrendingUp, CircleAlert,
  CheckCircle2, ClipboardList, Clock, BookOpen, Share2, Users, MessageSquareWarning, HandHeart,
} from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import FaceGate from "./FaceGate";
import AutofillAgent from "./AutofillAgent";
import HelpCentreFinder from "./HelpCentreFinder";
import ExplainModal from "./ExplainModal";
import RelativeCheckModal from "./RelativeCheckModal";
import LifeEvents from "./LifeEvents";
import LanguageSwitcher from "./LanguageSwitcher";
import { api, auth } from "../api";
import {
  entitlementValue, formatINR, completeness, profileGaps, buildApplicant,
  schemeDeadline, shareSchemes,
} from "../lib/rights";
import { useLang } from "../lib/i18n";

const STATUS_STEPS = ["submitted", "under_review", "approved"];
const STATUS_LABEL = {
  submitted: "Submitted", under_review: "Under review", approved: "Approved",
  grievance_raised: "Grievance raised",
};

function ApplicationRow({ app, onGrievance }) {
  const grievance = app.status === "grievance_raised";
  const idx = grievance ? 0 : Math.max(0, STATUS_STEPS.indexOf(app.status));
  return (
    <div className={`border rounded-[16px] p-4 transition-all hover:shadow-md ${grievance ? "border-[var(--warn)]/30 bg-orange-50" : "border-[var(--line)] bg-white hover:border-[var(--line-strong)]"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[15px] text-[var(--ink)] truncate">{app.scheme_name}</span>
        <span className="badge badge-info shrink-0 px-2.5 py-1">{app.ticket_id}</span>
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        {STATUS_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${i <= idx ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-[var(--line-strong)]"}`} />
            {i < STATUS_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 rounded-full transition-colors ${i < idx ? "bg-green-500" : "bg-[var(--line-strong)]"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className={`text-[13px] font-medium flex items-center gap-1.5 ${grievance ? "text-[var(--warn)]" : "text-[var(--muted)]"}`}>
          <Clock size={14} /> {STATUS_LABEL[app.status] || app.status}
        </span>
        {!grievance && (
          <button onClick={() => onGrievance(app)}
            className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-md transition-colors">
            <MessageSquareWarning size={14} /> Raise grievance
          </button>
        )}
      </div>
    </div>
  );
}

const verdictBadge = (v) =>
  v === "eligible" ? ["badge-ok", "Eligible"]
  : v === "not_eligible" ? ["badge-err", "Not eligible"]
  : ["badge-warn", "Needs info"];

function SchemeCard({ s, verified, onApply, onExplain, t }) {
  const [open, setOpen] = useState(false);
  const [cls, label] = verdictBadge(s.eligibility);
  const match = Math.round((s.match_score || 0) * 100);
  const dl = useMemo(() => schemeDeadline(s), [s]);
  const tt = (k, fallback) => (t ? t(k) : fallback);
  return (
    <div className="card card-hover p-5 md:p-6 flex flex-col rounded-[20px] bg-white border-[var(--line)] border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold text-[var(--ink)] leading-snug">{s.name}</h3>
          <div className="mt-1 text-sm font-medium text-[var(--muted)]">{s.category}</div>
        </div>
        <span className={`badge ${cls} shrink-0 px-3 py-1.5 shadow-sm`}>{label}</span>
      </div>

      <div className="mt-3">
        <span className={`badge ${dl.closingSoon ? "badge-err" : "badge-neutral bg-[var(--surface-2)]"}`}>
          <Clock size={12} /> {dl.hasDeadline ? (dl.closingSoon ? `${tt("badge.closingSoon", "Closing soon")} · ${dl.date}` : dl.label) : tt("badge.openAllYear", "Open all year")}
        </span>
      </div>

      <p className="mt-4 text-[15px] font-medium text-[var(--body)] line-clamp-2">{s.benefit_amount}</p>

      <div className="mt-5 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wider">
          <span>Match score</span>
          <span className="text-[var(--navy)]">{match}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--line-strong)]/50 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600" style={{ width: `${match}%` }} />
        </div>
        {typeof s.semantic_score === "number" && (
          <div className="text-[11px] font-medium text-[var(--muted)] mt-2">
            Relevance {Math.round(s.semantic_score * 100)}%
          </div>
        )}
      </div>

      {s.reasons?.length > 0 && (
        <button onClick={() => setOpen(!open)}
          className="mt-4 text-[13px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 self-start transition-colors">
          Why do I qualify? {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      )}
      {open && (
        <ul className="mt-3 space-y-2 rounded-xl bg-blue-50/50 border border-blue-100 p-3.5">
          {s.reasons.map((r, i) => (
            <li key={i} className="text-sm flex items-start gap-2.5">
              {r.outcome === "pass" ? <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                : r.outcome === "fail" ? <CircleAlert size={16} className="text-red-500 shrink-0 mt-0.5" />
                : <CircleAlert size={16} className="text-orange-500 shrink-0 mt-0.5" />}
              <span className="text-[var(--body)] font-medium leading-snug">{r.field} {r.operator} {String(r.value)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-6">
        <button onClick={() => onApply(s)} disabled={s.eligibility === "not_eligible"}
          className="btn btn-primary w-full py-2.5 text-[15px] shadow-blue-900/10">
          <Bot size={18} /> {tt("card.apply", "Auto-fill & Apply")}
        </button>
        <div className="flex gap-2 mt-3">
          <button onClick={() => onExplain(s)} className="btn btn-outline flex-1 py-2 text-[14px]">
            <BookOpen size={16} /> {tt("card.explain", "Explain simply")}
          </button>
          <button onClick={() => shareSchemes([s])} className="btn btn-outline px-4 text-[var(--muted)] hover:text-[var(--navy)]" title={tt("card.share", "Share")}>
            <Share2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Know-your-rights summary: total entitlement value + profile completeness + nudges */
function RightsSummary({ schemes, profile, digilocker, onConnect }) {
  const { total, count, ready } = useMemo(() => entitlementValue(schemes), [schemes]);
  const pct = completeness(profile, digilocker);
  const gaps = profileGaps(profile, digilocker);

  return (
    <div className="glass-card p-6 md:p-8 rounded-[24px] bg-gradient-to-br from-blue-50/90 to-white/90 border border-blue-100/60 shadow-lg shadow-blue-900/5">
      <div className="flex items-center gap-2.5 text-[var(--navy)] font-bold text-lg font-heading">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <BadgeIndianRupee size={18} className="text-blue-600" />
        </div>
        Your rights, in numbers
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <div className="font-heading text-3xl md:text-4xl font-extrabold text-[var(--ink)] tabular-nums tracking-tight">{formatINR(total)}</div>
          <div className="text-[13px] font-medium text-[var(--muted)] mt-1 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-green-500" /> potential benefits
          </div>
        </div>
        <div>
          <div className="font-heading text-3xl md:text-4xl font-extrabold text-green-600 tabular-nums tracking-tight">{count}</div>
          <div className="text-[13px] font-medium text-[var(--muted)] mt-1">
            schemes matched{ready > 0 ? ` · ${ready} ready` : ""}
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 rounded-xl bg-white/60 border border-white backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold text-[var(--muted)] mb-2.5 uppercase tracking-wider">
          <span>Profile completeness</span>
          <span className="text-[var(--navy)]">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-[var(--line)] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 shadow-sm" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="mt-6 border-t border-[var(--line)] pt-6">
          <div className="text-[13px] font-bold text-[var(--ink)] mb-3 uppercase tracking-wider">Unlock more rights:</div>
          <ul className="space-y-2.5">
            {gaps.slice(0, 3).map((g) => (
              <li key={g.key} className="text-sm flex items-start gap-3 bg-white/40 p-3 rounded-lg border border-white/60">
                <CircleAlert size={16} className="text-orange-500 mt-0.5 shrink-0" />
                <span className="text-[var(--body)] font-medium">
                  <button
                    onClick={g.key === "digilocker" ? onConnect : undefined}
                    className={g.key === "digilocker" ? "font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2" : "font-bold text-[var(--ink)]"}>
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
  const { t } = useLang();
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
  const [applications, setApplications] = useState([]);

  // Face gate + autofill agent orchestration
  const [faceGate, setFaceGate] = useState(null);        // { purpose, onPass }
  const [agentScheme, setAgentScheme] = useState(null);
  const [explainScheme, setExplainScheme] = useState(null);
  const [showRelative, setShowRelative] = useState(false);

  const loadApplications = async () => {
    try { const r = await api.listApplications(); setApplications(r.applications || []); }
    catch { /* non-fatal */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const [me, sc] = await Promise.all([api.me(), api.mySchemes()]);
        setProfile(me.profile);
        setSchemes(sc.schemes || []);
      } catch (e) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
    loadApplications();
  }, []);

  const runSearch = async (query) => {
    const term = (typeof query === "string" ? query : q).trim();
    if (term.length < 2) return;
    setQ(term); setSearching(true); setMode("search");
    try {
      const r = await api.searchSchemes(term);
      setSchemes(r.results || []);
    } catch (e) { toast.error(e.message); }
    finally { setSearching(false); }
  };

  const raiseGrievance = async (app) => {
    const msg = window.prompt(`Describe your issue with "${app.scheme_name}" (${app.ticket_id}):`, "");
    if (msg === null) return;
    try {
      const r = await api.raiseGrievance(app.ticket_id, msg || "");
      toast.success(`Grievance registered — ${r.grievance_id}`);
      loadApplications();
    } catch (e) { toast.error(e.message || "Could not raise grievance"); }
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
      <main className="flex-1 wrap pt-4 pb-10">
        {/* Greeting + profile strip */}
        <div className="glass-card p-6 md:p-8 flex flex-wrap items-center justify-between gap-6 rounded-[24px]">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-extrabold flex items-center gap-3">
              <HandHeart size={26} className="text-[var(--saffron)] shrink-0" />
              {t("dash.greeting")}{profile?.name ? `, ${profile.name}` : ""}
              {verified && <span className="badge badge-ok shadow-sm px-3 py-1 bg-green-50"><ScanFace size={14} className="mr-1" /> Verified</span>}
            </h1>
            <p className="text-[15px] font-medium text-[var(--muted)] mt-2">{t("dash.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setShowRelative(true)} className="btn btn-outline bg-white hover:bg-gray-50">
              <Users size={16} /> {t("dash.checkRelative")}
            </button>
            <LanguageSwitcher />
          </div>
        </div>

        {profile && (
          <div className="flex flex-wrap gap-2 mt-5 px-2">
            <span className="badge bg-white border border-[var(--line)] text-[var(--body)] px-3 py-1.5 shadow-sm">Age {profile.age_slab || "—"}</span>
            <span className="badge bg-white border border-[var(--line)] text-[var(--body)] px-3 py-1.5 shadow-sm">{profile.gender || "—"}</span>
            <span className="badge bg-white border border-[var(--line)] text-[var(--body)] px-3 py-1.5 shadow-sm">
              {profile.annual_income ? `₹${profile.annual_income}/yr` : (profile.income_slab || "—")}
            </span>
            <span className="badge bg-white border border-[var(--line)] text-[var(--body)] px-3 py-1.5 shadow-sm">{profile.occupation || "—"}</span>
            {profile.state && <span className="badge bg-white border border-[var(--line)] text-[var(--body)] px-3 py-1.5 shadow-sm">{profile.state}</span>}
          </div>
        )}

        {/* Life-event journeys */}
        {mode === "eligible" && (
          <div className="mt-8">
            <LifeEvents onPick={(query) => runSearch(query)} />
          </div>
        )}

        {/* Semantic search */}
        <div className="card p-6 md:p-8 mt-8 rounded-[24px]">
          <label className="text-[15px] font-bold flex items-center gap-2.5 text-[var(--navy)] mb-4">
            <Sparkles size={18} className="text-orange-500" /> {t("dash.describe")}
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-blue-500 transition-colors" />
              <input
                className="field pl-11 py-3.5 text-[15px] shadow-sm rounded-xl border-gray-200 focus:ring-4 focus:ring-blue-500/10 transition-all"
                placeholder="e.g. money for my daughter's education, help to learn a skill…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
            <button onClick={() => runSearch()} disabled={searching} className="btn btn-primary py-3.5 px-8 text-[15px] rounded-xl shadow-blue-900/10">
              {searching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />} {t("dash.search")}
            </button>
          </div>
          {mode === "search" && (
            <button onClick={showEligible} className="mt-4 text-[13px] font-bold text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1">
              ← Back to all my eligible schemes
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mt-8">
          {/* Schemes */}
          <section className="lg:col-span-2">
            {applications.length > 0 && mode === "eligible" && (
              <div className="card p-6 md:p-8 mb-8 rounded-[24px] bg-gradient-to-b from-white to-gray-50/50">
                <div className="flex items-center gap-2.5 font-heading text-lg font-bold text-[var(--ink)] mb-5">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                    <ClipboardList size={18} className="text-blue-600" />
                  </div>
                  {t("dash.myApplications")}
                  <span className="badge bg-[var(--navy)] text-white ml-auto px-3 py-1 shadow-sm">{applications.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {applications.map((a) => <ApplicationRow key={a.ticket_id} app={a} onGrievance={raiseGrievance} />)}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="font-heading text-xl md:text-2xl font-bold text-[var(--ink)] flex items-center gap-2.5">
                <LayoutGrid size={20} className="text-[var(--navy)]" />
                {mode === "search" ? `Results for “${q}”` : t("dash.eligible")}
              </h2>
              <span className="badge bg-white border border-[var(--line)] shadow-sm px-3 py-1 font-semibold">{schemes.length} found</span>
            </div>
            {loading ? (
              <div className="card p-16 text-center text-[var(--muted)] rounded-[24px]">
                <Loader2 className="animate-spin mx-auto w-8 h-8 text-blue-500" />
              </div>
            ) : schemes.length === 0 ? (
              <div className="card p-16 text-center text-[var(--muted)] font-medium rounded-[24px]">No schemes to show yet.</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-6">
                {schemes.map((s) => (
                  <SchemeCard key={s.scheme_id} s={s} verified={verified} onApply={applyToScheme}
                    onExplain={setExplainScheme} t={t} />
                ))}
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-8">
            {mode === "eligible" && (
              <RightsSummary schemes={schemes} profile={profile} digilocker={digilocker} onConnect={connectDigiLocker} />
            )}

            <div className="card p-6 md:p-8 rounded-[24px]">
              <div className="flex items-center gap-2.5 font-heading text-lg font-bold text-[var(--navy)]">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <FolderDown size={18} className="text-blue-600" />
                </div>
                Your documents
              </div>
              <p className="text-[14px] text-[var(--muted)] font-medium mt-3 leading-relaxed">
                Connect DigiLocker to auto-fetch your Aadhaar, PAN and certificates. A quick face check
                protects your consent.
              </p>
              {docs.length > 0 ? (
                <>
                  <ul className="mt-5 space-y-3">
                    {docs.map((d) => (
                      <li key={d.uri}
                        className="flex items-center gap-3 text-sm border border-[var(--line)] bg-[var(--surface-2)] rounded-xl px-4 py-3 shadow-sm">
                        <FileCheck2 size={18} className="text-green-500" />
                        <span className="font-semibold text-[var(--ink)]">{d.name}</span>
                      </li>
                    ))}
                  </ul>
                  {digilocker?.name && (
                    <div className="mt-5 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">Identity</p>
                      <p className="text-[14px] font-bold text-[var(--ink)]">
                        {digilocker.name}
                        {digilocker.masked_aadhaar && <span className="text-[var(--muted)] font-medium ml-2">· Aadhaar {digilocker.masked_aadhaar}</span>}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <button onClick={connectDigiLocker} disabled={connecting} className="btn btn-saffron w-full mt-5 py-3 shadow-orange-500/20 hover:shadow-orange-500/40">
                  {connecting ? <Loader2 className="animate-spin" size={18} /> : <ScanFace size={18} />}
                  Verify &amp; Connect DigiLocker
                </button>
              )}
            </div>

            <HelpCentreFinder />

            <div className="card p-6 md:p-8 bg-gradient-to-br from-blue-50/50 to-white border border-blue-100 rounded-[24px]">
              <div className="flex items-center gap-2.5 font-heading text-lg font-bold text-[var(--navy)]">
                <ShieldCheck size={18} className="text-blue-600" /> Your privacy
              </div>
              <p className="text-[14px] text-[var(--body)] font-medium mt-3 leading-relaxed">
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
          onSubmitted={async (scheme) => {
            try {
              const mobile = auth.user()?.mobile_number || "";
              const r = await api.createApplication(scheme.scheme_id, scheme.name, mobile);
              const sent = r.notification === "sent";
              toast.success(`Application submitted — ref ${r.application.ticket_id}${sent ? " · SMS sent" : ""}`);
              loadApplications();
            } catch (e) {
              toast.error(e.message || "Could not submit application");
            }
            setAgentScheme(null);
          }}
        />
      )}

      {/* Explain simply */}
      <ExplainModal scheme={explainScheme} onClose={() => setExplainScheme(null)} />

      {/* Check for a family member */}
      {showRelative && <RelativeCheckModal onClose={() => setShowRelative(false)} />}

      <GovFooter />
    </div>
  );
}

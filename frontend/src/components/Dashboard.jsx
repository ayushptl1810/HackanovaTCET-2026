import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Search, Sparkles, FileCheck2, FolderDown, Loader2, ChevronDown, ChevronUp,
  ShieldCheck, LayoutGrid, BadgeIndianRupee, ScanFace, Bot, TrendingUp, CircleAlert,
  CheckCircle2, ClipboardList, Clock, BookOpen, Share2, Users, MessageSquareWarning,
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
    <div className={`border rounded-[var(--radius-sm)] p-3 ${grievance ? "border-[var(--warn)]/50 bg-[var(--warn-bg)]" : "border-[var(--line)]"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-[var(--ink)] truncate">{app.scheme_name}</span>
        <span className="badge badge-info shrink-0">{app.ticket_id}</span>
      </div>
      <div className="mt-2.5 flex items-center gap-1">
        {STATUS_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${i <= idx ? "bg-[var(--green)]" : "bg-[var(--line-strong)]"}`} />
            {i < STATUS_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 ${i < idx ? "bg-[var(--green)]" : "bg-[var(--line-strong)]"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-xs flex items-center gap-1 ${grievance ? "text-[var(--warn)] font-semibold" : "text-[var(--muted)]"}`}>
          <Clock size={11} /> {STATUS_LABEL[app.status] || app.status}
        </span>
        {!grievance && (
          <button onClick={() => onGrievance(app)}
            className="text-xs font-semibold text-[var(--blue)] flex items-center gap-1">
            <MessageSquareWarning size={12} /> Raise grievance
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
    <div className="card card-hover p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-[var(--ink)] leading-snug">{s.name}</h3>
          <div className="mt-1 text-xs text-[var(--muted)]">{s.category}</div>
        </div>
        <span className={`badge ${cls} shrink-0`}>{label}</span>
      </div>

      <div className="mt-2">
        <span className={`badge ${dl.closingSoon ? "badge-err" : "badge-neutral"}`}>
          <Clock size={11} /> {dl.hasDeadline ? (dl.closingSoon ? `${tt("badge.closingSoon", "Closing soon")} · ${dl.date}` : dl.label) : tt("badge.openAllYear", "Open all year")}
        </span>
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
        <Bot size={15} /> {tt("card.apply", "Auto-fill & Apply")}
      </button>
      <div className="flex gap-2 mt-2">
        <button onClick={() => onExplain(s)} className="btn btn-outline btn-sm flex-1">
          <BookOpen size={14} /> {tt("card.explain", "Explain simply")}
        </button>
        <button onClick={() => shareSchemes([s])} className="btn btn-outline btn-sm !px-3" title={tt("card.share", "Share")}>
          <Share2 size={14} />
        </button>
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
      <main className="flex-1 wrap py-8">
        {/* Greeting + profile strip */}
        <div className="card p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
              {t("dash.greeting")}{profile?.name ? `, ${profile.name}` : ""} 🙏
              {verified && <span className="badge badge-ok"><ScanFace size={12} /> Verified</span>}
            </h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">{t("dash.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowRelative(true)} className="btn btn-outline btn-sm">
              <Users size={14} /> {t("dash.checkRelative")}
            </button>
            <LanguageSwitcher />
          </div>
        </div>

        {profile && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="badge badge-neutral">Age {profile.age_slab || "—"}</span>
            <span className="badge badge-neutral">{profile.gender || "—"}</span>
            <span className="badge badge-neutral">
              {profile.annual_income ? `₹${profile.annual_income}/yr` : (profile.income_slab || "—")}
            </span>
            <span className="badge badge-neutral">{profile.occupation || "—"}</span>
            {profile.state && <span className="badge badge-neutral">{profile.state}</span>}
          </div>
        )}

        {/* Life-event journeys */}
        {mode === "eligible" && (
          <div className="mt-6">
            <LifeEvents onPick={(query) => runSearch(query)} />
          </div>
        )}

        {/* Semantic search */}
        <div className="card p-5 md:p-6 mt-6">
          <label className="text-sm font-bold flex items-center gap-2 text-[var(--navy)]">
            <Sparkles size={16} /> {t("dash.describe")}
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
            <button onClick={() => runSearch()} disabled={searching} className="btn btn-primary">
              {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} {t("dash.search")}
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
            {applications.length > 0 && mode === "eligible" && (
              <div className="card p-5 md:p-6 mb-6">
                <div className="flex items-center gap-2 font-bold text-[var(--ink)] mb-3">
                  <ClipboardList size={17} className="text-[var(--navy)]" /> {t("dash.myApplications")}
                  <span className="badge badge-neutral ml-auto">{applications.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {applications.map((a) => <ApplicationRow key={a.ticket_id} app={a} onGrievance={raiseGrievance} />)}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[var(--ink)] flex items-center gap-2">
                <LayoutGrid size={17} className="text-[var(--navy)]" />
                {mode === "search" ? `Results for “${q}”` : t("dash.eligible")}
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
                  <SchemeCard key={s.scheme_id} s={s} verified={verified} onApply={applyToScheme}
                    onExplain={setExplainScheme} t={t} />
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

            <HelpCentreFinder />

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

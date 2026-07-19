import { useState } from "react";
import { X, Users, Loader2, Search, ArrowLeft } from "lucide-react";
import { api } from "../api";

/*
 * RelativeCheckModal — "check for a family member".
 * A citizen enters a relative's age/gender/income/occupation/state and sees
 * the schemes that person is entitled to — no account needed for the relative.
 */
const AGE = [["1", "Below 18"], ["2", "18–35"], ["3", "36–59"], ["4", "60+"]];
const GENDER = [["1", "Male"], ["2", "Female"], ["3", "Other"]];
const INCOME = [["1", "Below ₹2L"], ["2", "₹2L–5L"], ["3", "Above ₹5L"]];
const OCC = [["1", "Student"], ["2", "Farmer"], ["3", "Govt employee"], ["4", "Other"]];
const STATES = ["", "Bihar", "Delhi", "Gujarat", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Rajasthan", "Tamil Nadu", "Uttar Pradesh", "West Bengal"];

const verdictBadge = (v) =>
  v === "eligible" ? ["badge-ok", "Eligible"]
  : v === "not_eligible" ? ["badge-err", "Not eligible"]
  : ["badge-warn", "Needs info"];

export default function RelativeCheckModal({ onClose }) {
  const [f, setF] = useState({ age_slab: "4", gender: "2", income_slab: "1", occupation: "4", state: "", annual_income: 0 });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  const Sel = ({ label, k, opts }) => (
    <label className="block">
      <span className="label text-xs">{label}</span>
      <select className="field mt-1 !py-2" value={f[k]} onChange={set(k)}>
        {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );

  const run = async () => {
    setBusy(true);
    try {
      const r = await api.checkRelative({ ...f, annual_income: Number(f.annual_income) || 0 });
      setResults(r.schemes || []);
    } catch { setResults([]); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--navy)]/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="card shadow-[var(--shadow-lg)] w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col fade-up"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <span className="badge badge-info mb-2"><Users size={12} /> Family check</span>
            <h3 className="text-lg font-bold text-[var(--ink)]">Check for a family member</h3>
            <p className="text-sm text-[var(--muted)] mt-1">
              See what a parent, child or relative is entitled to — no account needed.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm !px-2"><X size={20} /></button>
        </div>

        <div className="px-6 py-4 overflow-y-auto grow">
          {results === null ? (
            <div className="grid grid-cols-2 gap-3">
              <Sel label="Age" k="age_slab" opts={AGE} />
              <Sel label="Gender" k="gender" opts={GENDER} />
              <Sel label="Income band" k="income_slab" opts={INCOME} />
              <Sel label="Occupation" k="occupation" opts={OCC} />
              <label className="block col-span-2">
                <span className="label text-xs">State</span>
                <select className="field mt-1 !py-2" value={f.state} onChange={set("state")}>
                  {STATES.map((s) => <option key={s} value={s}>{s || "Select State"}</option>)}
                </select>
              </label>
            </div>
          ) : (
            <>
              <button onClick={() => setResults(null)} className="text-xs font-semibold text-[var(--blue)] flex items-center gap-1 mb-3">
                <ArrowLeft size={13} /> Change details
              </button>
              {results.length === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-6">No schemes found for these details.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">{results.length} schemes matched</p>
                  {results.map((s) => {
                    const [cls, label] = verdictBadge(s.eligibility);
                    return (
                      <div key={s.scheme_id} className="border border-[var(--line)] rounded-[var(--radius-sm)] p-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-sm text-[var(--ink)]">{s.name}</div>
                          <div className="text-xs text-[var(--muted)]">{s.category}</div>
                        </div>
                        <span className={`badge ${cls} shrink-0`}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {results === null && (
          <div className="px-6 py-4 border-t border-[var(--line)]">
            <button onClick={run} disabled={busy} className="btn btn-primary w-full">
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Check eligibility
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

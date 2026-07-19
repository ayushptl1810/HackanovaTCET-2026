import { useEffect, useRef, useState } from "react";
import {
  X, Bot, Globe, Loader2, CheckCircle2, FileCheck2, Lock, Sparkles,
  MousePointerClick, ShieldCheck, ArrowRight, Clock,
} from "lucide-react";
import { applicationFields, automationStats } from "../lib/rights";

/*
 * AutofillAgent — the "apply for me" agent.
 *
 * Flow the citizen sees:
 *   1. LOCATE   → the agent finds the scheme's official application page
 *                 (simulated portal — real gov portals can't be auto-submitted).
 *   2. FILL     → the agent types each field, sourcing values from the citizen's
 *                 profile + DigiLocker documents. A live meter shows how much
 *                 manual effort is being saved.
 *   3. REVIEW   → fields the agent could NOT fill (e.g. bank account) are flagged
 *                 for the citizen; they review and submit.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => (s || "scheme").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export default function AutofillAgent({ scheme, applicant, docs = [], onClose, onSubmitted }) {
  const fields = useRef(applicationFields(scheme, applicant)).current;
  const stats = useRef(automationStats(fields)).current;
  const portalUrl = `services.india.gov.in/apply/${slug(scheme?.name)}`;

  const [phase, setPhase] = useState("locate");        // locate | fill | review
  const [typed, setTyped] = useState({});               // idx -> current string
  const [activeIdx, setActiveIdx] = useState(-1);
  const [filledCount, setFilledCount] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    (async () => {
      // ---- Phase 1: locate + "navigate" to the portal ----
      await sleep(900);
      if (cancelledRef.current) return;
      setPhase("fill");
      await sleep(500);

      // ---- Phase 2: fill each field ----
      let count = 0;
      for (let i = 0; i < fields.length; i++) {
        if (cancelledRef.current) return;
        setActiveIdx(i);
        const f = fields[i];
        if (!f.auto) { await sleep(450); continue; }          // manual field — skip, leave for citizen
        const val = String(f.value);
        // typing effect
        for (let c = 1; c <= val.length; c++) {
          if (cancelledRef.current) return;
          setTyped((t) => ({ ...t, [i]: val.slice(0, c) }));
          await sleep(Math.max(9, 26 - val.length));           // faster for long values
        }
        count += 1;
        setFilledCount(count);
        await sleep(160);
      }
      setActiveIdx(-1);
      await sleep(300);
      if (cancelledRef.current) return;
      setPhase("review");
    })();
    return () => { cancelledRef.current = true; };
  }, [fields]);

  const minutesSaved = Math.max(1, Math.round(stats.auto * 0.8)); // ~0.8 min/field of manual typing avoided

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--navy)]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}>
      <div className="card shadow-[var(--shadow-lg)] w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col fade-up"
        onClick={(e) => e.stopPropagation()}>

        {/* Agent header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[var(--navy)] text-white flex items-center justify-center shrink-0">
              <Bot size={19} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[var(--ink)] flex items-center gap-2">
                Haqq Apply-Agent
                <span className="badge badge-info"><Sparkles size={12} /> auto-fill</span>
              </div>
              <div className="text-xs text-[var(--muted)] truncate">{scheme?.name}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm !px-2"><X size={20} /></button>
        </div>

        {/* Fake browser address bar (portal redirect) */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white px-3 py-2 text-sm">
            <Lock size={13} className="text-[var(--green)] shrink-0" />
            <Globe size={14} className="text-[var(--muted)] shrink-0" />
            <span className="text-[var(--body)] truncate font-mono text-xs">
              {phase === "locate" ? "locating official application page…" : portalUrl}
            </span>
            {phase === "locate" && <Loader2 size={13} className="animate-spin text-[var(--muted)] ml-auto" />}
            {phase !== "locate" && <span className="badge badge-ok ml-auto shrink-0">connected</span>}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto grow">
          {phase === "locate" ? (
            <div className="py-10 text-center">
              <div className="inline-flex items-center gap-2 text-[var(--navy)] font-semibold">
                <MousePointerClick size={18} className="animate-pulse" />
                Finding the official portal & opening the application form…
              </div>
              <p className="text-sm text-[var(--muted)] mt-2 max-w-md mx-auto">
                The agent matches this scheme to its government application page and prepares to fill it
                using your DigiLocker documents and profile.
              </p>
            </div>
          ) : (
            <>
              {/* live automation meter */}
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] p-4 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-[var(--ink)] flex items-center gap-2">
                    <Sparkles size={15} className="text-[var(--saffron)]" />
                    {phase === "fill" ? "Auto-filling your application…" : "Application auto-filled"}
                  </span>
                  <span className="font-extrabold text-[var(--green)] text-lg tabular-nums">{stats.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white border border-[var(--line)] overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-[var(--green)] transition-[width] duration-300"
                    style={{ width: `${Math.round((filledCount / Math.max(1, stats.auto)) * stats.pct)}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[var(--green)]" /> {filledCount}/{stats.auto} fields auto-filled</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> ~{minutesSaved} min of typing saved</span>
                  <span className="flex items-center gap-1"><FileCheck2 size={12} /> {docs.length} documents attached</span>
                </div>
              </div>

              {/* the form */}
              <div className="grid sm:grid-cols-2 gap-3">
                {fields.map((f, i) => {
                  const value = f.auto ? (typed[i] ?? "") : "";
                  const isActive = activeIdx === i;
                  const isManual = !f.auto;
                  const filled = f.auto && (typed[i]?.length || 0) >= String(f.value).length;
                  return (
                    <div key={i}
                      className={`rounded-[var(--radius-sm)] border p-2.5 transition-colors ${
                        isActive ? "border-[var(--blue)] bg-[var(--blue-50)]"
                        : isManual ? "border-[var(--warn)]/40 bg-[var(--warn-bg)]"
                        : "border-[var(--line)] bg-white"} ${f.label === "Residential address" ? "sm:col-span-2" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[0.7rem] font-semibold text-[var(--muted)]">{f.label}{f.required && <span className="text-[var(--err)]">*</span>}</span>
                        {isManual ? (
                          <span className="badge badge-warn !py-0 !text-[0.6rem]">needs you</span>
                        ) : filled ? (
                          <CheckCircle2 size={13} className="text-[var(--green)]" />
                        ) : isActive ? (
                          <Loader2 size={12} className="animate-spin text-[var(--blue)]" />
                        ) : null}
                      </div>
                      <div className={`mt-1 text-sm min-h-[1.25rem] font-medium ${isManual ? "text-[var(--warn)]" : "text-[var(--ink)]"}`}>
                        {isManual
                          ? (phase === "review" ? "Enter manually" : "—")
                          : <>{value}{isActive && !filled && <span className="inline-block w-[2px] h-[1em] bg-[var(--blue)] align-middle ml-[1px] animate-pulse" />}</>}
                      </div>
                      {f.auto && (value || filled) && (
                        <div className="mt-1 text-[0.62rem] text-[var(--muted)] flex items-center gap-1">
                          <ShieldCheck size={10} className="text-[var(--green)]" /> {f.source}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer / actions */}
        <div className="px-5 py-4 border-t border-[var(--line)] bg-[var(--surface-2)]">
          {phase === "review" ? (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <p className="text-xs text-[var(--muted)] grow text-center sm:text-left">
                <span className="font-bold text-[var(--green)]">{stats.pct}% done for you.</span>{" "}
                Review the <span className="font-semibold text-[var(--warn)]">{stats.manual} highlighted field(s)</span>, then submit.
                <br />Demo: not connected to a live government portal.
              </p>
              <div className="flex gap-2 shrink-0">
                <button onClick={onClose} className="btn btn-outline">Close</button>
                <button className="btn btn-primary"
                  onClick={() => { onSubmitted?.(scheme); }}>
                  <FileCheck2 size={16} /> Review & submit
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[var(--muted)] justify-center">
              <Bot size={14} className="text-[var(--navy)]" />
              The agent is working — sit back. <ArrowRight size={13} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

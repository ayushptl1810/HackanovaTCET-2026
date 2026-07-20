import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Bot, Globe, Loader2, CheckCircle2, FileCheck2, Lock, Sparkles,
  MousePointerClick, ShieldCheck, ArrowRight, Clock, ExternalLink, Download,
  Pencil, RotateCcw, AlertCircle,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { applicationFields, automationStats, docChecklist } from "../lib/rights";
import { useLang } from "../lib/i18n";
import { api } from "../api";

// Palette shared by the PDF section headers / status chips.
const PDF_NAVY = [15, 23, 42];
const PDF_SAFFRON = [249, 115, 22];
const PDF_GREEN = [21, 128, 61];
const PDF_GREEN_BG = [220, 245, 227];
const PDF_BLUE = [29, 78, 216];
const PDF_BLUE_BG = [219, 234, 254];
const PDF_AMBER = [180, 83, 9];
const PDF_AMBER_BG = [254, 243, 199];
const PDF_INK = [30, 30, 30];
const PDF_MUTED = [110, 110, 110];
const PDF_LINE = [225, 225, 230];
const PDF_ROW_ALT = [248, 249, 251];

// jsPDF's built-in fonts only cover WinAnsi (Latin-1) glyphs — a raw ₹ silently
// breaks that character AND the spacing of everything after it on the line.
// Swap it for the ASCII "Rs." instead of trying to embed a Unicode font just
// for this one symbol.
const pdfSafe = (s) => String(s ?? "").replace(/₹/g, "Rs.");

function downloadApplicationPdf(scheme, fields, checklist, verification) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;                     // page margin
  const genDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  let page = 1;

  const drawChrome = () => {
    // top navy band with a saffron accent tick — echoes the app's gov-portal identity
    doc.setFillColor(...PDF_NAVY); doc.rect(0, 0, W, 46, "F");
    doc.setFillColor(...PDF_SAFFRON); doc.rect(0, 46, W, 3, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
    doc.text("Haqq", M, 29);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(226, 232, 240);
    doc.text("Welfare Application Summary", M + 46, 29);
    doc.setFontSize(8.5); doc.setTextColor(203, 213, 225);
    doc.text(`Generated ${genDate}`, W - M, 29, { align: "right" });
  };

  const drawFooter = () => {
    doc.setDrawColor(...PDF_LINE); doc.line(M, H - 44, W - M, H - 44);
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...PDF_MUTED);
    doc.text("Demo document — verify every detail before official submission. Not connected to a live government portal.",
      M, H - 30, { maxWidth: W - 2 * M });
    doc.setFont("helvetica", "normal"); doc.text(`Page ${page}`, W - M, H - 30, { align: "right" });
  };

  drawChrome();
  let y = 76;

  // --- Applicant / scheme summary card -------------------------------------
  const cardH = 58;
  doc.setFillColor(...PDF_ROW_ALT); doc.setDrawColor(...PDF_LINE);
  doc.roundedRect(M, y, W - 2 * M, cardH, 5, 5, "FD");
  const nameField = fields.find((f) => f.key === "fullName");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...PDF_INK);
  doc.text(pdfSafe(nameField?.value || "Applicant"), M + 14, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...PDF_MUTED);
  doc.text(pdfSafe(scheme?.name || ""), M + 14, y + 39, { maxWidth: W - 2 * M - 28 });
  const pct = fields.length ? Math.round((fields.filter((f) => String(f.value || "").trim()).length / fields.length) * 100) : 0;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...PDF_GREEN);
  doc.text(`${pct}% complete`, W - M - 14, y + 22, { align: "right" });
  y += cardH + 22;

  const ensureSpace = (need) => {
    if (y + need > H - 56) { drawFooter(); doc.addPage(); page += 1; drawChrome(); y = 76; }
  };

  const sectionHeader = (title) => {
    ensureSpace(26);
    doc.setFillColor(...PDF_NAVY); doc.rect(M, y, W - 2 * M, 20, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), M + 8, y + 14);
    y += 20 + 10;
  };

  // --- Applicant details table ---------------------------------------------
  sectionHeader("Applicant Details");
  const colField = M + 8, colValue = M + 170, colStatus = W - M - 8;
  const valueWidth = colStatus - colValue - 70;
  const lineH = 12;
  fields.forEach((f, i) => {
    const value = String(f.value || "").trim();
    doc.setFontSize(10);
    const valueLines = doc.splitTextToSize(pdfSafe(value) || "(to be filled by applicant)", valueWidth);
    const rowH = Math.max(24, valueLines.length * lineH + 12);
    ensureSpace(rowH);
    if (i % 2 === 0) { doc.setFillColor(...PDF_ROW_ALT); doc.rect(M, y, W - 2 * M, rowH, "F"); }

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...PDF_MUTED);
    doc.text(pdfSafe(f.label), colField, y + 15, { maxWidth: 150 });

    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.setTextColor(...(value ? PDF_INK : [190, 150, 60]));
    doc.text(valueLines, colValue, y + 15);

    const status = value
      ? (f.edited ? { label: "Edited", fg: PDF_BLUE, bg: PDF_BLUE_BG } : { label: "Auto-filled", fg: PDF_GREEN, bg: PDF_GREEN_BG })
      : { label: "Needed", fg: PDF_AMBER, bg: PDF_AMBER_BG };
    doc.setFontSize(7.5);
    const chipW = doc.getTextWidth(status.label) + 12;
    doc.setFillColor(...status.bg);
    doc.roundedRect(colStatus - chipW, y + 6, chipW, 12, 3, 3, "F");
    doc.setTextColor(...status.fg); doc.setFont("helvetica", "bold");
    doc.text(status.label, colStatus - chipW / 2, y + 14.5, { align: "center" });

    y += rowH;
  });
  y += 12;

  // --- Document checklist ---------------------------------------------------
  sectionHeader("Documents Required");
  const colW = (W - 2 * M - 8) / 2;
  (checklist || []).forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    if (col === 0) ensureSpace(20);
    const cx = M + col * (colW + 8);
    const cy = y + row * 20;
    doc.setDrawColor(...(c.have ? PDF_GREEN : PDF_AMBER));
    doc.setFillColor(...(c.have ? PDF_GREEN : [255, 255, 255]));
    doc.roundedRect(cx, cy, 11, 11, 2, 2, c.have ? "FD" : "D");
    if (c.have) {
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(1.2);
      doc.line(cx + 2.5, cy + 5.5, cx + 4.5, cy + 8); doc.line(cx + 4.5, cy + 8, cx + 8.5, cy + 2.5);
      doc.setLineWidth(0.5);
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...PDF_INK);
    doc.text(pdfSafe(c.label), cx + 17, cy + 9.5, { maxWidth: colW - 20 });
  });
  y += Math.ceil((checklist || []).length / 2) * 20 + 16;

  // --- Verification provenance ----------------------------------------------
  ensureSpace(40);
  doc.setFillColor(...(verification?.verified ? PDF_GREEN_BG : PDF_AMBER_BG));
  doc.roundedRect(M, y, W - 2 * M, 30, 4, 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.setTextColor(...(verification?.verified ? PDF_GREEN : PDF_AMBER));
  const provLine = verification?.verified
    ? `Cross-verified live against ${verification.source_url || "myscheme.gov.in"} on ${genDate}`
    : "Live cross-verification unavailable for this scheme — standard document checklist shown above";
  doc.text(pdfSafe(provLine), M + 10, y + 18, { maxWidth: W - 2 * M - 20 });
  y += 30;

  drawFooter();
  doc.save(`Haqq-Application-${(scheme?.scheme_id || "form")}.pdf`);
}

/*
 * AutofillAgent — the "apply for me" agent.
 *
 * Flow the citizen sees:
 *   1. LOCATE   → the agent finds the scheme's official application page
 *                 (simulated portal — real gov portals can't be auto-submitted).
 *   2. FILL     → the agent types each field, sourcing values from the citizen's
 *                 profile + DigiLocker documents. A live meter shows how much
 *                 manual effort is being saved.
 *   3. REVIEW   → every field becomes editable. Fields the agent could NOT fill
 *                 (e.g. bank account) are flagged; the citizen fills those in and
 *                 can correct anything the agent got wrong before submitting.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => (s || "scheme").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// --- Per-field editing behaviour, keyed by field.key ------------------------
// `sanitize` runs on every keystroke (masks / max lengths); `control` picks the
// input element. Anything not listed here is a plain text input.
const digits = (n) => (v) => v.replace(/\D/g, "").slice(0, n);

const FIELD_UI = {
  mobile:  { inputMode: "numeric", placeholder: "10-digit mobile number", sanitize: digits(10) },
  dob:     { inputMode: "numeric", placeholder: "DD/MM/YYYY",
             sanitize: (v) => {
               const d = v.replace(/\D/g, "").slice(0, 8);
               return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
             } },
  gender:  { control: "select", options: ["Male", "Female", "Other"] },
  // DigiLocker returns Aadhaar masked (XXXX XXXX 1234), so X is a legal char here.
  aadhaar: { inputMode: "numeric", placeholder: "12-digit Aadhaar number",
             sanitize: (v) => v.replace(/[^0-9Xx ]/g, "").toUpperCase().slice(0, 14) },
  pan:     { placeholder: "ABCDE1234F", sanitize: (v) => v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) },
  address: { control: "textarea", placeholder: "House / street, area, city, state, PIN" },
  income:  { inputMode: "numeric", placeholder: "Amount in ₹, e.g. 180000", sanitize: digits(9) },
  bank:    { inputMode: "numeric", placeholder: "Bank account number", sanitize: digits(18) },
  consent: { control: "consent" },
};

const isMasked = (v) => /X{4,}/i.test(v);

// Returns an i18n key for the problem, or null when the value is acceptable.
// Empty values are *not* an error here — "required but empty" is tracked separately.
function fieldError(key, raw) {
  const v = (raw || "").trim();
  if (!v) return null;
  switch (key) {
    case "mobile":
      return /^[6-9]\d{9}$/.test(v) ? null : "agent.err.mobile";
    case "dob": {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
      if (!m) return "agent.err.dob";
      const [d, mo, y] = [+m[1], +m[2], +m[3]];
      const dt = new Date(y, mo - 1, d);
      const real = dt.getDate() === d && dt.getMonth() === mo - 1 && dt.getFullYear() === y;
      return real && y >= 1900 && dt <= new Date() ? null : "agent.err.dob";
    }
    case "aadhaar":
      return isMasked(v) || /^\d{4} ?\d{4} ?\d{4}$/.test(v) ? null : "agent.err.aadhaar";
    case "pan":
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(v) ? null : "agent.err.pan";
    case "income":
      return /^\d{1,9}$/.test(v) ? null : "agent.err.income";
    case "bank":
      return /^\d{9,18}$/.test(v) ? null : "agent.err.bank";
    default:
      return null;
  }
}

export default function AutofillAgent({ scheme, applicant, docs = [], onClose, onSubmitted }) {
  const { t } = useLang();
  const fields = useRef(applicationFields(scheme, applicant)).current;
  const stats = useRef(automationStats(fields)).current;
  // Prefer the scheme's REAL application page; fall back to a readable stand-in.
  const portalUrl = (scheme?.official_portal_url || `https://services.india.gov.in/apply/${slug(scheme?.name)}`)
    .replace(/^https?:\/\//, "");

  const [phase, setPhase] = useState("locate");        // locate | fill | review
  const [values, setValues] = useState({});             // idx -> current string (agent-typed, then user-editable)
  const [edited, setEdited] = useState({});             // idx -> true once the citizen changes it
  const [activeIdx, setActiveIdx] = useState(-1);
  const [filledCount, setFilledCount] = useState(0);
  // Live cross-check against the scheme's myScheme.gov.in page: null while
  // pending, then { verified, documents_required, source_url, fetched_at, reason }.
  const [verification, setVerification] = useState(null);
  const cancelledRef = useRef(false);

  // Requirements checklist — uses the live-verified document list once it
  // lands; falls back to the offline/heuristic list until then (or forever,
  // if the scheme has no myScheme URL or the live check fails).
  const checklist = useMemo(
    () => docChecklist(scheme, docs, verification?.verified ? verification.documents_required : null),
    [scheme, docs, verification]
  );

  useEffect(() => {
    let cancelled = false;
    const schemeId = scheme?.scheme_id;
    if (!schemeId) return;
    api.verifyScheme(schemeId)
      .then((res) => { if (!cancelled) setVerification(res); })
      .catch(() => { if (!cancelled) setVerification({ verified: false, reason: "request_failed" }); });
    return () => { cancelled = true; };
  }, [scheme?.scheme_id]);

  const setField = (i, raw) => {
    const ui = FIELD_UI[fields[i].key] || {};
    const v = ui.sanitize ? ui.sanitize(raw) : raw;
    setValues((prev) => ({ ...prev, [i]: v }));
    setEdited((prev) => (prev[i] ? prev : { ...prev, [i]: true }));
  };

  // Put an agent-filled field back to what DigiLocker/the profile said.
  const resetField = (i) => {
    setValues((prev) => ({ ...prev, [i]: fields[i].value }));
    setEdited((prev) => { const next = { ...prev }; delete next[i]; return next; });
  };

  // Current form contents — what gets exported to PDF and handed to onSubmitted.
  const finalFields = useMemo(
    () => fields.map((f, i) => ({
      ...f,
      value: values[i] ?? "",
      edited: !!edited[i],
      source: edited[i] ? "Edited by applicant" : f.source,
    })),
    [fields, values, edited]
  );

  const errors = useMemo(() => fields.map((f, i) => fieldError(f.key, values[i])), [fields, values]);
  const missingRequired = fields.filter((f, i) => f.required && !String(values[i] ?? "").trim()).length;
  const errorCount = errors.filter(Boolean).length;
  const canSubmit = missingRequired === 0 && errorCount === 0;

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
          setValues((prev) => ({ ...prev, [i]: val.slice(0, c) }));
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
                {t("agent.title")}
                <span className="badge badge-info"><Sparkles size={12} /> {t("agent.autofill")}</span>
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
              {phase === "locate" ? t("agent.locating") : portalUrl}
            </span>
            {phase === "locate" && <Loader2 size={13} className="animate-spin text-[var(--muted)] ml-auto" />}
            {phase !== "locate" && <span className="badge badge-ok ml-auto shrink-0">{t("agent.connected")}</span>}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto grow">
          {phase === "locate" ? (
            <div className="py-10 text-center">
              <div className="inline-flex items-center gap-2 text-[var(--navy)] font-semibold">
                <MousePointerClick size={18} className="animate-pulse" />
                {t("agent.locatingBig")}
              </div>
              <p className="text-sm text-[var(--muted)] mt-2 max-w-md mx-auto">
                {t("agent.locatingHint")}
              </p>
              <div className="inline-flex items-center gap-1.5 mt-4 text-xs text-[var(--muted)]">
                {verification === null
                  ? <><Loader2 size={12} className="animate-spin" /> {t("agent.crossVerifying")}</>
                  : verification.verified
                    ? <><ShieldCheck size={12} className="text-[var(--green)]" /> {t("agent.crossVerified")}</>
                    : <><Clock size={12} /> {t("agent.crossVerifyUnavailable")}</>}
              </div>
            </div>
          ) : (
            <>
              {/* live automation meter */}
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] p-4 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-[var(--ink)] flex items-center gap-2">
                    <Sparkles size={15} className="text-[var(--saffron)]" />
                    {phase === "fill" ? t("agent.autofilling") : t("agent.autofilled")}
                  </span>
                  <span className="font-extrabold text-[var(--green)] text-lg tabular-nums">{stats.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white border border-[var(--line)] overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-[var(--green)] transition-[width] duration-300"
                    style={{ width: `${Math.round((filledCount / Math.max(1, stats.auto)) * stats.pct)}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[var(--green)]" /> {filledCount}/{stats.auto} {t("agent.fieldsAutofilled")}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> ~{minutesSaved} {t("agent.minSaved")}</span>
                  <span className="flex items-center gap-1"><FileCheck2 size={12} /> {docs.length} {t("agent.docsAttached")}</span>
                </div>
              </div>

              {/* document checklist */}
              <div className="rounded-[var(--radius)] border border-[var(--line)] p-4 mb-4">
                <div className="text-sm font-bold text-[var(--ink)] flex items-center gap-2 mb-2.5">
                  <FileCheck2 size={15} className="text-[var(--navy)]" /> {t("agent.docsForScheme")}
                  <span className="badge badge-neutral ml-auto">
                    {checklist.filter((c) => c.have).length}/{checklist.length} {t("agent.ready")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {checklist.map((c) => (
                    <span key={c.slug}
                      className={`badge ${c.have ? "badge-ok" : "badge-warn"}`}>
                      {c.have ? <CheckCircle2 size={12} /> : <Clock size={12} />} {c.label}
                    </span>
                  ))}
                </div>
                {checklist.some((c) => !c.have) && (
                  <p className="text-xs text-[var(--muted)] mt-2.5">
                    {t("agent.missingDocs")}
                  </p>
                )}
                <div className="mt-2.5 pt-2.5 border-t border-[var(--line)] text-[0.68rem] text-[var(--muted)] flex items-center gap-1.5">
                  {verification?.verified ? (
                    <>
                      <ShieldCheck size={11} className="text-[var(--green)] shrink-0" />
                      {t("agent.verifiedAgainst")} <a href={verification.source_url} target="_blank" rel="noopener noreferrer"
                        className="text-[var(--blue)] hover:underline">myscheme.gov.in <ExternalLink size={9} className="inline" /></a>
                    </>
                  ) : verification === null ? (
                    <><Loader2 size={11} className="animate-spin shrink-0" /> {t("agent.crossVerifying")}</>
                  ) : (
                    <><Clock size={11} className="shrink-0" /> {t("agent.usingStandardChecklist")}</>
                  )}
                </div>
              </div>

              {/* everything is editable once the agent finishes */}
              {phase === "review" && (
                <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 mb-2.5">
                  <Pencil size={12} className="text-[var(--navy)] shrink-0" /> {t("agent.editHint")}
                </p>
              )}

              {/* the form */}
              <div className="grid sm:grid-cols-2 gap-3">
                {fields.map((f, i) => (
                  <FieldCard
                    key={f.key}
                    f={f} i={i} t={t}
                    editable={phase === "review"}
                    value={values[i] ?? ""}
                    isActive={activeIdx === i}
                    isEdited={!!edited[i]}
                    error={errors[i]}
                    onChange={setField}
                    onReset={resetField}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer / actions */}
        <div className="px-5 py-4 border-t border-[var(--line)] bg-[var(--surface-2)]">
          {phase === "review" ? (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <p className="text-xs text-[var(--muted)] grow text-center sm:text-left">
                <span className="font-bold text-[var(--green)]">{stats.pct}% {t("agent.doneForYou")}</span>{" "}
                {errorCount > 0
                  ? <span className="font-semibold text-[var(--err)]">{errorCount} {t("agent.fixErrors")}</span>
                  : missingRequired > 0
                    ? <>{t("agent.reviewHighlighted")} <span className="font-semibold text-[var(--warn)]">{missingRequired}</span> {t("agent.highlightedFields")}</>
                    : <span className="font-semibold text-[var(--green)]">{t("agent.allComplete")}</span>}
                <br />{t("agent.demoNote")}
              </p>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button onClick={() => downloadApplicationPdf(scheme, finalFields, checklist, verification)}
                  className="btn btn-outline">
                  <Download size={15} /> PDF
                </button>
                {scheme?.official_portal_url && (
                  <a href={scheme.official_portal_url} target="_blank" rel="noopener noreferrer"
                    className="btn btn-outline">
                    <ExternalLink size={15} /> {t("agent.officialPortal")}
                  </a>
                )}
                <button className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canSubmit}
                  title={canSubmit ? undefined : t("agent.completeFirst")}
                  onClick={() => { onSubmitted?.(scheme, finalFields); }}>
                  <FileCheck2 size={16} /> {t("agent.reviewSubmit")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[var(--muted)] justify-center">
              <Bot size={14} className="text-[var(--navy)]" />
              {t("agent.working")} <ArrowRight size={13} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/*
 * One form field. During the `fill` phase it renders read-only so the typing
 * animation reads cleanly; in `review` it becomes a real input the citizen can
 * correct. Values the citizen edits lose their "verified by DigiLocker" source
 * line — we must not badge a hand-typed value as document-verified.
 */
function FieldCard({ f, i, t, editable, value, isActive, isEdited, error, onChange, onReset }) {
  const ui = FIELD_UI[f.key] || {};
  const empty = !String(value).trim();
  const needsYou = f.required && empty;
  const wide = f.key === "address" || ui.control === "consent";
  const inputId = `agent-field-${f.key}`;

  const border =
    error ? "border-[var(--err)] bg-[var(--err-bg)]"
    : isActive ? "border-[var(--blue)] bg-[var(--blue-50)]"
    : needsYou ? "border-[var(--warn)]/40 bg-[var(--warn-bg)]"
    : "border-[var(--line)] bg-white";

  const controlCls = `field !text-sm !py-1.5 !px-2 mt-1 ${error ? "!border-[var(--err)]" : ""}`;

  return (
    <div className={`rounded-[var(--radius-sm)] border p-2.5 transition-colors ${border} ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-[0.7rem] font-semibold text-[var(--muted)]">
          {f.label}{f.required && <span className="text-[var(--err)]">*</span>}
        </label>
        <span className="flex items-center gap-1.5 shrink-0">
          {isEdited && f.auto && editable && (
            <button type="button" onClick={() => onReset(i)} title={t("agent.resetField")}
              aria-label={t("agent.resetField")}
              className="text-[var(--muted)] hover:text-[var(--navy)] transition-colors">
              <RotateCcw size={12} />
            </button>
          )}
          {needsYou ? (
            <span className="badge badge-warn !py-0 !text-[0.6rem]">{t("agent.needsYou")}</span>
          ) : isEdited ? (
            <span className="badge badge-info !py-0 !text-[0.6rem]"><Pencil size={9} /> {t("agent.edited")}</span>
          ) : isActive && empty ? (
            <Loader2 size={12} className="animate-spin text-[var(--blue)]" />
          ) : !empty ? (
            <CheckCircle2 size={13} className="text-[var(--green)]" />
          ) : null}
        </span>
      </div>

      {!editable ? (
        // agent is still typing — read-only, with a blinking caret on the active field
        <div className={`mt-1 text-sm min-h-[1.25rem] font-medium ${needsYou ? "text-[var(--warn)]" : "text-[var(--ink)]"}`}>
          {empty && !isActive ? "—" : (
            <>{value}{isActive && <span className="inline-block w-[2px] h-[1em] bg-[var(--blue)] align-middle ml-[1px] animate-pulse" />}</>
          )}
        </div>
      ) : ui.control === "consent" ? (
        <label htmlFor={inputId} className="mt-1.5 flex items-start gap-2 text-sm text-[var(--ink)] cursor-pointer">
          <input id={inputId} type="checkbox" className="mt-0.5 accent-[var(--navy)] w-4 h-4 shrink-0"
            checked={!empty}
            onChange={(e) => onChange(i, e.target.checked ? "I agree (DPDP consent)" : "")} />
          <span>{t("agent.consentText")}</span>
        </label>
      ) : ui.control === "select" ? (
        <select id={inputId} className={controlCls} value={value} onChange={(e) => onChange(i, e.target.value)}>
          <option value="">{t("agent.selectOne")}</option>
          {ui.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : ui.control === "textarea" ? (
        <textarea id={inputId} rows={2} className={`${controlCls} resize-y`} value={value}
          placeholder={ui.placeholder} onChange={(e) => onChange(i, e.target.value)} />
      ) : (
        <input id={inputId} type="text" className={controlCls} value={value}
          inputMode={ui.inputMode} placeholder={ui.placeholder}
          onChange={(e) => onChange(i, e.target.value)} />
      )}

      {error && (
        <div className="mt-1 text-[0.65rem] text-[var(--err)] flex items-center gap-1">
          <AlertCircle size={10} className="shrink-0" /> {t(error)}
        </div>
      )}
      {!error && !empty && (
        <div className="mt-1 text-[0.62rem] text-[var(--muted)] flex items-center gap-1">
          {isEdited
            ? <><Pencil size={10} /> {t("agent.editedByYou")}</>
            : f.auto ? <><ShieldCheck size={10} className="text-[var(--green)]" /> {f.source}</> : null}
        </div>
      )}
    </div>
  );
}

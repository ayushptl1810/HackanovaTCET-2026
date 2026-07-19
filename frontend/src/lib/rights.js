// Pure helpers for the "Know your rights" features + the auto-fill agent.
// No React here — just data transforms so they're easy to reason about/test.

// ---------------------------------------------------------------------------
// Benefit-amount parsing
// Scheme benefit strings are messy government prose, e.g.
//   "A Skill loan scheme ... to provide loan upto Rs. 1,50,000 to student ..."
// We pull the largest rupee figure as a rough entitlement estimate.
// ---------------------------------------------------------------------------
export function parseBenefitAmount(text) {
  if (!text || typeof text !== "string") return 0;
  let max = 0;
  // ₹ 1,50,000 / Rs. 150000 / rupees 12000 / 5000/- etc.
  const re = /(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d+)?)|([\d,]{4,})\s*(?:\/-|rupees|rs)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = (m[1] || m[2] || "").replace(/,/g, "");
    const n = parseFloat(raw);
    if (!isNaN(n) && n > max) max = n;
  }
  // "1.5 lakh" / "2 lakhs" / "1 crore"
  const lakh = /([\d.]+)\s*(lakh|lakhs|lac)/i.exec(text);
  if (lakh) max = Math.max(max, parseFloat(lakh[1]) * 100000);
  const crore = /([\d.]+)\s*(crore|cr)/i.exec(text);
  if (crore) max = Math.max(max, parseFloat(crore[1]) * 10000000);
  return Math.round(max);
}

export function formatINR(n) {
  if (!n) return "₹0";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

// Estimated entitlement across the schemes the citizen plausibly qualifies for.
// "Potential" = eligible OR needs-info (anything not explicitly ruled out), since
// needs-info schemes usually clear once a document/detail is supplied. We surface
// both the potential pool and the already-confirmed "ready to apply" count.
export function entitlementValue(schemes = []) {
  const potential = schemes.filter((s) => s.eligibility !== "not_eligible");
  const ready = schemes.filter((s) => s.eligibility === "eligible");
  const total = potential.reduce((sum, s) => sum + parseBenefitAmount(s.benefit_amount), 0);
  return {
    total,
    count: potential.length,      // schemes matched to you
    ready: ready.length,          // confirmed eligible, ready to apply
    valued: potential.filter((s) => parseBenefitAmount(s.benefit_amount) > 0).length,
  };
}

// ---------------------------------------------------------------------------
// Profile completeness — drives "unlock more schemes" nudges
// ---------------------------------------------------------------------------
export function profileGaps(profile, digilocker) {
  const gaps = [];
  if (!profile?.annual_income) gaps.push({ key: "income", label: "Add your exact annual income", why: "Sharpens income-based eligibility" });
  if (!profile?.state) gaps.push({ key: "state", label: "Add your State", why: "Unlocks State-specific schemes" });
  if (!digilocker) gaps.push({ key: "digilocker", label: "Connect DigiLocker", why: "Auto-fetches Aadhaar, PAN & certificates" });
  if (!profile?.name && !digilocker?.name) gaps.push({ key: "name", label: "Verify your name", why: "Required on every application" });
  return gaps;
}

export function completeness(profile, digilocker) {
  const checks = [
    !!(profile?.age_slab),
    !!(profile?.gender),
    !!(profile?.annual_income || profile?.income_slab),
    !!(profile?.occupation),
    !!(profile?.state),
    !!digilocker,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

// ---------------------------------------------------------------------------
// Applicant record — the merged, canonical data the auto-fill agent types into
// a scheme's application form. Merges the citizen profile, the logged-in user,
// and the DigiLocker-fetched identity profile.
// ---------------------------------------------------------------------------
const GENDER_FULL = { M: "Male", F: "Female", O: "Other", male: "Male", female: "Female" };

function dobToDisplay(dob) {
  // DigiLocker mock dob is "DDMMYYYY"
  if (dob && /^\d{8}$/.test(dob)) return `${dob.slice(0, 2)}/${dob.slice(2, 4)}/${dob.slice(4)}`;
  return dob || "";
}

export function buildApplicant({ profile, user, digilocker, docs }) {
  const dl = digilocker || {};
  return {
    fullName: dl.name || profile?.name || "",
    mobile: user?.mobile_number || "",
    dob: dobToDisplay(dl.dob),
    gender: GENDER_FULL[dl.gender] || GENDER_FULL[profile?.gender] || profile?.gender || "",
    aadhaar: dl.masked_aadhaar || "",
    pan: dl.pan_number || "",
    address: dl.address || "",
    annualIncome: profile?.annual_income ? String(profile.annual_income) : "",
    incomeBand: profile?.income_slab || "",
    occupation: profile?.occupation || "",
    ageBand: profile?.age_slab || "",
    documents: (docs || []).map((d) => d.name),
  };
}

// Given a scheme + the applicant record, produce the ordered list of form
// fields the agent will fill. `source` = where each value came from (for the
// "how much was automated" accounting). Fields with no data are left for the
// citizen to complete manually.
export function applicationFields(scheme, applicant) {
  const F = (label, value, source, required = true) => ({ label, value: value || "", source, required, auto: !!value });
  const fields = [
    F("Applicant full name", applicant.fullName, "DigiLocker · Aadhaar"),
    F("Mobile number", applicant.mobile, "Verified login"),
    F("Date of birth", applicant.dob, "DigiLocker · Aadhaar"),
    F("Gender", applicant.gender, "Profile"),
    F("Aadhaar number", applicant.aadhaar, "DigiLocker · Aadhaar"),
    F("PAN number", applicant.pan, "DigiLocker · PAN"),
    F("Residential address", applicant.address, "DigiLocker · Aadhaar"),
    F("Annual family income (₹)", applicant.annualIncome, "Profile"),
    F("Occupation", applicant.occupation, "Profile"),
    F("Scheme applied for", scheme?.name, "Auto"),
    F("Category", scheme?.category, "Auto", false),
    F("Bank account for benefit transfer", "", "Manual", true), // deliberately not auto — citizen must add
    F("Declaration & consent", applicant.fullName ? "I agree (DPDP consent)" : "", "Consent"),
  ];
  return fields;
}

export function automationStats(fields) {
  const total = fields.length;
  const auto = fields.filter((f) => f.auto).length;
  const pct = total ? Math.round((auto / total) * 100) : 0;
  return { total, auto, manual: total - auto, pct };
}

// ---------------------------------------------------------------------------
// Document checklist — what the scheme needs vs what the citizen already has.
// The scraped scheme data only lists `aadhaar_card`, so we enrich with a
// category heuristic to give a realistic, useful list.
// ---------------------------------------------------------------------------
const DOC_LABELS = {
  aadhaar_card: "Aadhaar Card",
  income_certificate: "Income Certificate",
  pan_card: "PAN Card",
  caste_certificate: "Caste / Community Certificate",
  domicile_certificate: "Domicile / Residence Certificate",
  bank_passbook: "Bank Passbook",
  marksheet: "Latest Marksheet",
  disability_certificate: "Disability Certificate",
  ration_card: "Ration Card",
  photo: "Passport-size Photo",
};
const DOC_MATCH = {
  aadhaar_card: ["aadhaar"], income_certificate: ["income"], pan_card: ["pan"],
  caste_certificate: ["caste", "community"], domicile_certificate: ["domicile", "residence"],
  bank_passbook: ["bank", "passbook"], marksheet: ["marksheet", "marks"],
  disability_certificate: ["disab"], ration_card: ["ration"], photo: ["photo"],
};

function heuristicDocs(scheme) {
  const s = ((scheme?.category || "") + " " + (scheme?.name || "") + " " + (scheme?.benefit_amount || "")).toLowerCase();
  const set = new Set(["aadhaar_card"]);
  if (/scholar|degree|education|student|matric|study|marks/.test(s)) { set.add("income_certificate"); set.add("marksheet"); set.add("bank_passbook"); }
  if (/loan|skill|business|entrepreneur|stand.?up|training/.test(s)) { set.add("pan_card"); set.add("bank_passbook"); set.add("income_certificate"); }
  if (/pension|senior|widow|artist|veteran/.test(s)) { set.add("bank_passbook"); set.add("domicile_certificate"); }
  if (/disab/.test(s)) set.add("disability_certificate");
  if (/insurance|health|medical|housing/.test(s)) { set.add("bank_passbook"); set.add("income_certificate"); }
  return set;
}

// ---------------------------------------------------------------------------
// Application window / deadlines.
// The scraped data has no deadlines, so we derive a STABLE illustrative window
// from the scheme id (most central schemes are open year-round; a few show a
// closing date). Deterministic so it doesn't jump around between renders.
// ---------------------------------------------------------------------------
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

export function schemeDeadline(scheme) {
  const h = hashStr(scheme?.scheme_id || scheme?.name || "");
  // ~1 in 3 schemes have a rolling deadline; the rest are open all year.
  if (h % 3 !== 0) return { hasDeadline: false, closingSoon: false, label: "Open all year" };
  const daysLeft = (h % 60) + 3;                     // 3–62 days out
  const date = new Date(Date.now() + daysLeft * 86400000);
  const dateStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return {
    hasDeadline: true,
    daysLeft,
    closingSoon: daysLeft <= 20,
    date: dateStr,
    label: `Apply by ${dateStr}`,
  };
}

// ---------------------------------------------------------------------------
// Share to family — compose a message + open the best available share channel.
// ---------------------------------------------------------------------------
export function shareText(schemes = [], name = "") {
  const eligible = schemes.filter((s) => s.eligibility !== "not_eligible").slice(0, 5);
  const lines = eligible.map((s) => `• ${s.name}`).join("\n");
  return (
    `Haqq — welfare schemes ${name ? name + " " : ""}may be entitled to:\n\n${lines}\n\n` +
    `Check what you're entitled to and apply on the Haqq portal.`
  );
}

export async function shareSchemes(schemes, name) {
  const text = shareText(schemes, name);
  try {
    if (navigator.share) { await navigator.share({ title: "Haqq — your welfare rights", text }); return "shared"; }
  } catch { /* user cancelled — fall through */ return "cancelled"; }
  // Fallback: WhatsApp web/app
  try {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    return "whatsapp";
  } catch {
    try { await navigator.clipboard.writeText(text); return "copied"; } catch { return "failed"; }
  }
}

export function docChecklist(scheme, docs = []) {
  const req = new Set((scheme?.documents_required || []).map((d) => String(d).toLowerCase()));
  heuristicDocs(scheme).forEach((d) => req.add(d));
  const haveNames = (docs || []).map((d) => (d.name || "").toLowerCase());
  return [...req].map((slug) => {
    const kws = DOC_MATCH[slug] || [slug.split("_")[0]];
    const have = haveNames.some((h) => kws.some((k) => h.includes(k)));
    return { slug, label: DOC_LABELS[slug] || slug.replace(/_/g, " "), have };
  }).sort((a, b) => (a.have === b.have ? 0 : a.have ? -1 : 1));
}

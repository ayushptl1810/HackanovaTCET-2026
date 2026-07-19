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

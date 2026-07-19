import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ShieldCheck, Phone, KeyRound, Loader2, Languages, PhoneCall } from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { api, auth } from "../api";

const AGE    = [["1", "Below 18"], ["2", "18–35"], ["3", "36–59"], ["4", "60+"]];
const GENDER = [["1", "Male"], ["2", "Female"], ["3", "Other"]];
const INCOME = [["1", "Below ₹2L"], ["2", "₹2L–5L"], ["3", "Above ₹5L"]];
const OCC    = [["1", "Student"], ["2", "Farmer"], ["3", "Govt employee"], ["4", "Other"]];

export default function Login({ onLoginSuccess }) {
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    mobile_number: "", pin: "", age_slab: "2", gender: "1",
    income_slab: "1", annual_income: "", occupation: "1",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const finish = (res) => {
    auth.save(res.access_token, res.user);
    toast.success("Welcome to Haqq");
    onLoginSuccess?.();
    nav("/dashboard");
  };

  const doLogin = async () => {
    if (!f.mobile_number || !f.pin) return toast.error("Enter mobile number and PIN");
    setBusy(true);
    try { finish(await api.login(f.mobile_number, f.pin)); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const doRegister = async () => {
    if (!f.mobile_number || f.pin.length < 4) return toast.error("Enter mobile and a 4–6 digit PIN");
    setBusy(true);
    try {
      await api.register({
        mobile_number: f.mobile_number, pin: f.pin,
        age_slab: f.age_slab, gender: f.gender, income_slab: f.income_slab,
        annual_income: Number(f.annual_income) || 0, occupation: f.occupation,
      });
      toast.success("Registered — logging you in");
      finish(await api.login(f.mobile_number, f.pin));
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const Select = ({ label, k, opts }) => (
    <label className="block">
      <span className="label">{label}</span>
      <select className="field mt-1.5" value={f[k]} onChange={set(k)}>
        {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <GovHeader />
      <main className="flex-1 wrap py-12 md:py-16 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left: reassurance */}
        <div className="hidden lg:block fade-up">
          <span className="eyebrow">Citizen portal</span>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-2">
            {mode === "login" ? "Sign in to your account" : "Create your Haqq account"}
          </h1>
          <p className="mt-3 text-[var(--muted)] max-w-md leading-relaxed">
            Use your mobile number and PIN to see the welfare schemes you're entitled to
            and apply with your documents — securely and privately.
          </p>
          <ul className="mt-8 space-y-4 max-w-md">
            {[
              "Your PIN is encrypted; your phone number is never stored in the clear.",
              "Documents are fetched only with your explicit consent (DPDP Act, 2023).",
              "No smartphone? The same service works over a phone call.",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-sm text-[var(--body)]">
                <ShieldCheck className="text-[var(--green)] shrink-0 mt-0.5" size={18} /> {t}
              </li>
            ))}
          </ul>

          <div className="mt-8 card p-4 flex items-center gap-3 max-w-md bg-[var(--saffron-50)] border-[#f7dcc4]">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[var(--saffron)] shrink-0">
              <PhoneCall size={18} />
            </div>
            <div className="text-sm">
              <div className="font-semibold text-[var(--ink)]">Prefer to call?</div>
              <div className="text-[var(--muted)]">Dial our toll-free IVR to find schemes by voice.</div>
            </div>
          </div>
        </div>

        {/* Right: form */}
        <div className="w-full max-w-md justify-self-center lg:justify-self-end fade-up">
          <div className="card shadow-[var(--shadow-lg)] p-6 md:p-8">
            <div className="flex items-center gap-2 text-[var(--muted)] text-xs font-semibold mb-5">
              <Languages size={14} /> Available in 22 Indian languages
            </div>

            <div className="flex rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-1 mb-6 border border-[var(--line)]">
              {["login", "register"].map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-[8px] text-sm font-semibold capitalize transition-all ${
                    mode === m ? "bg-white text-[var(--navy)] shadow-sm" : "text-[var(--muted)]"
                  }`}>
                  {m === "login" ? "Login" : "Register"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="label">Mobile number</span>
                <div className="relative mt-1.5">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input className="field pl-9" inputMode="numeric" placeholder="10-digit mobile number"
                    value={f.mobile_number} onChange={set("mobile_number")} />
                </div>
              </label>
              <label className="block">
                <span className="label">PIN</span>
                <div className="relative mt-1.5">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input className="field pl-9" type="password" inputMode="numeric" placeholder="4–6 digit PIN"
                    value={f.pin} onChange={set("pin")} />
                </div>
              </label>

              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Select label="Age" k="age_slab" opts={AGE} />
                  <Select label="Gender" k="gender" opts={GENDER} />
                  <Select label="Income band" k="income_slab" opts={INCOME} />
                  <Select label="Occupation" k="occupation" opts={OCC} />
                  <label className="block col-span-2">
                    <span className="label">Exact annual income (₹, optional)</span>
                    <input className="field mt-1.5" inputMode="numeric" placeholder="e.g. 120000"
                      value={f.annual_income} onChange={set("annual_income")} />
                    <span className="text-xs text-[var(--muted)] mt-1 block">
                      Giving an exact figure makes your eligibility results more precise.
                    </span>
                  </label>
                </div>
              )}

              <button
                onClick={mode === "login" ? doLogin : doRegister}
                disabled={busy}
                className="btn btn-primary w-full btn-lg mt-1">
                {busy && <Loader2 className="animate-spin" size={18} />}
                {mode === "login" ? "Login" : "Register & continue"}
              </button>

              <p className="text-xs text-[var(--muted)] text-center pt-1">
                By continuing you agree to Haqq processing your data with consent under the DPDP Act, 2023.
              </p>
            </div>
          </div>
        </div>
      </main>
      <GovFooter />
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ShieldCheck, Phone, KeyRound, Loader2 } from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { api, auth } from "../api";

const AGE = [["1", "Below 18"], ["2", "18–35"], ["3", "36–59"], ["4", "60+"]];
const GENDER = [["1", "Male"], ["2", "Female"], ["3", "Other"]];
const INCOME = [["1", "Below ₹2L"], ["2", "₹2L–5L"], ["3", "Above ₹5L"]];
const OCC = [["1", "Student"], ["2", "Farmer"], ["3", "Govt employee"], ["4", "Other"]];

export default function Login({ onLoginSuccess }) {
  const nav = useNavigate();
  const [mode, setMode] = useState("login"); // login | register
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
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      <select className="field mt-1" value={f[k]} onChange={set(k)}>
        {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <GovHeader />
      <main className="flex-1 container-gov py-12 grid md:grid-cols-2 gap-10 items-start">
        {/* Left: reassurance */}
        <div className="hidden md:block">
          <h1 className="text-3xl font-extrabold text-[var(--gov-navy)]">
            {mode === "login" ? "Citizen Login" : "Create your Haqq account"}
          </h1>
          <p className="mt-3 text-[var(--muted)] max-w-md">
            Sign in with your mobile number and PIN to see the welfare schemes you're
            entitled to and apply with your documents.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-2"><ShieldCheck className="text-[var(--green)] shrink-0" size={18} /> Your PIN is encrypted; your phone number is never stored in the clear.</li>
            <li className="flex gap-2"><ShieldCheck className="text-[var(--green)] shrink-0" size={18} /> Documents are fetched only with your explicit consent (DPDP Act, 2023).</li>
            <li className="flex gap-2"><ShieldCheck className="text-[var(--green)] shrink-0" size={18} /> No smartphone? The same service works over a phone call.</li>
          </ul>
        </div>

        {/* Right: form */}
        <div className="card p-6 md:p-7 w-full max-w-md justify-self-center md:justify-self-end">
          <div className="flex rounded-lg bg-[#eef3fb] p-1 mb-6">
            {["login", "register"].map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-semibold capitalize ${
                  mode === m ? "bg-white text-[var(--gov-navy)] shadow-sm" : "text-[var(--muted)]"
                }`}>
                {m === "login" ? "Login" : "Register"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Mobile number</span>
              <div className="relative mt-1">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input className="field pl-9" inputMode="numeric" placeholder="10-digit mobile"
                  value={f.mobile_number} onChange={set("mobile_number")} />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium">PIN</span>
              <div className="relative mt-1">
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
                  <span className="text-sm font-medium">Exact annual income (₹, optional)</span>
                  <input className="field mt-1" inputMode="numeric" placeholder="e.g. 120000"
                    value={f.annual_income} onChange={set("annual_income")} />
                  <span className="text-xs text-[var(--muted)]">Giving an exact figure makes your eligibility results precise.</span>
                </label>
              </div>
            )}

            <button
              onClick={mode === "login" ? doLogin : doRegister}
              disabled={busy}
              className="btn btn-primary w-full text-base mt-2">
              {busy ? <Loader2 className="animate-spin" size={18} /> : null}
              {mode === "login" ? "Login" : "Register & continue"}
            </button>
          </div>
        </div>
      </main>
      <GovFooter />
    </div>
  );
}

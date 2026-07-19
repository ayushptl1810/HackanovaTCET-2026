import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ShieldCheck, Phone, KeyRound, Loader2, Languages, PhoneCall, Sparkles } from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { api, auth } from "../api";

const AGE    = [["1", "Below 18"], ["2", "18–35"], ["3", "36–59"], ["4", "60+"]];
const GENDER = [["1", "Male"], ["2", "Female"], ["3", "Other"]];
const INCOME = [["1", "Below ₹2L"], ["2", "₹2L–5L"], ["3", "Above ₹5L"]];
const OCC    = [["1", "Student"], ["2", "Farmer"], ["3", "Govt employee"], ["4", "Other"]];
const STATES = [
  "", "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
].map((s) => [s, s || "Select State"]);

export default function Login({ onLoginSuccess }) {
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    mobile_number: "", pin: "", age_slab: "2", gender: "1",
    income_slab: "1", annual_income: "", occupation: "1", state: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const finish = (res) => {
    auth.save(res.access_token, res.user);
    toast.success("Welcome to Haqq");
    onLoginSuccess?.();
    nav("/dashboard");
  };

  const doLogin = async () => {
    if (!/^\d{10}$/.test(f.mobile_number)) return toast.error("Enter a valid 10-digit mobile number");
    if (f.pin.length < 4 || f.pin.length > 6) return toast.error("PIN must be 4–6 digits");
    setBusy(true);
    try { finish(await api.demoLogin()); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const doRegister = async () => {
    if (!/^\d{10}$/.test(f.mobile_number)) return toast.error("Enter a valid 10-digit mobile number");
    if (f.pin.length < 4 || f.pin.length > 6) return toast.error("PIN must be 4–6 digits");
    setBusy(true);
    try {
      await api.register({
        mobile_number: f.mobile_number, pin: f.pin,
        age_slab: f.age_slab, gender: f.gender, income_slab: f.income_slab,
        annual_income: Number(f.annual_income) || 0, occupation: f.occupation,
        state: f.state,
      });
      toast.success("Registered — logging you in");
      finish(await api.login(f.mobile_number, f.pin));
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const Select = ({ label, k, opts }) => (
    <label className="block">
      <span className="label text-[13px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1.5">{label}</span>
      <select className="field rounded-xl shadow-sm border-gray-200 focus:ring-4 focus:ring-blue-500/10 text-[14px]" value={f[k]} onChange={set(k)}>
        {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white selection:bg-blue-100">
      <GovHeader />

      <main className="flex-1 flex flex-col lg:flex-row relative z-10 w-full">
        {/* Left: Beautiful visual section (Split screen) */}
        <div className="hidden lg:flex flex-col relative w-[45%] xl:w-1/2 p-12 overflow-hidden justify-between text-white">
          <div className="absolute inset-0 z-0">
            <img src="/login-bg.png" alt="Indian Citizen Welfare" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent"></div>
          </div>
          
          <div className="relative z-10 fade-up">
            <span className="eyebrow bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white border border-white/30 shadow-sm">
              Citizen portal
            </span>
          </div>

          <div className="relative z-10 mt-auto fade-up" style={{ animationDelay: '100ms' }}>
            <h1 className="font-heading text-4xl xl:text-5xl font-extrabold leading-tight mb-4">
              Your Right to Welfare.
            </h1>
            <p className="text-[17px] text-white/90 max-w-md leading-relaxed font-medium mb-8">
              Access the welfare schemes you're entitled to with absolute privacy and security.
            </p>
            
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 text-[15px] font-medium text-white/90 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-sm max-w-md">
                <ShieldCheck className="text-green-400 shrink-0 mt-0.5" size={20} /> 
                Encrypted PIN — your phone number is never stored in the clear.
              </div>
              <div className="flex gap-4 text-[15px] font-medium text-white/90 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-sm max-w-md">
                <ShieldCheck className="text-green-400 shrink-0 mt-0.5" size={20} /> 
                Documents are fetched only with your explicit consent (DPDP Act).
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/20 flex items-center gap-4 max-w-md">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/20 backdrop-blur-sm">
                <PhoneCall size={20} />
              </div>
              <div>
                <div className="font-heading font-bold text-white text-[16px]">Prefer to call?</div>
                <div className="text-[14px] text-white/70 font-medium mt-0.5">Dial our toll-free IVR to find schemes by voice.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: form (centered) */}
        <div className="w-full lg:w-[55%] xl:w-1/2 flex items-center justify-center p-6 lg:p-12 xl:p-20 bg-gray-50/50">
          <div className="w-full max-w-[440px] fade-up" style={{ animationDelay: '150ms' }}>
            <div className="mb-8 text-center lg:text-left">
              <h2 className="font-heading text-3xl md:text-4xl font-extrabold text-[var(--ink)] mb-3">
                {mode === "login" ? "Sign in" : "Create account"}
              </h2>
              <p className="text-[var(--muted)] font-medium text-[16px]">
                {mode === "login" ? "Welcome back! Please enter your details." : "Join Haqq to claim your entitlements."}
              </p>
            </div>

            <div className="glass-card rounded-[24px] p-6 md:p-8 shadow-xl shadow-blue-900/5 bg-white border border-gray-100">
              <div className="flex items-center justify-center gap-2 text-[var(--navy)] text-[13px] font-bold mb-8 bg-blue-50 py-2 rounded-xl border border-blue-100/50">
                <Languages size={16} className="text-blue-600" /> Available in 22 Indian languages
              </div>

              <div className="flex rounded-xl bg-gray-100/80 p-1.5 mb-8 border border-white/50 shadow-inner">
                {["login", "register"].map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-3 rounded-lg text-[14px] font-bold capitalize transition-all duration-300 ${
                      mode === m ? "bg-white text-[var(--navy)] shadow-sm scale-[1.02]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}>
                    {m === "login" ? "Login" : "Register"}
                  </button>
                ))}
              </div>
              
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    finish(await api.demoLogin());   // seeds & signs in as Ayush Patel
                  } catch (e) {
                    import("react-hot-toast").then((m) => m.default.error("Demo login failed"));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="btn w-full py-3 mb-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-[15px] shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.01] transition-all">
                <Sparkles size={18} className="mr-2" /> Sign In (Demo - Ayush Patel)
              </button>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px bg-gray-200 flex-1"></div>
                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">OR</div>
                <div className="h-px bg-gray-200 flex-1"></div>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="label text-[13px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1.5">Mobile number</span>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input className="field pl-12 py-3.5 text-[15px] rounded-xl shadow-sm border-gray-200 focus:ring-4 focus:ring-blue-500/10 transition-all bg-gray-50/50 focus:bg-white" inputMode="numeric" placeholder="10-digit mobile number" maxLength={10} pattern="[0-9]*"
                      value={f.mobile_number} onChange={e => { if (/^\d*$/.test(e.target.value)) setF({...f, mobile_number: e.target.value}); }} />
                  </div>
                </label>
                <label className="block">
                  <span className="label text-[13px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1.5">PIN</span>
                  <div className="relative">
                    <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input className="field pl-12 py-3.5 text-[15px] rounded-xl shadow-sm border-gray-200 focus:ring-4 focus:ring-blue-500/10 transition-all bg-gray-50/50 focus:bg-white" type="password" inputMode="numeric" placeholder="4–6 digit PIN" maxLength={6}
                      value={f.pin} onChange={e => { if (/^\d*$/.test(e.target.value)) setF({...f, pin: e.target.value}); }} />
                  </div>
                </label>

                {mode === "register" && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Select label="Age" k="age_slab" opts={AGE} />
                    <Select label="Gender" k="gender" opts={GENDER} />
                    <Select label="Income band" k="income_slab" opts={INCOME} />
                    <Select label="Occupation" k="occupation" opts={OCC} />
                    <label className="block col-span-2">
                      <span className="label text-[13px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1.5">State</span>
                      <select className="field rounded-xl shadow-sm border-gray-200 focus:ring-4 focus:ring-blue-500/10 text-[14px] bg-gray-50/50 focus:bg-white" value={f.state} onChange={set("state")}>
                        {STATES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                      </select>
                      <span className="text-xs font-medium text-[var(--muted)] mt-1.5 block">
                        Unlocks State-specific welfare schemes.
                      </span>
                    </label>
                    <label className="block col-span-2">
                      <span className="label text-[13px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1.5">Exact annual income (₹, optional)</span>
                      <input className="field py-3 rounded-xl shadow-sm border-gray-200 focus:ring-4 focus:ring-blue-500/10 text-[14px] bg-gray-50/50 focus:bg-white" inputMode="numeric" placeholder="e.g. 120000"
                        value={f.annual_income} onChange={set("annual_income")} />
                    </label>
                  </div>
                )}

                <button
                  onClick={mode === "login" ? doLogin : doRegister}
                  disabled={busy}
                  className="btn btn-primary w-full py-4 text-[16px] mt-2 shadow-blue-900/10 hover:shadow-blue-900/20 transition-all hover:scale-[1.01]">
                  {busy ? <Loader2 className="animate-spin mx-auto" size={20} /> : (mode === "login" ? "Sign In" : "Register & Continue")}
                </button>

                <p className="text-[12px] font-medium text-[var(--muted)] text-center pt-4 px-2 leading-relaxed">
                  By continuing you agree to Haqq processing your data with consent under the <span className="underline cursor-pointer hover:text-[var(--navy)]">DPDP Act, 2023</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <GovFooter />
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api";
import { ArrowRight, ArrowLeft, CheckCircle2, User, MapPin, Briefcase, IndianRupee } from "lucide-react";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { useLang } from "../lib/i18n";

export default function SchemeWizard() {
  const { t } = useLang();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  
  const [profile, setProfile] = useState({
    gender: "",
    age_slab: "",
    state: "",
    occupation: "",
    income_slab: ""
  });

  const next = () => setStep(s => s + 1);
  const prev = () => setStep(s => Math.max(1, s - 1));

  const update = (key, val) => setProfile(p => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const payload = { ...profile, annual_income: 0 };
      const res = await api.checkSchemes(payload);
      // We pass the results to a new route /results to show them
      nav("/results", { state: { results: res.schemes, profile: payload } });
    } catch (e) {
      console.error(e);
      toast.error(e.message || t("wiz.error"));
      setBusy(false);   // stay on the form so the user can retry
    }
  };

  const isStepValid = () => {
    if (step === 1) return profile.gender && profile.age_slab;
    if (step === 2) return profile.state !== "";
    if (step === 3) return profile.occupation !== "";
    if (step === 4) return profile.income_slab !== "";
    return true;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-2)] selection:bg-blue-100">
      <GovHeader />
      
      <main className="flex-1 flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-xl glass-card rounded-[24px] p-6 md:p-10 border border-[var(--line)] shadow-sm bg-white fade-up">
          
          {/* Progress Bar */}
          <div className="flex gap-2 mb-10">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-blue-600' : 'bg-gray-100'}`} />
            ))}
          </div>

          <div className="min-h-[250px]">
            {step === 1 && (
              <div className="fade-up">
                <div className="flex items-center gap-3 text-blue-600 mb-6">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><User size={20} /></div>
                  <h2 className="font-heading text-2xl font-bold text-[var(--ink)]">{t("wiz.aboutYou")}</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-[var(--ink)] mb-2">{t("wiz.selectGender")}</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[{id: "1", label: t("opt.gender.male")}, {id: "2", label: t("opt.gender.female")}, {id: "3", label: t("opt.gender.other")}].map(g => (
                        <button key={g.id} onClick={() => update("gender", g.id)}
                          className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all ${profile.gender === g.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-blue-300'}`}>
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[var(--ink)] mb-2">{t("wiz.selectAge")}</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[{id: "1", label: t("opt.age.below18")}, {id: "2", label: t("opt.age.18_35")}, {id: "3", label: t("opt.age.36_59")}, {id: "4", label: t("opt.age.60plus")}].map(a => (
                        <button key={a.id} onClick={() => update("age_slab", a.id)}
                          className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all ${profile.age_slab === a.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-blue-300'}`}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="fade-up">
                <div className="flex items-center gap-3 text-blue-600 mb-6">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><MapPin size={20} /></div>
                  <h2 className="font-heading text-2xl font-bold text-[var(--ink)]">{t("wiz.whereLive")}</h2>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[var(--ink)] mb-2">{t("wiz.selectState")}</label>
                  <select
                    value={profile.state}
                    onChange={e => update("state", e.target.value)}
                    className="w-full field py-3 bg-white"
                  >
                    <option value="" disabled>{t("login.selectState")}</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Other">Other State</option>
                  </select>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="fade-up">
                <div className="flex items-center gap-3 text-blue-600 mb-6">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><Briefcase size={20} /></div>
                  <h2 className="font-heading text-2xl font-bold text-[var(--ink)]">{t("wiz.occupationQ")}</h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {id: "1", label: t("opt.occ.student")},
                    {id: "2", label: t("opt.occ.farmer")},
                    {id: "3", label: t("wiz.govtEmployee")},
                    {id: "4", label: t("wiz.otherUnemployed")}
                  ].map(o => (
                    <button key={o.id} onClick={() => update("occupation", o.id)}
                      className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all ${profile.occupation === o.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-blue-300'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="fade-up">
                <div className="flex items-center gap-3 text-blue-600 mb-6">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><IndianRupee size={20} /></div>
                  <h2 className="font-heading text-2xl font-bold text-[var(--ink)]">{t("wiz.incomeQ")}</h2>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    {id: "1", label: t("wiz.incLow")},
                    {id: "2", label: t("wiz.incMid")},
                    {id: "3", label: t("wiz.incHigh")}
                  ].map(i => (
                    <button key={i.id} onClick={() => update("income_slab", i.id)}
                      className={`py-4 px-4 rounded-xl border text-sm font-bold transition-all text-left ${profile.income_slab === i.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-blue-300'}`}>
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-10 flex items-center justify-between pt-6 border-t border-[var(--line)]">
            <button 
              onClick={prev} 
              disabled={step === 1}
              className={`flex items-center gap-2 font-bold text-sm ${step === 1 ? 'text-gray-300' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
            >
              <ArrowLeft size={16} /> {t("common.back")}
            </button>

            {step < 4 ? (
              <button
                onClick={next}
                disabled={!isStepValid()}
                className="btn btn-primary px-6 disabled:opacity-50"
              >
                {t("common.next")} <ArrowRight size={16} className="ml-1" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!isStepValid() || busy}
                className="btn btn-primary px-6 disabled:opacity-50 bg-gradient-to-r from-orange-500 to-orange-600 border-none hover:opacity-90"
              >
                {busy ? t("wiz.finding") : t("wiz.findSchemes")} <CheckCircle2 size={16} className="ml-1" />
              </button>
            )}
          </div>

        </div>
      </main>

      <GovFooter />
    </div>
  );
}

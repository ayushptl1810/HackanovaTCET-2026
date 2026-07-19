import { useState } from "react";
import { MapPin, Loader2, Phone, Building2, Search } from "lucide-react";
import { api } from "../api";

/*
 * HelpCentreFinder — "find help near me".
 * A citizen who can't self-serve online enters their pincode and sees their
 * district/state, nearby government service points, and the CSC helpline so
 * they can get in-person help applying.
 */
export default function HelpCentreFinder() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");

  const find = async () => {
    if (!/^\d{6}$/.test(pin)) { setErr("Enter a 6-digit pincode"); return; }
    setBusy(true); setErr(""); setRes(null);
    try { setRes(await api.locate(pin)); }
    catch (e) { setErr(e.message || "Lookup failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center gap-2 font-bold text-[var(--navy)]">
        <MapPin size={18} /> Find help near me
      </div>
      <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
        Enter your pincode to find nearby government service points and get in-person help applying.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          className="field" inputMode="numeric" maxLength={6} placeholder="6-digit pincode"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && find()}
        />
        <button onClick={find} disabled={busy} className="btn btn-primary shrink-0">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
        </button>
      </div>

      {err && <p className="text-xs text-[var(--err)] mt-2">{err}</p>}

      {res && (
        <div className="mt-4 fade-up">
          <div className="text-sm font-semibold text-[var(--ink)]">
            {res.district}, {res.state}
          </div>
          <ul className="mt-2 space-y-1.5">
            {res.centres.map((c, i) => (
              <li key={i}
                className="flex items-start gap-2 text-sm border border-[var(--line)] bg-[var(--surface-2)] rounded-[var(--radius-sm)] px-3 py-2">
                <Building2 size={14} className="text-[var(--navy)] mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium text-[var(--ink)]">{c.name}</span>
                  <span className="text-[var(--muted)]"> · {c.type}</span>
                </span>
              </li>
            ))}
          </ul>
          <a href={`tel:${res.csc_helpline}`}
            className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--blue)]">
            <Phone size={14} /> CSC helpline: {res.csc_helpline}
          </a>
        </div>
      )}
    </div>
  );
}

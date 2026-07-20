import { useEffect, useState } from "react";
import { X, MessageSquareWarning, Send, Loader2 } from "lucide-react";

/*
 * GrievanceModal — replaces window.prompt() for raising a grievance
 * on a submitted application, with the same card/modal styling used
 * across the app (ExplainModal, RelativeCheckModal).
 */
export default function GrievanceModal({ app, onClose, onSubmit }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMsg(""); setBusy(false); }, [app]);

  if (!app) return null;

  const submit = async () => {
    setBusy(true);
    try { await onSubmit(msg.trim()); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--navy)]/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="card shadow-[var(--shadow-lg)] w-full max-w-md p-6 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="badge badge-warn mb-2"><MessageSquareWarning size={12} /> Raise grievance</span>
            <h3 className="text-lg font-bold text-[var(--ink)] leading-snug">
              {app.scheme_name} <span className="text-[var(--muted)] font-medium">({app.ticket_id})</span>
            </h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm !px-2"><X size={20} /></button>
        </div>

        <p className="text-sm text-[var(--muted)] font-medium mt-3">
          Describe your issue with this application:
        </p>
        <textarea
          autoFocus
          rows={4}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="e.g. My application has been stuck under review for 3 weeks…"
          className="field mt-3 resize-none text-[15px] rounded-xl"
        />

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="btn btn-outline flex-1">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn btn-primary flex-1">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit
          </button>
        </div>
      </div>
    </div>
  );
}

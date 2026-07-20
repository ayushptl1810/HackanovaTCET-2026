// Haqq API client — talks to the FastAPI backend (proxied at /api in dev).

const TOKEN_KEY = "haqq_token";
const USER_KEY = "haqq_user";

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  },
  save: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || null));
  },
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
  isLoggedIn: () => !!localStorage.getItem(TOKEN_KEY),
};

async function request(path, { method = "GET", body, authed = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authed && auth.token()) headers.Authorization = `Bearer ${auth.token()}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  // The backend never returns the raw phone (privacy); the citizen typed it, so
  // we fold it into the saved user on their own device — lets the auto-fill agent
  // use the mobile number too.
  login: async (mobile_number, pin) => {
    const res = await request("/api/login/citizen", { method: "POST", body: { mobile_number, pin } });
    return { ...res, user: { ...(res.user || {}), mobile_number } };
  },
  // One-tap demo sign-in as "Ayush Patel" (seeded so every scheme is Eligible).
  demoLogin: () => request("/api/login/demo", { method: "POST" }),
  me: () => request("/api/me", { authed: true }),
  mySchemes: (limit = 20) => request(`/api/me/schemes?limit=${limit}`, { authed: true }),
  searchSchemes: (q, limit = 12) =>
    request(`/api/me/schemes/search?q=${encodeURIComponent(q)}&limit=${limit}`, { authed: true }),

  // Applications tracker (tickets)
  createApplication: (scheme_id, scheme_name, mobile = "") =>
    request("/api/me/applications", { method: "POST", authed: true, body: { scheme_id, scheme_name, mobile } }),
  listApplications: () => request("/api/me/applications", { authed: true }),
  raiseGrievance: (ticket_id, message) =>
    request(`/api/me/applications/${encodeURIComponent(ticket_id)}/grievance`, { method: "POST", authed: true, body: { message } }),

  // Find help near me (district/state + service points for a pincode)
  locate: (pincode) => request(`/api/locate?pincode=${encodeURIComponent(pincode)}`, {}),

  // Explain a scheme in very simple language, in the citizen's language
  explainScheme: (scheme_id, lang = "en") =>
    request("/api/assistant/explain", { method: "POST", body: { scheme_id, lang } }),

  // Check eligibility for a family member (no account needed)
  checkRelative: (profile) =>
    request("/api/schemes/check", { method: "POST", body: profile }),
  
  // Public schemes catalog for landing page
  publicSchemes: () => request("/api/schemes/public"),
  getSchemeById: (id) => request(`/api/schemes/detail/${id}`),
  checkSchemes: (profile) => request("/api/schemes/check", { method: "POST", body: profile }),
  // Cross-verify a scheme's documents/eligibility against its live myScheme.gov.in
  // page (used by the Apply-Agent before it builds the document checklist).
  verifyScheme: (id) => request(`/api/schemes/${encodeURIComponent(id)}/verify`),

  // DigiLocker (mock-aware: the mock consent URL carries the code, so we can
  // complete the flow client-side for the demo; real providers redirect).
  digilockerLogin: () => request("/api/digilocker/login", {}),
  digilockerCallback: (code, state) =>
    request(`/api/digilocker/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {}),

  // Haqq Sahayak — grounded help assistant (chatbot + voice agent brain).
  // Sends the current citizen token (when present) so replies are personalised.
  chat: (messages, lang = "en") =>
    request("/api/assistant/chat", {
      method: "POST",
      body: { messages, lang, token: auth.token() || null },
    }),
  transcribe: async (audioBlob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    const res = await fetch("/api/assistant/transcribe", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Transcription failed");
    return res.json();
  }
};

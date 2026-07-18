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
  login: (mobile_number, pin) =>
    request("/api/login/citizen", { method: "POST", body: { mobile_number, pin } }),
  me: () => request("/api/me", { authed: true }),
  mySchemes: (limit = 20) => request(`/api/me/schemes?limit=${limit}`, { authed: true }),
  searchSchemes: (q, limit = 12) =>
    request(`/api/me/schemes/search?q=${encodeURIComponent(q)}&limit=${limit}`, { authed: true }),

  // DigiLocker (mock-aware: the mock consent URL carries the code, so we can
  // complete the flow client-side for the demo; real providers redirect).
  digilockerLogin: () => request("/api/digilocker/login", {}),
  digilockerCallback: (code, state) =>
    request(`/api/digilocker/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {}),
};

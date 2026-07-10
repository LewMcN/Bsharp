import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Capture auth errors from email-link redirects BEFORE the client
// initializes — it strips them from the URL as it starts up.
export const initialAuthError = (() => {
  try {
    const h = window.location.hash;
    if (!h || !h.includes("error")) return null;
    const p = new URLSearchParams(h.slice(1));
    const code = p.get("error_code"), desc = p.get("error_description");
    return code || desc ? { code, desc } : null;
  } catch (e) { return null; }
})();

// A misconfigured build must degrade gracefully, never break the app:
// - an invalid URL disables Supabase (guest mode) instead of crashing
// - a URL pasted with a path (e.g. the /rest/v1/ endpoint from the API
//   docs) is normalized to its origin, which is what createClient needs
let client = null;
if (typeof url === "string" && /^https:\/\//.test(url) && key) {
  try {
    client = createClient(new URL(url).origin, key);
  } catch (e) {
    console.warn("Supabase disabled — invalid configuration:", e?.message);
    client = null;
  }
}

export const supabase = client;
export const isConfigured = Boolean(client);

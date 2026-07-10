import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// A misconfigured build (bad URL, swapped values) must degrade to guest
// mode, never crash the app at load.
const validUrl = typeof url === "string" && /^https:\/\/.+/.test(url);

let client = null;
if (validUrl && key) {
  try {
    client = createClient(url, key);
  } catch (e) {
    console.warn("Supabase disabled — invalid configuration:", e?.message);
    client = null;
  }
}

export const supabase = client;
export const isConfigured = Boolean(client);

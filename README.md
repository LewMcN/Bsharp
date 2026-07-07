# B Sharp — Fretboard Intelligence

Interactive guitar fretboard trainer with accounts and cloud-synced progress.
React + Vite + Tailwind v4 + Tone.js on the front end; Supabase (hosted
Postgres + auth) as the backend. No servers to maintain.

## What accounts get you

- Email/username/password sign-up and sign-in (Supabase Auth — passwords are
  hashed server-side, never stored in plain text)
- XP, best streak, accuracy and weak-spot data synced across devices
- Guest mode still works: progress saves to that device via localStorage

## 1 — Backend setup (Supabase, ~5 minutes, free)

1. Create a free account at https://supabase.com → **New project**
   (pick any name/region; note the database password it asks you to set).
2. In the dashboard: **SQL Editor** → paste the entire contents of
   `supabase/schema.sql` → **Run**. This creates the `profiles` and
   `progress` tables, row-level security, and the signup trigger.
3. **Project Settings → API**: copy the **Project URL** and the
   **anon public** key.
4. Copy `.env.example` to `.env` and fill both values in.
5. Optional but recommended for friends: **Authentication → Providers →
   Email → turn OFF "Confirm email"** so signups work instantly without a
   confirmation email. (Leave it on if you prefer verified addresses.)

## 2 — Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## 3 — Deploy

**Quick way:** after creating `.env`, run `npm run build`, then drag the
fresh `dist` folder onto https://app.netlify.com/drop.
Note: the env values are baked in at build time, so rebuild after any change.

**Proper way (auto-deploys):** push to GitHub → import into Netlify /
Vercel / Cloudflare Pages → set build command `npm run build`, output `dist`
→ add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment
variables in the host's dashboard.

## 4 — Custom domain

Buy at Cloudflare Registrar or Porkbun (~£8–12/yr) → in your host's
dashboard: Domain settings → Add custom domain → add the one DNS record it
shows you. HTTPS is automatic.

## Security notes (worth understanding)

- The **anon key is safe to ship in the site** — it only grants what
  row-level security allows, and the policies restrict every user to their
  own rows. This is the intended Supabase model.
- **Never** put the `service_role` key anywhere in this project — that one
  bypasses row-level security.
- Password hashing, session tokens and rate limiting are handled by
  Supabase Auth.

## Not included yet (easy future additions)

- Password reset flow (Supabase supports it; needs a small recovery page)
- Friends leaderboard (one query on the `progress` table + a public-read
  policy on usernames)
- Merging guest progress into a new account on signup

## Deploy — GitHub Pages (already wired up)

This repo includes `.github/workflows/deploy.yml`, which builds and publishes
the app to GitHub Pages on every push to `main`. One-time setup:

1. On GitHub: **Settings → Pages → Source: GitHub Actions**.
2. (Optional, for accounts/cloud sync) **Settings → Secrets and variables →
   Actions** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   Without them the deployed app runs in guest mode, which works fine.

The site appears at `https://<your-username>.github.io/Bsharp/`.

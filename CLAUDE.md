# B Sharp — Fretboard Intelligence

Interactive guitar fretboard trainer (scales, arpeggios, blues jam engine,
gamified drills) with optional accounts and cloud-synced progress.

## Stack

- React 18 + Vite 6, Tailwind CSS v4 (via `@tailwindcss/vite`), Tone.js for audio
- Supabase (hosted Postgres + Auth) as the optional backend — schema in `supabase/schema.sql`
- No custom server: static build, deployable anywhere

## Commands

- `npm run dev` — dev server on http://localhost:5173
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally

## Where things live

- `src/App.jsx` — the whole trainer UI and game logic (single large component)
- `src/Auth.jsx` — sign-up/sign-in screens
- `src/lib/supabase.js` — Supabase client; exports `isConfigured`
- `supabase/schema.sql` — tables, row-level security, signup trigger (run once in the Supabase SQL editor)

## Behaviour to preserve

- The app must keep working with NO env vars set: `isConfigured` is false,
  guest mode saves progress to localStorage. Never make Supabase required.
- Supabase env values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are baked
  in at build time — rebuild after changing them.

## Gotchas

- iOS mutes Web Audio via the ring/silent switch ("ambient" category). The
  looping silent `<audio>` element in `unlockIOSAudio()` (App.jsx) promotes the
  page to the "playback" category so sound works regardless — don't remove it.
- Jam bass/piano are real samples (`tonejs-instrument-*-mp3` packages) built as
  static assets via `src/lib/jamSamples.js`; `startJam` awaits `Tone.loaded()`.

## Don'ts

- Never commit `.env` or any real key; `.env.example` holds placeholders only.
- Don't commit `dist/` — it's built by CI.

## Before saying done

- `npm run build` passes
- The app loads in the browser and the main drill flow works (click through it)
- If auth/progress code changed: test both signed-in and guest paths

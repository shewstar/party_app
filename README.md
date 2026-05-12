# Bucks Party App

Minimalist, mobile-first web app for a private bucks party of ~12 people in one shared room. Log drinks, see an estimated BAC, vote on rules, run games with scores, and watch live leaderboards.

Built per [bucks-party-builder-prompt.html](bucks-party-builder-prompt.html).

## Stack

- **Frontend:** Next.js 15 (App Router) + React + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres + Realtime + Storage)
- **Hosting:** Vercel + Supabase Cloud
- **Auth:** none — each device generates a local UUID stored in `localStorage`. One implicit shared room.

## Setup

### 1. Supabase project

1. Create a new project at https://supabase.com.
2. Open the SQL editor and run [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).
3. In **Storage**, create a public bucket named `avatars`.
4. In **Project Settings → API**, copy the URL and anon key.

### 2. Local dev

```sh
cp .env.local.example .env.local
# Paste your Supabase URL and anon key into .env.local

npm install
npm run dev
```

Open http://localhost:3000 on a phone-shaped viewport.

### 3. Deploy

Push to GitHub, import to Vercel, set the same two env vars in Vercel's project settings.

## First-time user flow

1. Open the app → onboarding asks for a name.
2. Land on home: drink summary, **Add a Drink** button, secondary tiles, drinks leaderboard, "voted in" list.
3. Tap **Add a Drink** → category (beer/wine/spirits) → preset chip → confirm.
4. Open **Settings** to add weight, sex, and first-drink time so BAC estimates work.

## BAC

Widmark formula with linear elimination at 0.015 %/hour. Always rendered with an
"estimate only" label; the disclaimer footer warns users not to use it for
drive/no-drive or safety decisions.

## Files

- [app/](app) — routes
- [components/](components) — UI primitives
- [lib/](lib) — Supabase clients, BAC + drink math, session
- [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) — schema + RLS + realtime

## Notes

- Permissive RLS — this is a private bucks night, not a public service. Anyone with the URL + a connection can write. Don't deploy it publicly.
- Realtime channels are per-page; optimistic UI is on vote toggles and drink logs.

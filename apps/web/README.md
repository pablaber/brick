# Web App (`apps/web`)

SvelteKit frontend for the workout dashboard.

## Stack

- SvelteKit + TypeScript (Svelte 5 runes mode)
- Tailwind CSS v4
- Cloudflare adapter (`@sveltejs/adapter-cloudflare`)
- Supabase Auth (`@supabase/ssr`)

## Current Routes

- `/` — public home page
- `/auth/login` — login and signup form (with form actions)
- `/auth/logout` — POST endpoint for sign-out
- `/dashboard` — protected, mock stats (redirects to login if unauthenticated)
- `/settings` — protected, account and Strava connection info
- `/strava/connect` — protected POST endpoint to start OAuth via worker
- `/sync/manual` — protected POST endpoint to start manual sync via worker

## Auth

Auth is handled server-side via `@supabase/ssr`:

- `hooks.server.ts` creates a Supabase client per request and attaches `getSession` / `getUser` to `event.locals`.
- Protected routes use the `requireUser()` helper from `$lib/server/auth.ts`.
- Login/signup uses SvelteKit form actions.
- A `profiles` row is auto-created on first login/signup via `ensureProfile()`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values from `npx supabase status`:

```bash
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>
STRAVA_WORKER_URL=http://localhost:8787
WORKER_SHARED_SECRET=<must-match-worker-shared-secret>
```

`STRAVA_WORKER_URL` and `WORKER_SHARED_SECRET` are server-only and must not be exposed through `PUBLIC_` vars.

## Commands

From repo root:

```bash
pnpm --filter web dev
pnpm --filter web check
pnpm --filter web build
```

If Cloudflare worker configuration changes, regenerate types:

```bash
pnpm --filter web gen
```

## Manual sync

- Settings page shows Strava connection state and latest sync run.
- `Sync now` submits to SvelteKit server route (`POST /sync/manual`), never directly from browser to worker.
- Worker activity fetch is capped to 1,000 activities per manual sync (`100 x 10 pages`).

`/dashboard` remains powered by mock data in this phase.

# Workout Dashboard Monorepo

This repository is a `pnpm` + Turborepo monorepo for the workout tracking platform.

## Architecture

- `apps/web`: SvelteKit frontend dashboard with Supabase Auth.
- `workers/strava`: Cloudflare Worker for Strava OAuth connection flow (sync/webhooks come later).
- `packages/shared`: Shared TypeScript types and utilities (including generated database types).
- `supabase/migrations`: SQL migrations for the Supabase schema.

## Web App (`apps/web`)

SvelteKit frontend dashboard with:

- SvelteKit (TypeScript, Svelte 5 runes mode).
- Cloudflare deployment adapter (`@sveltejs/adapter-cloudflare`).
- Tailwind CSS v4 via Vite plugin.
- Supabase Auth (email/password signup and login via `@supabase/ssr`).
- ESLint with `eslint-plugin-svelte`.
- Shared responsive layout and auth-aware top navigation.
- Routes:
  - `/` — public home page.
  - `/auth/login` — login and signup form.
  - `/auth/logout` — POST endpoint to sign out.
  - `/dashboard` — protected, shows mock dashboard cards.
  - `/settings` — protected, shows account info and Strava connection status.
- Auth features:
  - Server-side session management via `hooks.server.ts`.
  - Protected routes redirect unauthenticated users to `/auth/login`.
  - Profile row auto-created on first login/signup.
  - Auth-aware nav (shows Dashboard/Settings/Log out when logged in, Home/Log in when logged out).
- Mock dashboard cards only (no Strava integration yet):
  - Weekly minutes
  - Yearly running miles
  - Recent activities
  - Sport breakdown

## Scripts

Run from repo root:

- `pnpm install`: Install workspace dependencies.
- `pnpm dev`: Run all workspace `dev` scripts in parallel.
- `pnpm --filter web dev`: Run the SvelteKit app only.
- `pnpm build`: Build all workspaces through Turborepo.
- `pnpm check`: Typecheck all workspaces (includes `wrangler types` + `svelte-check` for web).
- `pnpm lint`: Lint all workspaces (ESLint + `eslint-plugin-svelte` for web).
- `pnpm test`: Run workspace test tasks.
- `pnpm format`: Check formatting with Prettier.
- `pnpm format:write`: Auto-fix formatting.
- `pnpm db:types`: Generate Supabase TypeScript types to `packages/shared/src/database.types.ts`.

## Getting Started

```bash
pnpm install
```

### Local Supabase

Start local Supabase and get credentials:

```bash
npx supabase start
npx supabase status
```

Copy the API URL and `anon key` from `supabase status` output into `apps/web/.env.local`:

```bash
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>
```

See `apps/web/.env.example` for a template.

### Run the app

```bash
pnpm --filter web dev
```

Then open the app locally. Sign up at `/auth/login`, then visit `/dashboard` to see the mock stats UI.

### Dev Links

- Site: http://localhost:5173
- Supabase Dashboard (Studio): http://127.0.0.1:54323

## Phase 7: Strava OAuth Setup

### 1) Strava API app setup

1. Create or open your Strava API application.
2. Set the OAuth callback URL for local development to:
   - `http://localhost:8787/strava/callback`
3. For deployed environments, add your deployed Worker callback URL:
   - `https://<worker-domain>/strava/callback`
4. Copy your Strava Client ID and Client Secret into Worker secrets or local Worker vars.
5. Never expose `STRAVA_CLIENT_SECRET` in frontend/public environment variables.

### 2) Worker env vars

Copy `workers/strava/.dev.vars.example` to `workers/strava/.dev.vars` and set:

```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
STRAVA_CLIENT_ID=<strava-client-id>
STRAVA_CLIENT_SECRET=<strava-client-secret>
STRAVA_REDIRECT_URI=http://localhost:8787/strava/callback
APP_URL=http://localhost:5173
WORKER_SHARED_SECRET=<long-random-secret>
```

### 3) Web env vars

Copy `apps/web/.env.example` to `apps/web/.env.local` and set:

```bash
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
STRAVA_WORKER_URL=http://localhost:8787
WORKER_SHARED_SECRET=<must-match-worker-shared-secret>
```

Important:

- `SUPABASE_SERVICE_ROLE_KEY`, `STRAVA_CLIENT_SECRET`, and `WORKER_SHARED_SECRET` must never be in public/browser vars.
- `WORKER_SHARED_SECRET` must match between web server env and worker env.

### 4) Run local OAuth flow

Terminal 1:

```bash
pnpm --filter web dev
```

Terminal 2:

```bash
pnpm --filter @workout/strava-worker dev
```

Then open:

- `http://localhost:5173/settings`

### 5) Manual verification checklist

1. Log in to the app.
2. Open `/settings`.
3. Click `Connect Strava`.
4. Confirm redirect to Strava authorization page.
5. Approve access.
6. Confirm redirect back to `/settings?strava=connected`.
7. Confirm settings page shows connected status and Strava athlete ID.
8. Confirm `strava_connections` has a row for the user in Supabase.
9. Confirm access/refresh tokens are not exposed in browser-rendered settings data.

## Supabase

Local development setup and schema docs are in `supabase/README.md`.

Tables: `profiles`, `strava_connections`, `oauth_states`, `activities`, `sync_runs`.
Views: `weekly_activity_minutes`, `monthly_distance_by_sport`, `yearly_running_distance`, `weekly_sport_breakdown`.

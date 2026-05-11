# Workout Dashboard Monorepo

This repository is a `pnpm` + Turborepo monorepo for the workout tracking platform.

## Architecture

- `apps/web`: SvelteKit frontend dashboard with Supabase Auth.
- `workers/strava`: Worker service for future Strava ingest/sync jobs.
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

## Supabase

Local development setup and schema docs are in `supabase/README.md`.

Tables: `profiles`, `strava_connections`, `activities`, `sync_runs`.
Views: `weekly_activity_minutes`, `monthly_distance_by_sport`, `yearly_running_distance`, `weekly_sport_breakdown`.

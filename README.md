# Workout Dashboard Monorepo

This repository is a `pnpm` + Turborepo monorepo for the workout tracking platform.

## Architecture

- `apps/web`: SvelteKit frontend dashboard (Phase 2 baseline).
- `workers/strava`: Worker service for future Strava ingest/sync jobs.
- `packages/shared`: Shared TypeScript types and utilities.
- `supabase/migrations`: SQL migrations for future Supabase schema changes.

## Web App (`apps/web`)

SvelteKit frontend dashboard with:

- SvelteKit (TypeScript, Svelte 5 runes mode).
- Cloudflare deployment adapter (`@sveltejs/adapter-cloudflare`).
- Tailwind CSS v4 via Vite plugin.
- ESLint with `eslint-plugin-svelte`.
- Shared responsive layout and top navigation.
- Routes: `/`, `/dashboard`, `/settings`, `/auth/login`.
- Mock dashboard cards only (no Supabase or Strava integration yet):
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
pnpm --filter web dev
```

Then open the app locally and visit `/dashboard` to see the mock stats UI.

## Supabase

Local development setup and schema docs are in `supabase/README.md`.

Tables: `profiles`, `strava_connections`, `activities`, `sync_runs`.
Views: `weekly_activity_minutes`, `monthly_distance_by_sport`, `yearly_running_distance`, `weekly_sport_breakdown`.

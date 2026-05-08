# Workout Dashboard Monorepo

This repository is a `pnpm` + Turborepo monorepo for the workout tracking platform.

## Architecture

- `apps/web`: SvelteKit frontend dashboard (Phase 2 baseline).
- `workers/strava`: Worker service for future Strava ingest/sync jobs.
- `packages/shared`: Shared TypeScript types and utilities.
- `supabase/migrations`: SQL migrations for future Supabase schema changes.

## Phase 2 (Current) Web App

The `apps/web` package now includes:

- SvelteKit (TypeScript).
- Cloudflare deployment adapter (`@sveltejs/adapter-cloudflare`).
- Tailwind CSS setup.
- Shared responsive layout and top navigation.
- Initial routes:
  - `/`
  - `/dashboard`
  - `/settings`
  - `/auth/login`
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
- `pnpm build`: Run workspace builds through Turborepo.
- `pnpm check`: Run workspace type/sanity checks.
- `pnpm lint`: Run workspace lint tasks.
- `pnpm test`: Run workspace test tasks.
- `pnpm db:types`: Generate local Supabase TypeScript types to `packages/shared/src/database.types.ts`.

## Getting Started

```bash
pnpm install
pnpm --filter web dev
```

Then open the app locally and visit `/dashboard` to see the mock stats UI.

## Supabase (Phase 3)

Supabase local development setup and schema docs are in `supabase/README.md`.

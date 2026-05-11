# Supabase Local Setup

This directory contains local Supabase CLI configuration and database migrations for the workout dashboard.

## Start local Supabase

From repo root:

```bash
npx supabase start
```

This starts the local Postgres/Auth/API/Studio stack using `supabase/config.toml`.

## Run migrations

Migrations live in `supabase/migrations` and are applied automatically by `npx supabase start` and `npx supabase db reset`.

To reset and reapply:

```bash
npx supabase db reset
```

## Generate TypeScript DB types

From repo root:

```bash
pnpm db:types
```

This writes generated types to `packages/shared/src/database.types.ts`.

## Schema summary

- `public.profiles`: app-level profile row per authenticated user.
- `public.strava_connections`: Strava OAuth/token metadata per user (readable by user, writable later via service role).
- `public.oauth_states`: short-lived OAuth state records created/consumed by trusted server-side code.
- `public.activities`: normalized synced Strava activities.
- `public.sync_runs`: history of manual/scheduled sync attempts.

## View summary

- `public.weekly_activity_minutes`: weekly moving minutes and activity count by sport.
- `public.monthly_distance_by_sport`: monthly distance (meters/miles) and activity count by sport.
- `public.yearly_running_distance`: yearly running-only distance totals (meters/miles).
- `public.weekly_sport_breakdown`: weekly totals for moving time and distance by sport.

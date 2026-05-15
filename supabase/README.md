# Supabase Local Setup

This directory contains local Supabase CLI configuration and database migrations for Brick.

## Start local Supabase

From repo root:

```bash
npx supabase start
```

This starts the local Postgres/Auth/API/Studio stack using `supabase/config.toml`.

GraphQL is intentionally not exposed for this app. The migrations drop the unused `pg_graphql`
extension if it is present, and local API config exposes only the `public` schema for REST.

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
- `public.strava_webhook_events`: persisted signed Strava webhook events and processing status.
- `public.sync_runs`: history of manual/scheduled sync attempts.

`public.strava_connections` also tracks webhook/deauthorization state:

- `webhook_events_received_at`
- `last_webhook_event_at`
- `deauthorized_at`
- nullable `access_token`, `refresh_token`, `expires_at` for retained deauthorized rows.

Only one active Brick user may be connected to a given Strava athlete at a time. Deauthorized
connection rows are retained for account state/history and are excluded from that uniqueness rule.

## View summary

- `public.weekly_activity_breakdown`: weekly totals for moving time and distance by sport.
- `public.monthly_activity_breakdown`: monthly totals for moving time and distance by sport.
- `public.yearly_activity_breakdown`: yearly totals for moving time and distance by sport.

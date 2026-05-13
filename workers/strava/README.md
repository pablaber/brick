# Strava Worker (Phase 10 Scheduled Sync)

This Cloudflare Worker handles:

- Strava OAuth connection flow
- Manual activity sync (`POST /sync/manual`)
- Scheduled activity sync via Cloudflare Cron Trigger (`scheduled()`)

Tokens remain server-side in Supabase.

## Run locally

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Fill in placeholder values (never commit real secrets).
3. Start the worker:

```bash
pnpm --filter @brick/strava-worker dev
```

Worker default URL: `http://localhost:8787`.

## Routes

- `GET /health`
  - Purpose: quick liveliness/status probe for local/dev/prod checks.
  - Auth: none.
  - Response: `200` JSON with `ok`, `service`, and `timestamp`.

- `GET /strava/connect?token=<signed-token>`
  - Purpose: starts Strava OAuth by validating a short-lived signed token from the web app and redirecting to Strava.
  - Query params: `token` (required).
  - Auth: token signed with `WORKER_SHARED_SECRET`.
  - Success: `302` redirect to Strava authorize URL.
  - Failures: `400` for missing token, `401` for invalid/expired token.

- `GET /strava/callback?code=...&state=...`
  - Purpose: handles Strava OAuth callback, validates state, exchanges code for tokens, and upserts `strava_connections`.
  - Query params: `state` and `code` on success path; Strava can also return `error=access_denied`.
  - Auth: OAuth state validation against `oauth_states` table.
  - Success: `302` redirect back to `APP_URL/settings?strava=connected`.
  - Failures: safe redirects like `?strava=denied`, `?strava=invalid_state`, or `?strava=error`.

- `POST /sync/manual`
  - Purpose: runs user activity sync on demand from the web app.
  - Body: JSON with `token` (required), plus optional `cursorBefore`, `syncRunId`, and `estimatedTotalActivities` for multi-batch/manual backfill flow.
  - Auth: signed manual sync token (`WORKER_SHARED_SECRET`).
  - Success: `200` JSON sync summary (`syncRunId`, fetched/upserted counts, pagination fields).
  - Failures: `409` if a sync is already running, `400` when user has no Strava connection, `500` for internal/safe failure.

- `GET /__scheduled?cron=...` (Wrangler local only)
  - Purpose: local endpoint exposed by `wrangler dev --test-scheduled` to simulate cron execution.
  - Auth: none (local dev tool endpoint).
  - Usage: trigger scheduled handler manually during local testing.

## Environment Variables

Required:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI`
- `APP_URL`
- `WORKER_SHARED_SECRET`

Optional scheduled sync tuning:

- `STRAVA_SCHEDULED_SYNC_MIN_INTERVAL_HOURS` (default `6`)
- `STRAVA_SCHEDULED_SYNC_LIMIT` (default `25`)

## Scheduled Cron Trigger

The worker defines a cron trigger in `wrangler.jsonc` (`0 */6 * * *`, every 6 hours) that invokes the Worker `scheduled()` handler.

Each run:

1. Reads cron metadata (`controller.cron`) and starts a scheduled sync run.
2. Finds connected users due for sync (`last_synced_at` missing or older than configured interval).
3. For each due user, runs the same core sync pipeline used by manual sync (token refresh, Strava fetch, activity upsert, sync_runs updates).
4. Skips users that are currently running a sync or were synced too recently.
5. Continues processing remaining users if a single user fails.
6. Logs a safe summary (`usersConsidered`, `usersSynced`, `usersSkipped`, `usersFailed`).

## Scheduled Sync Behavior

Production cron schedule is configured in `wrangler.jsonc`:

- `0 */6 * * *` (every 6 hours)

When cron runs, the worker:

1. Loads Strava-connected users.
2. Filters to users due for sync (never synced or older than interval).
3. Runs sync sequentially per user.
4. Skips users with an active running sync.
5. Reuses the same core sync logic as manual sync.
6. Records each sync in `sync_runs` with `sync_type='scheduled'`.
7. Continues processing remaining users when one user fails.

## Manual Sync Behavior

Manual sync still runs via `POST /sync/manual` and:

1. Verifies signed request token.
2. Checks for running sync lock.
3. Runs shared sync logic.
4. Records `sync_runs.sync_type='manual'`.

## Local Scheduled Testing

Cron does not auto-fire locally. Use one of these flows.

Interactive:

```bash
pnpm --filter @brick/strava-worker dev:scheduled
curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"
```

One-shot:

```bash
pnpm --filter @brick/strava-worker test:scheduled
```

The one-shot script starts Wrangler in scheduled test mode, waits for `/health`, triggers `/__scheduled`, prints response output, and stops Wrangler.

## Deployment Notes

- Cron triggers are defined in Wrangler config and deployed with the worker.
- Production secrets must be configured separately; do not commit secret values.

Example commands:

```bash
wrangler secret put SUPABASE_SECRET_KEY
wrangler secret put STRAVA_CLIENT_SECRET
wrangler secret put WORKER_SHARED_SECRET
```

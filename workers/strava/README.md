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
pnpm --filter @workout/strava-worker dev
```

Worker default URL: `http://localhost:8787`.

## Routes

- `GET /health`
- `GET /strava/connect?token=<signed-token>`
- `GET /strava/callback?code=...&state=...`
- `POST /sync/manual`

Wrangler `--test-scheduled` also exposes:

- `GET /__scheduled?cron=...` (local cron trigger endpoint)

## Environment Variables

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI`
- `APP_URL`
- `WORKER_SHARED_SECRET`

Optional scheduled sync tuning:

- `STRAVA_SCHEDULED_SYNC_MIN_INTERVAL_HOURS` (default `6`)
- `STRAVA_SCHEDULED_SYNC_LIMIT` (default `25`)

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
pnpm --filter @workout/strava-worker dev:scheduled
curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"
```

One-shot:

```bash
pnpm --filter @workout/strava-worker test:scheduled
```

The one-shot script starts Wrangler in scheduled test mode, waits for `/health`, triggers `/__scheduled`, prints response output, and stops Wrangler.

## Deployment Notes

- Cron triggers are defined in Wrangler config and deployed with the worker.
- Production secrets must be configured separately; do not commit secret values.

Example commands:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put STRAVA_CLIENT_SECRET
wrangler secret put WORKER_SHARED_SECRET
```

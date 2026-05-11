# Strava Worker (Phase 8 Manual Sync)

This Cloudflare Worker handles the Strava OAuth connection flow and manual activity sync. Tokens remain server-side in Supabase.

## Run locally

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Fill in placeholder values (no real secrets should be committed).
3. Start the worker:

```bash
pnpm --filter @workout/strava-worker dev
```

The worker runs with Wrangler on `http://localhost:8787`.

## Routes

- `GET /health`
- `GET /strava/connect?token=<signed-token>`
- `GET /strava/callback?code=...&state=...`
- `POST /sync/manual` (signed server-to-server request from SvelteKit)

Local dev endpoint URLs:

- `http://localhost:8787/health`
- `http://localhost:8787/strava/connect`
- `http://localhost:8787/strava/callback`
- `http://localhost:8787/sync/manual`

Unknown routes return JSON `404`:

```json
{ "ok": false, "error": "Not found" }
```

Unhandled errors return JSON `500`:

```json
{ "ok": false, "error": "Internal server error" }
```

## Environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI`
- `APP_URL`
- `WORKER_SHARED_SECRET`

## OAuth flow summary

1. Web app starts OAuth via `POST /strava/connect` server route.
2. Web app signs a short-lived connect token with `WORKER_SHARED_SECRET`.
3. Worker validates token on `GET /strava/connect`.
4. Worker creates `oauth_states` row with 10 minute expiration.
5. Worker redirects to Strava OAuth authorize URL with `state`.
6. Strava calls back to `GET /strava/callback`.
7. Worker validates `state` (exists, not expired, not used).
8. Worker exchanges `code` for tokens with Strava.
9. Worker upserts `strava_connections` and marks `oauth_states.used_at`.
10. Worker redirects to `APP_URL/settings?strava=connected` (or safe error status).

## Manual sync flow summary

1. Logged-in user clicks `Sync now` on `/settings`.
2. Web server route (`POST /sync/manual`) signs short-lived token with `WORKER_SHARED_SECRET`.
3. Worker validates signature, `iat`, `exp`, and `action=manual_sync`.
4. Worker checks for a recent running sync (10 minute guard).
5. Worker inserts `sync_runs(status='running')`.
6. Worker loads `strava_connections` for the user.
7. Worker refreshes token if expired or expiring within 5 minutes.
8. Worker fetches paginated activities from Strava.
9. Worker maps each activity through shared mapper and upserts `activities`.
10. Worker updates `strava_connections.last_synced_at`.
11. Worker marks `sync_runs` success/failed and returns safe JSON.

## Manual sync limits (v1)

- `per_page=100`
- `maxPages=10`
- max 1,000 activities per manual sync request
- if `last_synced_at` exists, fetch starts from `last_synced_at - 1 day` to catch late edits

## Local manual test

1. Start web app and worker:

```bash
pnpm --filter web dev
pnpm --filter @workout/strava-worker dev
```

2. Log in at `http://localhost:5173`.
3. Open `http://localhost:5173/settings`.
4. Click `Connect Strava`.
5. Complete Strava auth and confirm redirect to settings.
6. Click `Sync now`.
7. Confirm `/settings?sync=success` (or safe error status).
8. Verify `sync_runs`, `activities`, and `strava_connections.last_synced_at` in Supabase.

## Non-goals in this phase

- no scheduled sync/Cron triggers
- no Strava webhooks
- no background backfill queue

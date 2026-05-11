# Strava Worker (Phase 7 OAuth)

This Cloudflare Worker handles the Strava OAuth connection flow and stores Strava tokens server-side in Supabase.

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
- `POST /sync/manual`

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

## Non-goals in this phase

- no activity sync
- no activity fetching
- no token refresh beyond initial token storage
- no scheduled sync/webhooks

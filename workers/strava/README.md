# Strava Worker (Phase 6 Skeleton)

This Cloudflare Worker provides the foundation for future Strava OAuth, sync, and webhook flows.

Current routes are placeholders only.

## Run locally

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Fill in placeholder values (no real secrets should be committed).
3. Start the worker:

```bash
pnpm --filter @workout/strava-worker dev
```

The worker runs with Wrangler on `http://localhost:8787`.

## Routes (placeholder responses)

- `GET /health`
- `GET /strava/connect`
- `GET /strava/callback`
- `POST /sync/manual`

Unknown routes return JSON `404`:

```json
{ "ok": false, "error": "Not found" }
```

Unhandled errors return JSON `500`:

```json
{ "ok": false, "error": "Internal server error" }
```

## Environment variables (for later phases)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI`
- `APP_URL`
- `WORKER_SHARED_SECRET`

Non-goals in this phase:

- no real Strava OAuth
- no Strava API calls
- no Supabase writes
- no scheduled sync/webhooks

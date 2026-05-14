# Strava Worker (Phase 11 Webhooks)

This Cloudflare Worker handles:

- Strava OAuth connection flow
- Manual activity sync (`POST /sync/manual`)
- Scheduled activity sync via Cloudflare Cron Trigger (`scheduled()`)
- Strava webhook verification + event intake (`GET/POST /strava/webhook`)

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
- `GET /strava/connect?token=<signed-token>`
- `GET /strava/callback?code=...&state=...`
- `POST /sync/manual`
- `GET /strava/webhook`
- `POST /strava/webhook`

## Webhook Behavior

### `GET /strava/webhook`

Strava callback verification endpoint.

- Requires `hub.mode=subscribe`.
- Requires `hub.challenge`.
- Requires `hub.verify_token` matching `STRAVA_WEBHOOK_VERIFY_TOKEN`.
- Success response: `200` JSON `{ "hub.challenge": "<challenge>" }`.

### `POST /strava/webhook`

Signed webhook intake endpoint.

- Requires `STRAVA_WEBHOOK_SIGNING_SECRET` and valid `X-Strava-Signature` by default.
- If `STRAVA_WEBHOOK_DISABLE_SIGNATURE_VERIFICATION=true`, signature verification is bypassed.
- Persists each valid event to `strava_webhook_events`.
- Returns `200` quickly, then processes async with `waitUntil()`.

Processing behavior:

- `activity:create` / `activity:update`: fetches only `GET /api/v3/activities/{id}` and upserts one row.
- `activity:delete`: deletes local `activities` row by `(user_id, strava_activity_id)` only.
- `athlete` deauthorization (`updates.authorized === 'false'`): keeps `strava_connections` row, nulls token fields, sets `deauthorized_at`.
- Unknown owner events are persisted and marked `ignored`.

## Environment Variables

Required:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI`
- `STRAVA_WEBHOOK_VERIFY_TOKEN`
- `STRAVA_WEBHOOK_SIGNING_SECRET`
- `APP_URL`
- `WORKER_SHARED_SECRET`

Optional:

- `STRAVA_WEBHOOK_DISABLE_SIGNATURE_VERIFICATION` (`true` disables webhook signature checks; keep `false` in production)
- `STRAVA_WEBHOOK_CALLBACK_URL` (used by subscription helper scripts)
- `STRAVA_SCHEDULED_SYNC_MIN_INTERVAL_HOURS` (default `6`)
- `STRAVA_SCHEDULED_SYNC_LIMIT` (default `25`)

## Webhook Subscription Commands

Run from repo root:

```bash
export STRAVA_CLIENT_ID="<client-id>"
export STRAVA_CLIENT_SECRET="<client-secret>"
export STRAVA_WEBHOOK_CALLBACK_URL="https://api.getbricked.fit/strava/webhook"
export STRAVA_WEBHOOK_VERIFY_TOKEN="<verify-token>"

pnpm --filter @brick/strava-worker webhook:view
pnpm --filter @brick/strava-worker webhook:create
pnpm --filter @brick/strava-worker webhook:delete -- <subscription-id>
```

The script does not auto-load `workers/strava/.dev.vars`; required values must be exported in your shell.

Script env requirements:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_WEBHOOK_CALLBACK_URL`
- `STRAVA_WEBHOOK_VERIFY_TOKEN`

`webhook:create` checks for an existing subscription first and does not create a duplicate.

## Local Webhook Testing

### HTTPS callback requirement

Strava must reach a public HTTPS callback URL. For local testing, expose your worker with a tunnel (for example, `cloudflared` or `ngrok`) and use that HTTPS URL for webhook subscription creation.

### Verification request test

```bash
curl "http://localhost:8787/strava/webhook?hub.mode=subscribe&hub.challenge=test-challenge&hub.verify_token=<your-verify-token>"
```

Expected: `200` and `{"hub.challenge":"test-challenge"}`.

### Signed POST test

Generate signature and send event:

```bash
BODY='{"aspect_type":"create","event_time":1716126040,"object_id":1360128428,"object_type":"activity","owner_id":134815,"subscription_id":120475}'
TS=$(date +%s)
SIG=$(printf '%s' "${TS}.${BODY}" | openssl dgst -sha256 -hmac "$STRAVA_WEBHOOK_SIGNING_SECRET" -hex | sed 's/^.* //')

curl -i "http://localhost:8787/strava/webhook" \
  -H "content-type: application/json" \
  -H "X-Strava-Signature: t=${TS},v1=${SIG}" \
  -d "$BODY"
```

Expected: `200` and persisted event in `strava_webhook_events`.

## Scheduled Sync Notes

Cron schedule (in `wrangler.jsonc`):

- `0 */6 * * *` (every 6 hours)

Scheduled sync excludes deauthorized connections and rows with null token fields.

## Troubleshooting

- `401` on webhook POST: missing/invalid `X-Strava-Signature`, timestamp out of range, or wrong signing secret.
- Signature checks disabled: ensure `STRAVA_WEBHOOK_DISABLE_SIGNATURE_VERIFICATION` is set only for temporary/local fallback.
- `403` on webhook GET verify: incorrect `hub.verify_token`.
- Webhook event stays `failed`: inspect `strava_webhook_events.processing_error` and worker logs.
- `sync=not_connected`: no active Strava connection or connection is deauthorized.

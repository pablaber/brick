import { Hono } from 'hono';
import { createSignedManualSyncToken } from '@workout/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../env.js';
import { syncUserActivities } from '../lib/sync.js';
import { syncRoutes } from './sync.js';

vi.mock('../lib/sync.js', () => ({
  syncUserActivities: vi.fn()
}));

const env: Env = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SECRET_KEY: 'secret-key',
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'strava-secret',
  STRAVA_REDIRECT_URI: 'http://localhost:8787/strava/callback',
  APP_URL: 'http://localhost:5173',
  WORKER_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
};

const app = new Hono<{ Bindings: Env }>();
app.route('/sync', syncRoutes);

describe('POST /sync/manual', () => {
  beforeEach(() => {
    vi.mocked(syncUserActivities).mockReset();
  });

  it('rejects missing token', async () => {
    const response = await app.request('/sync/manual', { method: 'POST' }, env);
    expect(response.status).toBe(400);
  });

  it('rejects invalid token', async () => {
    const response = await app.request(
      '/sync/manual',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-token' })
      },
      env
    );

    expect(response.status).toBe(401);
  });

  it('returns 409 when a manual sync is already running', async () => {
    vi.mocked(syncUserActivities).mockResolvedValue({
      ok: true,
      statusCode: 409,
      syncType: 'manual',
      syncRunId: null,
      batchActivitiesFetched: 0,
      totalActivitiesFetched: 0,
      activitiesUpserted: 0,
      totalActivitiesUpserted: 0,
      hasMore: false,
      nextCursorBefore: null,
      estimatedTotalActivities: null,
      lastSyncedAt: null,
      skipped: true,
      skipReason: 'running_sync',
      error: null
    });

    const token = await createValidToken();
    const response = await app.request(
      '/sync/manual',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token })
      },
      env
    );

    expect(response.status).toBe(409);
  });

  it('returns success payload when shared sync succeeds', async () => {
    vi.mocked(syncUserActivities).mockResolvedValue({
      ok: true,
      statusCode: 200,
      syncType: 'manual',
      syncRunId: 'sync-run-1',
      batchActivitiesFetched: 2,
      totalActivitiesFetched: 2,
      activitiesUpserted: 2,
      totalActivitiesUpserted: 2,
      hasMore: false,
      nextCursorBefore: null,
      estimatedTotalActivities: 2,
      lastSyncedAt: new Date().toISOString(),
      skipped: false,
      skipReason: null,
      error: null
    });

    const token = await createValidToken();
    const response = await app.request(
      '/sync/manual',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token })
      },
      env
    );
    const body = await response.json<{
      ok: boolean;
      syncRunId: string;
      batchActivitiesFetched: number;
      totalActivitiesFetched: number;
      activitiesUpserted: number;
      hasMore: boolean;
    }>();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.syncRunId).toBe('sync-run-1');
    expect(body.totalActivitiesFetched).toBe(2);
  });
});

async function createValidToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return createSignedManualSyncToken(
    {
      userId: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
      iat: nowSeconds,
      exp: nowSeconds + 300,
      nonce: 'sync-route-test',
      action: 'manual_sync'
    },
    env.WORKER_SHARED_SECRET
  );
}

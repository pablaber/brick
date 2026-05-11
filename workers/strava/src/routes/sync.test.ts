import { Hono } from 'hono';
import { createSignedManualSyncToken } from '@workout/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../env.js';
import { syncRoutes } from './sync.js';

const mockState = vi.hoisted(() => ({
  runningSync: null as { id: string } | null,
  runningSyncError: null as { message: string } | null,
  connection: null as {
    user_id: string;
    strava_athlete_id: number;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    scope: string | null;
    last_synced_at: string | null;
    created_at: string;
    updated_at: string;
  } | null,
  connectionError: null as { message: string } | null,
  insertedSyncRunId: 'sync-run-1',
  insertSyncRunError: null as { message: string } | null,
  syncRunsUpdateError: null as { message: string } | null,
  activitiesUpsertError: null as { message: string } | null,
  connectionUpdateError: null as { message: string } | null,
  activities: [] as Array<{ id: number }>,
  shouldRefresh: false,
  refreshedConnection: null as {
    user_id: string;
    strava_athlete_id: number;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    scope: string | null;
    last_synced_at: string | null;
    created_at: string;
    updated_at: string;
  } | null,
  latestSyncRunUpdate: null as Record<string, unknown> | null,
  estimatedTotalActivities: 0
}));

vi.mock('../lib/supabase.js', () => {
  return {
    createServiceSupabaseClient: () => ({
      from: (table: string) => {
        if (table === 'sync_runs') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: mockState.runningSync,
                          error: mockState.runningSyncError
                        })
                      })
                    })
                  })
                })
              })
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: mockState.insertSyncRunError
                    ? null
                    : {
                        id: mockState.insertedSyncRunId,
                        user_id: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
                        status: 'running',
                        activities_fetched: 0
                      },
                  error: mockState.insertSyncRunError
                })
              })
            }),
            update: (values: Record<string, unknown>) => ({
              eq: async () => {
                mockState.latestSyncRunUpdate = values;
                return { error: mockState.syncRunsUpdateError };
              }
            })
          };
        }

        if (table === 'strava_connections') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: mockState.connection,
                  error: mockState.connectionError
                })
              })
            }),
            update: () => ({
              eq: async () => ({
                error: mockState.connectionUpdateError
              })
            })
          };
        }

        if (table === 'activities') {
          return {
            upsert: async () => ({ error: mockState.activitiesUpsertError })
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }
    })
  };
});

vi.mock('../lib/strava-api.js', () => {
  return {
    fetchStravaActivities: vi.fn(async () => mockState.activities),
    fetchStravaActivityTotalCount: vi.fn(async () => mockState.estimatedTotalActivities)
  };
});

vi.mock('../lib/strava-token.js', () => {
  return {
    isTokenExpiredOrExpiringSoon: vi.fn(() => mockState.shouldRefresh),
    refreshStravaToken: vi.fn(async () => {
      if (!mockState.refreshedConnection) {
        throw new Error('No refreshed connection');
      }
      return mockState.refreshedConnection;
    })
  };
});

const env: Env = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'strava-secret',
  STRAVA_REDIRECT_URI: 'http://localhost:8787/strava/callback',
  APP_URL: 'http://localhost:5173',
  WORKER_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
};

const app = new Hono<{ Bindings: Env }>();
app.route('/sync', syncRoutes);

function setDefaultConnection() {
  mockState.connection = {
    user_id: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
    strava_athlete_id: 99,
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    scope: 'read,activity:read_all',
    last_synced_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

describe('POST /sync/manual', () => {
  beforeEach(() => {
    mockState.runningSync = null;
    mockState.runningSyncError = null;
    mockState.connection = null;
    mockState.connectionError = null;
    mockState.insertSyncRunError = null;
    mockState.syncRunsUpdateError = null;
    mockState.activitiesUpsertError = null;
    mockState.connectionUpdateError = null;
    mockState.activities = [];
    mockState.shouldRefresh = false;
    mockState.refreshedConnection = null;
    mockState.latestSyncRunUpdate = null;
    mockState.estimatedTotalActivities = 0;
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

  it('rejects expired token', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await createSignedManualSyncToken(
      {
        userId: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
        iat: nowSeconds - 600,
        exp: nowSeconds - 10,
        nonce: 'expired-nonce',
        action: 'manual_sync'
      },
      env.WORKER_SHARED_SECRET
    );

    const response = await app.request(
      '/sync/manual',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token })
      },
      env
    );

    expect(response.status).toBe(401);
  });

  it('returns 400 when no Strava connection exists', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await createSignedManualSyncToken(
      {
        userId: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
        iat: nowSeconds,
        exp: nowSeconds + 300,
        nonce: 'no-connection',
        action: 'manual_sync'
      },
      env.WORKER_SHARED_SECRET
    );

    const response = await app.request(
      '/sync/manual',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token })
      },
      env
    );
    const body = await response.json<{ ok: boolean; error: string }>();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('No Strava connection found');
    expect(mockState.latestSyncRunUpdate?.status).toBe('failed');
  });

  it('returns success when sync flow succeeds', async () => {
    setDefaultConnection();
    mockState.activities = [{ id: 101 }, { id: 202 }];

    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await createSignedManualSyncToken(
      {
        userId: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
        iat: nowSeconds,
        exp: nowSeconds + 300,
        nonce: 'success',
        action: 'manual_sync'
      },
      env.WORKER_SHARED_SECRET
    );

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
      nextCursorBefore: number | null;
      estimatedTotalActivities: number;
      lastSyncedAt: string;
    }>();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.syncRunId).toBe('sync-run-1');
    expect(body.batchActivitiesFetched).toBe(2);
    expect(body.totalActivitiesFetched).toBe(2);
    expect(body.activitiesUpserted).toBe(2);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursorBefore).toBeNull();
    expect(body.estimatedTotalActivities).toBe(0);
    expect(body.lastSyncedAt).toBeTruthy();
    expect(mockState.latestSyncRunUpdate?.status).toBe('success');
  });
});

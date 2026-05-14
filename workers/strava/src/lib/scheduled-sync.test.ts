import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../env.js';
import { findUsersDueForScheduledSync, runScheduledSync } from './scheduled-sync.js';
import { syncUserActivities } from './sync.js';

const mockState = vi.hoisted(() => ({
  connections: [] as Array<{
    user_id: string;
    last_synced_at: string | null;
    access_token: string | null;
    refresh_token: string | null;
    expires_at: string | null;
    deauthorized_at: string | null;
  }>
}));

vi.mock('./supabase.js', () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table !== 'strava_connections') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: () => ({
          order: () => ({
            limit: async () => ({
              data: mockState.connections,
              error: null
            })
          })
        })
      };
    }
  })
}));

vi.mock('./sync.js', () => ({
  syncUserActivities: vi.fn()
}));

const env: Env = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SECRET_KEY: 'secret-key',
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'strava-secret',
  STRAVA_REDIRECT_URI: 'http://localhost:8787/strava/callback',
  STRAVA_WEBHOOK_VERIFY_TOKEN: 'verify-token',
  STRAVA_WEBHOOK_SIGNING_SECRET: 'webhook-signing-secret',
  APP_URL: 'http://localhost:5173',
  WORKER_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
};

const controller = {
  cron: '0 */6 * * *',
  scheduledTime: Date.now(),
  type: 'scheduled'
} as unknown as ScheduledController;

describe('findUsersDueForScheduledSync', () => {
  beforeEach(() => {
    mockState.connections = [];
  });

  it('includes users with null last_synced_at', async () => {
    mockState.connections = [connectedRow({ user_id: 'u1', last_synced_at: null })];

    const result = await findUsersDueForScheduledSync({
      env,
      now: new Date('2026-05-11T20:00:00.000Z'),
      minSyncIntervalHours: 6
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.userId).toBe('u1');
  });

  it('excludes users synced within min interval', async () => {
    mockState.connections = [
      connectedRow({ user_id: 'u1', last_synced_at: '2026-05-11T18:30:00.000Z' }),
      connectedRow({ user_id: 'u2', last_synced_at: '2026-05-11T10:00:00.000Z' })
    ];

    const result = await findUsersDueForScheduledSync({
      env,
      now: new Date('2026-05-11T20:00:00.000Z'),
      minSyncIntervalHours: 6
    });

    expect(result.map((row) => row.userId)).toEqual(['u2']);
  });

  it('respects limit', async () => {
    mockState.connections = [
      connectedRow({ user_id: 'u1', last_synced_at: null }),
      connectedRow({ user_id: 'u2', last_synced_at: null }),
      connectedRow({ user_id: 'u3', last_synced_at: null })
    ];

    const result = await findUsersDueForScheduledSync({
      env,
      now: new Date('2026-05-11T20:00:00.000Z'),
      limit: 2
    });

    expect(result).toHaveLength(2);
  });

  it('excludes deauthorized or missing-token connections', async () => {
    mockState.connections = [
      connectedRow({ user_id: 'u1', last_synced_at: null }),
      {
        ...connectedRow({ user_id: 'u2', last_synced_at: null }),
        deauthorized_at: '2026-05-01T00:00:00Z'
      },
      { ...connectedRow({ user_id: 'u3', last_synced_at: null }), access_token: null },
      { ...connectedRow({ user_id: 'u4', last_synced_at: null }), refresh_token: null },
      { ...connectedRow({ user_id: 'u5', last_synced_at: null }), expires_at: null }
    ];

    const result = await findUsersDueForScheduledSync({
      env,
      now: new Date('2026-05-11T20:00:00.000Z')
    });

    expect(result.map((row) => row.userId)).toEqual(['u1']);
  });
});

describe('runScheduledSync', () => {
  beforeEach(() => {
    mockState.connections = [
      connectedRow({ user_id: 'u1', last_synced_at: null }),
      connectedRow({ user_id: 'u2', last_synced_at: null })
    ];
    vi.mocked(syncUserActivities).mockReset();
  });

  it('continues processing users when one fails', async () => {
    vi.mocked(syncUserActivities)
      .mockResolvedValueOnce({
        ok: false,
        statusCode: 500,
        syncType: 'scheduled',
        syncRunId: 'run-1',
        batchActivitiesFetched: 0,
        totalActivitiesFetched: 0,
        activitiesUpserted: 0,
        totalActivitiesUpserted: 0,
        hasMore: false,
        nextCursorBefore: null,
        estimatedTotalActivities: null,
        lastSyncedAt: null,
        skipped: false,
        skipReason: null,
        error: 'boom'
      })
      .mockResolvedValueOnce({
        ok: true,
        statusCode: 200,
        syncType: 'scheduled',
        syncRunId: 'run-2',
        batchActivitiesFetched: 10,
        totalActivitiesFetched: 10,
        activitiesUpserted: 10,
        totalActivitiesUpserted: 10,
        hasMore: false,
        nextCursorBefore: null,
        estimatedTotalActivities: 10,
        lastSyncedAt: '2026-05-11T20:00:00.000Z',
        skipped: false,
        skipReason: null,
        error: null
      });

    const summary = await runScheduledSync({
      env,
      controller,
      now: new Date('2026-05-11T20:00:00.000Z')
    });

    expect(summary.usersConsidered).toBe(2);
    expect(summary.usersFailed).toBe(1);
    expect(summary.usersSynced).toBe(1);
  });

  it('continues a paginated scheduled sync until the run completes', async () => {
    mockState.connections = [connectedRow({ user_id: 'u1', last_synced_at: null })];
    vi.mocked(syncUserActivities)
      .mockResolvedValueOnce({
        ok: true,
        statusCode: 200,
        syncType: 'scheduled',
        syncRunId: 'run-1',
        batchActivitiesFetched: 100,
        totalActivitiesFetched: 100,
        activitiesUpserted: 100,
        totalActivitiesUpserted: 100,
        hasMore: true,
        nextCursorBefore: 1_778_832_000,
        estimatedTotalActivities: 250,
        lastSyncedAt: null,
        skipped: false,
        skipReason: null,
        error: null
      })
      .mockResolvedValueOnce({
        ok: true,
        statusCode: 200,
        syncType: 'scheduled',
        syncRunId: 'run-1',
        batchActivitiesFetched: 75,
        totalActivitiesFetched: 175,
        activitiesUpserted: 75,
        totalActivitiesUpserted: 175,
        hasMore: false,
        nextCursorBefore: null,
        estimatedTotalActivities: 250,
        lastSyncedAt: '2026-05-11T20:00:00.000Z',
        skipped: false,
        skipReason: null,
        error: null
      });

    const summary = await runScheduledSync({
      env,
      controller,
      now: new Date('2026-05-11T20:00:00.000Z')
    });

    expect(summary.usersSynced).toBe(1);
    expect(summary.usersFailed).toBe(0);
    expect(syncUserActivities).toHaveBeenCalledTimes(2);
    expect(syncUserActivities).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        cursorBefore: 1_778_832_000,
        requestedSyncRunId: 'run-1',
        estimatedTotalActivities: 250
      })
    );
  });

  it('counts skipped users in summary', async () => {
    mockState.connections = [connectedRow({ user_id: 'u1', last_synced_at: null })];
    vi.mocked(syncUserActivities).mockResolvedValue({
      ok: true,
      statusCode: 200,
      syncType: 'scheduled',
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

    const summary = await runScheduledSync({
      env,
      controller,
      now: new Date('2026-05-11T20:00:00.000Z')
    });

    expect(summary.usersSkipped).toBe(1);
    expect(summary.usersSynced).toBe(0);
    expect(summary.usersFailed).toBe(0);
  });
});

function connectedRow({
  user_id,
  last_synced_at
}: {
  user_id: string;
  last_synced_at: string | null;
}) {
  return {
    user_id,
    last_synced_at,
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_at: '2099-01-01T00:00:00.000Z',
    deauthorized_at: null
  };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../env.js';
import { findUsersDueForScheduledSync, runScheduledSync } from './scheduled-sync.js';
import { syncUserActivities } from './sync.js';

const mockState = vi.hoisted(() => ({
  connections: [] as Array<{ user_id: string; last_synced_at: string | null }>
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
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'strava-secret',
  STRAVA_REDIRECT_URI: 'http://localhost:8787/strava/callback',
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
    mockState.connections = [{ user_id: 'u1', last_synced_at: null }];

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
      { user_id: 'u1', last_synced_at: '2026-05-11T18:30:00.000Z' },
      { user_id: 'u2', last_synced_at: '2026-05-11T10:00:00.000Z' }
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
      { user_id: 'u1', last_synced_at: null },
      { user_id: 'u2', last_synced_at: null },
      { user_id: 'u3', last_synced_at: null }
    ];

    const result = await findUsersDueForScheduledSync({
      env,
      now: new Date('2026-05-11T20:00:00.000Z'),
      limit: 2
    });

    expect(result).toHaveLength(2);
  });
});

describe('runScheduledSync', () => {
  beforeEach(() => {
    mockState.connections = [
      { user_id: 'u1', last_synced_at: null },
      { user_id: 'u2', last_synced_at: null }
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

  it('counts skipped users in summary', async () => {
    mockState.connections = [{ user_id: 'u1', last_synced_at: null }];
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

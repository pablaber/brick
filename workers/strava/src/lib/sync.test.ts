import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../env.js';
import { syncUserActivities } from './sync.js';

const mockState = vi.hoisted(() => ({
  insertPayloads: [] as Array<Record<string, unknown>>
}));

vi.mock('./supabase.js', () => ({
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
                        data: null,
                        error: null
                      })
                    })
                  })
                })
              })
            })
          }),
          insert: (payload: Record<string, unknown>) => {
            mockState.insertPayloads.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'sync-run-1',
                    user_id: payload.user_id,
                    status: 'running',
                    activities_fetched: 0,
                    activities_upserted: 0
                  },
                  error: null
                })
              })
            };
          },
          update: () => ({
            eq: async () => ({ error: null })
          })
        };
      }

      if (table === 'strava_connections') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: null
              })
            })
          })
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }
  })
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

describe('syncUserActivities sync_type inserts', () => {
  it('inserts manual sync_run with sync_type=manual', async () => {
    mockState.insertPayloads = [];

    await syncUserActivities({
      env,
      userId: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
      syncType: 'manual',
      triggeredBy: 'manual-route'
    });

    expect(mockState.insertPayloads[0]?.sync_type).toBe('manual');
  });

  it('inserts scheduled sync_run with sync_type=scheduled', async () => {
    mockState.insertPayloads = [];

    await syncUserActivities({
      env,
      userId: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
      syncType: 'scheduled',
      triggeredBy: 'cron'
    });

    expect(mockState.insertPayloads[0]?.sync_type).toBe('scheduled');
  });
});

import { createSignedConnectToken } from '@brick/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  oauthStateRow: null as {
    id: string;
    user_id: string;
    provider: string;
    state: string;
    expires_at: string;
    used_at: string | null;
  } | null,
  selectError: null as { message: string } | null,
  insertError: null as { message: string } | null,
  existingActiveConnectionRows: [] as Array<{ user_id: string }>,
  connectionSelectError: null as { message: string } | null,
  refreshedExistingConnectionUserIds: [] as string[],
  connectionUpdateError: null as { message: string } | null,
  upsertError: null as { message: string; code?: string } | null,
  updateError: null as { message: string } | null
}));

vi.mock('./lib/supabase.js', () => {
  return {
    createServiceSupabaseClient: () => ({
      from: (table: string) => {
        if (table === 'oauth_states') {
          return {
            insert: async () => ({ error: mockState.insertError }),
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: mockState.oauthStateRow,
                    error: mockState.selectError
                  })
                })
              })
            }),
            update: () => ({
              eq: async () => ({ error: mockState.updateError })
            })
          };
        }

        if (table === 'strava_connections') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  neq: () => ({
                    limit: async () => ({
                      data: mockState.existingActiveConnectionRows,
                      error: mockState.connectionSelectError
                    })
                  })
                })
              })
            }),
            update: () => ({
              eq: async (_column: string, userId: string) => {
                mockState.refreshedExistingConnectionUserIds.push(userId);
                return { error: mockState.connectionUpdateError };
              }
            }),
            upsert: async () => ({ error: mockState.upsertError })
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }
    })
  };
});

vi.mock('./lib/strava-oauth.js', () => {
  return {
    buildStravaAuthorizeUrl: vi.fn(() => 'https://www.strava.com/oauth/authorize?mock=true'),
    exchangeStravaCodeForToken: vi.fn(async () => ({
      token_type: 'Bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      refresh_token: 'refresh-token',
      access_token: 'access-token',
      scope: 'read,activity:read_all',
      athlete: {
        id: 123
      }
    }))
  };
});

const scheduledSpy = vi.hoisted(() => vi.fn(async () => ({ ok: true })));

vi.mock('./lib/scheduled-sync.js', () => ({
  runScheduledSync: scheduledSpy
}));

import worker from './index.js';

const env = {
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

describe('strava worker routes', () => {
  beforeEach(() => {
    mockState.oauthStateRow = null;
    mockState.selectError = null;
    mockState.insertError = null;
    mockState.existingActiveConnectionRows = [];
    mockState.connectionSelectError = null;
    mockState.refreshedExistingConnectionUserIds = [];
    mockState.connectionUpdateError = null;
    mockState.upsertError = null;
    mockState.updateError = null;
  });

  it('GET /health returns a healthy response', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/health'),
      env,
      {} as ExecutionContext
    );
    const body = await response.json<{
      ok: boolean;
      service: string;
    }>();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe('strava-worker');
  });

  it('GET /strava/connect rejects missing token', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/strava/connect'),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(400);
  });

  it('GET /strava/connect rejects invalid signed token', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/strava/connect?token=invalid-token'),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(401);
  });

  it('GET /strava/connect redirects to Strava for a valid token', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await createSignedConnectToken(
      {
        userId: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
        iat: nowSeconds,
        exp: nowSeconds + 300,
        nonce: 'nonce-1'
      },
      env.WORKER_SHARED_SECRET
    );
    const response = await worker.fetch(
      new Request(`http://localhost/strava/connect?token=${encodeURIComponent(token)}`),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('www.strava.com/oauth/authorize');
  });

  it('GET /strava/callback rejects missing state', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/strava/callback?code=test-code'),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://localhost:5173/settings?strava=invalid_state'
    );
  });

  it('GET /strava/callback rejects missing code', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/strava/callback?state=test-state'),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://localhost:5173/settings?strava=error');
  });

  it('GET /strava/callback rejects expired state', async () => {
    mockState.oauthStateRow = {
      id: 'cd86db74-c84d-4402-8c90-6198d250a84f',
      user_id: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
      provider: 'strava',
      state: 'expired-state',
      expires_at: new Date(Date.now() - 1_000).toISOString(),
      used_at: null
    };
    const response = await worker.fetch(
      new Request('http://localhost/strava/callback?state=expired-state&code=test-code'),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://localhost:5173/settings?strava=invalid_state'
    );
  });

  it('GET /strava/callback handles Strava denial', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/strava/callback?error=access_denied'),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://localhost:5173/settings?strava=denied');
  });

  it('GET /strava/callback rejects Strava accounts connected to another user', async () => {
    mockState.oauthStateRow = {
      id: 'cd86db74-c84d-4402-8c90-6198d250a84f',
      user_id: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
      provider: 'strava',
      state: 'valid-state',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: null
    };
    mockState.existingActiveConnectionRows = [{ user_id: 'other-user' }];

    const response = await worker.fetch(
      new Request('http://localhost/strava/callback?state=valid-state&code=test-code'),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(302);
    expect(mockState.refreshedExistingConnectionUserIds).toEqual(['other-user']);
    expect(response.headers.get('location')).toBe(
      'http://localhost:5173/settings?strava=already_connected'
    );
  });

  it('GET /strava/callback maps active Strava athlete uniqueness conflicts to already connected', async () => {
    mockState.oauthStateRow = {
      id: 'cd86db74-c84d-4402-8c90-6198d250a84f',
      user_id: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
      provider: 'strava',
      state: 'valid-state',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: null
    };
    mockState.upsertError = {
      message: 'duplicate key value violates unique constraint',
      code: '23505'
    };
    mockState.existingActiveConnectionRows = [{ user_id: 'other-user' }];

    const response = await worker.fetch(
      new Request('http://localhost/strava/callback?state=valid-state&code=test-code'),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(302);
    expect(mockState.refreshedExistingConnectionUserIds).toEqual(['other-user']);
    expect(response.headers.get('location')).toBe(
      'http://localhost:5173/settings?strava=already_connected'
    );
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await worker.fetch(
      new Request('http://localhost/unknown'),
      env,
      {} as ExecutionContext
    );
    const body = await response.json<{
      ok: boolean;
      error: string;
    }>();

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Not found');
  });

  it('scheduled handler calls runScheduledSync', async () => {
    const waitUntil = vi.fn();
    await worker.scheduled(
      {
        cron: '0 */6 * * *',
        scheduledTime: Date.now(),
        type: 'scheduled'
      } as unknown as ScheduledController,
      env,
      { waitUntil } as unknown as ExecutionContext
    );

    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(scheduledSpy).toHaveBeenCalledTimes(1);
  });
});

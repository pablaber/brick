import { describe, expect, it, vi } from 'vitest';

import { isTokenExpiredOrExpiringSoon, refreshStravaToken } from './strava-token.js';

describe('isTokenExpiredOrExpiringSoon', () => {
  it('returns true for expired token', () => {
    const expiresAt = new Date(Date.now() - 1_000).toISOString();

    expect(isTokenExpiredOrExpiringSoon(expiresAt)).toBe(true);
  });

  it('returns true for token expiring within five minutes', () => {
    const expiresAt = new Date(Date.now() + 4 * 60 * 1000).toISOString();

    expect(isTokenExpiredOrExpiringSoon(expiresAt)).toBe(true);
  });

  it('returns false for token expiring later than five minutes', () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    expect(isTokenExpiredOrExpiringSoon(expiresAt)).toBe(false);
  });
});

describe('refreshStravaToken', () => {
  it('refreshes token and persists new values', async () => {
    const updateValues: Array<Record<string, unknown>> = [];
    const supabase = {
      from: (table: string) => {
        expect(table).toBe('strava_connections');

        return {
          update: (values: Record<string, unknown>) => {
            updateValues.push(values);
            return {
              eq: async () => ({ error: null })
            };
          }
        };
      }
    };

    const responsePayload = {
      token_type: 'Bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      refresh_token: 'new-refresh-token',
      access_token: 'new-access-token',
      scope: 'read,activity:read_all',
      athlete: { id: 99 }
    };

    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(responsePayload), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    );

    const connection = {
      user_id: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
      strava_athlete_id: 99,
      access_token: 'old-access-token',
      refresh_token: 'old-refresh-token',
      expires_at: new Date(Date.now() - 1_000).toISOString(),
      scope: 'read',
      last_synced_at: null,
      webhook_events_received_at: null,
      last_webhook_event_at: null,
      deauthorized_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const refreshed = await refreshStravaToken({
      env: {
        STRAVA_CLIENT_ID: '12345',
        STRAVA_CLIENT_SECRET: 'secret'
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      connection,
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(updateValues).toHaveLength(1);
    expect(refreshed.access_token).toBe('new-access-token');
    expect(refreshed.refresh_token).toBe('new-refresh-token');
  });

  it('accepts refresh token responses without athlete payload', async () => {
    const updateValues: Array<Record<string, unknown>> = [];
    const supabase = {
      from: (table: string) => {
        expect(table).toBe('strava_connections');

        return {
          update: (values: Record<string, unknown>) => {
            updateValues.push(values);
            return {
              eq: async () => ({ error: null })
            };
          }
        };
      }
    };

    const responsePayload = {
      token_type: 'Bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      refresh_token: 'new-refresh-token',
      access_token: 'new-access-token',
      scope: 'read,activity:read_all'
    };

    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(responsePayload), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    );

    const connection = {
      user_id: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
      strava_athlete_id: 99,
      access_token: 'old-access-token',
      refresh_token: 'old-refresh-token',
      expires_at: new Date(Date.now() - 1_000).toISOString(),
      scope: 'read',
      last_synced_at: null,
      webhook_events_received_at: null,
      last_webhook_event_at: null,
      deauthorized_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const refreshed = await refreshStravaToken({
      env: {
        STRAVA_CLIENT_ID: '12345',
        STRAVA_CLIENT_SECRET: 'secret'
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      connection,
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(updateValues).toHaveLength(1);
    expect(refreshed.access_token).toBe('new-access-token');
    expect(refreshed.refresh_token).toBe('new-refresh-token');
  });
});

import type { Database } from '@brick/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchActivityMock = vi.hoisted(() => vi.fn());

vi.mock('./strava-api.js', async () => {
  const actual = await vi.importActual<typeof import('./strava-api.js')>('./strava-api.js');
  return {
    ...actual,
    fetchStravaActivityById: fetchActivityMock
  };
});

import type { Env } from '../env.js';
import { StravaApiStatusError } from './strava-api.js';
import {
  processStravaWebhookEvent,
  parseStravaWebhookEventPayload,
  type StravaWebhookEvent
} from './strava-webhook.js';

const env: Env = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SECRET_KEY: 'secret-key',
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'strava-secret',
  STRAVA_REDIRECT_URI: 'http://localhost:8787/strava/callback',
  STRAVA_WEBHOOK_VERIFY_TOKEN: 'verify-token',
  STRAVA_WEBHOOK_SIGNING_SECRET: 'signing-secret',
  APP_URL: 'http://localhost:5173',
  WORKER_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
};

describe('parseStravaWebhookEventPayload', () => {
  it('rejects invalid payloads', () => {
    expect(() => parseStravaWebhookEventPayload(null)).toThrow();
    expect(() => parseStravaWebhookEventPayload({ object_type: 'activity' })).toThrow();
  });
});

describe('processStravaWebhookEvent', () => {
  beforeEach(() => {
    fetchActivityMock.mockReset();
  });

  it('marks unknown owner events as ignored', async () => {
    const state = createState();
    const supabase = createMockSupabase(state);

    await processStravaWebhookEvent({
      env,
      eventId: 'event-1',
      userId: null,
      event: baseEvent({ aspect_type: 'create' }),
      supabase
    });

    expect(state.webhookUpdates['event-1']?.processing_status).toBe('ignored');
  });

  it('processes activity create with targeted fetch and upsert', async () => {
    const state = createState();
    const supabase = createMockSupabase(state);
    fetchActivityMock.mockResolvedValue({
      id: 123,
      name: 'Morning Run',
      sport_type: 'Run',
      start_date: '2026-05-10T10:00:00Z'
    });

    await processStravaWebhookEvent({
      env,
      eventId: 'event-1',
      userId: 'user-1',
      event: baseEvent({ object_id: 123, aspect_type: 'create' }),
      supabase
    });

    expect(fetchActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 123, accessToken: 'access-token' })
    );
    expect(state.upsertedActivities).toHaveLength(1);
    expect(state.webhookUpdates['event-1']?.processing_status).toBe('processed');
  });

  it('processes activity update with targeted fetch and upsert', async () => {
    const state = createState();
    const supabase = createMockSupabase(state);
    fetchActivityMock.mockResolvedValue({
      id: 123,
      name: 'Updated Name',
      sport_type: 'Run',
      start_date: '2026-05-10T10:00:00Z'
    });

    await processStravaWebhookEvent({
      env,
      eventId: 'event-2',
      userId: 'user-1',
      event: baseEvent({ object_id: 123, aspect_type: 'update' }),
      supabase
    });

    expect(state.upsertedActivities).toHaveLength(1);
    expect(state.webhookUpdates['event-2']?.processing_status).toBe('processed');
  });

  it('deletes local activity on update when fetch returns 404', async () => {
    const state = createState();
    const supabase = createMockSupabase(state);
    fetchActivityMock.mockRejectedValue(new StravaApiStatusError(404, 'missing'));

    await processStravaWebhookEvent({
      env,
      eventId: 'event-3',
      userId: 'user-1',
      event: baseEvent({ object_id: 222, aspect_type: 'update' }),
      supabase
    });

    expect(state.deletedActivities).toContainEqual({
      userId: 'user-1',
      stravaActivityId: 222
    });
    expect(state.webhookUpdates['event-3']?.processing_status).toBe('processed');
  });

  it('deletes local activity on privacy-related 403 update', async () => {
    const state = createState();
    const supabase = createMockSupabase(state);
    fetchActivityMock.mockRejectedValue(new StravaApiStatusError(403, 'forbidden'));

    await processStravaWebhookEvent({
      env,
      eventId: 'event-4',
      userId: 'user-1',
      event: baseEvent({ object_id: 333, aspect_type: 'update', updates: { private: 'true' } }),
      supabase
    });

    expect(state.deletedActivities).toContainEqual({
      userId: 'user-1',
      stravaActivityId: 333
    });
    expect(state.webhookUpdates['event-4']?.processing_status).toBe('processed');
  });

  it('marks unrelated 403 update events as failed', async () => {
    const state = createState();
    const userConnection = state.connectionsByUser['user-1'];
    if (!userConnection) {
      throw new Error('Missing test connection row.');
    }
    userConnection.scope = 'read,activity:read_all';
    const supabase = createMockSupabase(state);
    fetchActivityMock.mockRejectedValue(new StravaApiStatusError(403, 'forbidden'));

    await processStravaWebhookEvent({
      env,
      eventId: 'event-5',
      userId: 'user-1',
      event: baseEvent({ object_id: 444, aspect_type: 'update', updates: { title: 'x' } }),
      supabase
    });

    expect(state.deletedActivities).toHaveLength(0);
    expect(state.webhookUpdates['event-5']?.processing_status).toBe('failed');
  });

  it('deletes local row for activity delete event without Strava fetch', async () => {
    const state = createState();
    const supabase = createMockSupabase(state);

    await processStravaWebhookEvent({
      env,
      eventId: 'event-6',
      userId: 'user-1',
      event: baseEvent({ object_id: 555, aspect_type: 'delete' }),
      supabase
    });

    expect(fetchActivityMock).not.toHaveBeenCalled();
    expect(state.deletedActivities).toContainEqual({
      userId: 'user-1',
      stravaActivityId: 555
    });
    expect(state.webhookUpdates['event-6']?.processing_status).toBe('processed');
  });

  it('handles deauthorization by nulling token fields and setting deauthorized_at', async () => {
    const state = createState();
    const supabase = createMockSupabase(state);

    await processStravaWebhookEvent({
      env,
      eventId: 'event-7',
      userId: null,
      event: {
        object_type: 'athlete',
        object_id: 134_815,
        aspect_type: 'update',
        owner_id: 134_815,
        subscription_id: 120_475,
        event_time: 1_716_126_040,
        updates: { authorized: 'false' }
      },
      supabase
    });

    const connection = state.connectionsByUser['user-1'];
    if (!connection) {
      throw new Error('Missing test connection row.');
    }
    expect(connection.access_token).toBeNull();
    expect(connection.refresh_token).toBeNull();
    expect(connection.expires_at).toBeNull();
    expect(connection.deauthorized_at).not.toBeNull();
    expect(state.webhookUpdates['event-7']?.processing_status).toBe('processed');
  });
});

type MockState = {
  webhookUpdates: Record<
    string,
    {
      processing_status?: string;
      processed_at?: string | null;
      processing_error?: string | null;
    }
  >;
  connectionsByUser: Record<string, StravaConnection>;
  deletedActivities: Array<{ userId: string; stravaActivityId: number }>;
  upsertedActivities: Array<Record<string, unknown>>;
};

type StravaConnection = {
  user_id: string;
  strava_athlete_id: number;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  deauthorized_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  webhook_events_received_at: string | null;
  last_webhook_event_at: string | null;
};

function createState(): MockState {
  return {
    webhookUpdates: {},
    deletedActivities: [],
    upsertedActivities: [],
    connectionsByUser: {
      'user-1': {
        user_id: 'user-1',
        strava_athlete_id: 134_815,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: '2099-01-01T00:00:00.000Z',
        scope: 'read,activity:read_all',
        deauthorized_at: null,
        last_synced_at: null,
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: '2026-05-01T00:00:00.000Z',
        webhook_events_received_at: null,
        last_webhook_event_at: null
      }
    }
  };
}

function createMockSupabase(state: MockState): SupabaseClient<Database> {
  const client = {
    from: (table: string) => {
      if (table === 'strava_webhook_events') {
        return {
          update: (values: Record<string, unknown>) => ({
            eq: async (_column: string, eventId: string) => {
              state.webhookUpdates[eventId] = {
                ...(state.webhookUpdates[eventId] ?? {}),
                ...values
              };
              return { error: null };
            }
          })
        };
      }

      if (table === 'strava_connections') {
        return {
          select: () => ({
            eq: (column: string, value: string | number) => ({
              maybeSingle: async () => {
                if (column === 'user_id') {
                  return { data: state.connectionsByUser[value as string] ?? null, error: null };
                }

                if (column === 'strava_athlete_id') {
                  const match = Object.values(state.connectionsByUser).find(
                    (row) => row.strava_athlete_id === value
                  );
                  return { data: match ? { user_id: match.user_id } : null, error: null };
                }

                return { data: null, error: null };
              }
            })
          }),
          update: (values: Record<string, unknown>) => ({
            eq: async (_column: string, userId: string) => {
              const existing = state.connectionsByUser[userId];
              if (!existing) {
                return { error: null };
              }
              state.connectionsByUser[userId] = {
                ...existing,
                ...(values as Partial<StravaConnection>)
              };
              return { error: null };
            }
          })
        };
      }

      if (table === 'activities') {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            state.upsertedActivities.push(payload);
            return { error: null };
          },
          delete: () => ({
            eq: (_column: string, userId: string) => ({
              eq: async (_column2: string, stravaActivityId: number) => {
                state.deletedActivities.push({ userId, stravaActivityId });
                return { error: null };
              }
            })
          })
        };
      }

      throw new Error(`Unexpected table mock: ${table}`);
    }
  };

  return client as unknown as SupabaseClient<Database>;
}

function baseEvent(overrides: Partial<StravaWebhookEvent>): StravaWebhookEvent {
  return {
    object_type: 'activity',
    object_id: 123,
    aspect_type: 'create',
    owner_id: 134_815,
    subscription_id: 120_475,
    event_time: 1_716_126_040,
    updates: null,
    ...overrides
  };
}

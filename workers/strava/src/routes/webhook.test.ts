import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../env.js';
import { webhookRoutes } from './webhook.js';

const mockState = vi.hoisted(() => ({
  signatureValid: true,
  connectionUserId: 'user-1' as string | null,
  insertError: null as { code?: string; message?: string } | null,
  insertedEventId: 'event-1',
  insertedRows: [] as Array<Record<string, unknown>>,
  processCalls: [] as Array<{ eventId: string; userId: string | null }>
}));

vi.mock('../lib/webhook-signature.js', () => ({
  verifyStravaWebhookSignature: vi.fn(async () => mockState.signatureValid)
}));

vi.mock('../lib/strava-webhook.js', () => ({
  parseStravaWebhookEventPayload: vi.fn((raw: unknown) => {
    const payload = raw as Record<string, unknown>;
    return {
      object_type: payload.object_type,
      object_id: payload.object_id,
      aspect_type: payload.aspect_type,
      owner_id: payload.owner_id,
      subscription_id: payload.subscription_id ?? null,
      event_time: payload.event_time ?? null,
      updates: payload.updates ?? null
    };
  }),
  createWebhookEventKey: vi.fn(async () => 'event-key-1'),
  resolveConnectionForOwner: vi.fn(async () => ({
    userId: mockState.connectionUserId,
    connection: mockState.connectionUserId ? { user_id: mockState.connectionUserId } : null
  })),
  processStravaWebhookEvent: vi.fn(async (args: { eventId: string; userId: string | null }) => {
    mockState.processCalls.push({ eventId: args.eventId, userId: args.userId });
  })
}));

vi.mock('../lib/supabase.js', () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'strava_webhook_events') {
        return {
          insert: (payload: Record<string, unknown>) => {
            mockState.insertedRows.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: mockState.insertedEventId },
                  error: mockState.insertError
                })
              })
            };
          }
        };
      }

      if (table === 'strava_connections') {
        return {
          update: () => ({
            eq: async () => ({ error: null })
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }
  })
}));

const env: Env = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SECRET_KEY: 'secret-key',
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'strava-secret',
  STRAVA_REDIRECT_URI: 'http://localhost:8787/strava/callback',
  STRAVA_WEBHOOK_VERIFY_TOKEN: 'verify-token',
  STRAVA_WEBHOOK_SIGNING_SECRET: 'signing-secret',
  STRAVA_WEBHOOK_DISABLE_SIGNATURE_VERIFICATION: 'false',
  APP_URL: 'http://localhost:5173',
  WORKER_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
};

describe('strava webhook routes', () => {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/strava', webhookRoutes);

  beforeEach(() => {
    mockState.signatureValid = true;
    mockState.connectionUserId = 'user-1';
    mockState.insertError = null;
    mockState.insertedEventId = 'event-1';
    mockState.insertedRows = [];
    mockState.processCalls = [];
  });

  it('GET /strava/webhook verifies challenge and returns 200', async () => {
    const response = await app.request(
      '/strava/webhook?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=verify-token',
      { method: 'GET' },
      env
    );
    const body = await response.json<{ 'hub.challenge': string }>();

    expect(response.status).toBe(200);
    expect(body['hub.challenge']).toBe('abc123');
  });

  it('GET /strava/webhook rejects invalid verify token', async () => {
    const response = await app.request(
      '/strava/webhook?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=wrong-token',
      { method: 'GET' },
      env
    );

    expect(response.status).toBe(403);
  });

  it('POST /strava/webhook returns 500 when signing secret missing', async () => {
    const missingSecretEnv = { ...env, STRAVA_WEBHOOK_SIGNING_SECRET: '' };
    const response = await app.request(
      '/strava/webhook',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-strava-signature': 't=1,v1=abc' },
        body: JSON.stringify(validPayload())
      },
      missingSecretEnv
    );

    expect(response.status).toBe(500);
  });

  it('POST /strava/webhook bypasses signature checks when disabled=true', async () => {
    const signatureDisabledEnv = {
      ...env,
      STRAVA_WEBHOOK_SIGNING_SECRET: '',
      STRAVA_WEBHOOK_DISABLE_SIGNATURE_VERIFICATION: 'true'
    };
    const waitUntil = vi.fn();
    const response = await app.fetch(
      new Request('http://localhost/strava/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validPayload())
      }),
      signatureDisabledEnv,
      { waitUntil } as unknown as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(mockState.insertedRows).toHaveLength(1);
    expect(mockState.insertedRows[0]?.signature_header).toBe('DISABLED');
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('POST /strava/webhook rejects missing signature header', async () => {
    const response = await app.request(
      '/strava/webhook',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validPayload())
      },
      env
    );

    expect(response.status).toBe(401);
  });

  it('POST /strava/webhook rejects invalid signature', async () => {
    mockState.signatureValid = false;

    const response = await app.request(
      '/strava/webhook',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-strava-signature': 't=1,v1=abc' },
        body: JSON.stringify(validPayload())
      },
      env
    );

    expect(response.status).toBe(401);
  });

  it('POST /strava/webhook rejects invalid JSON', async () => {
    const response = await app.request(
      '/strava/webhook',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-strava-signature': 't=1,v1=abc' },
        body: '{invalid-json'
      },
      env
    );

    expect(response.status).toBe(400);
  });

  it('POST /strava/webhook persists valid events and returns 200', async () => {
    const waitUntil = vi.fn();
    const response = await app.fetch(
      new Request('http://localhost/strava/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-strava-signature': 't=1,v1=abc' },
        body: JSON.stringify(validPayload())
      }),
      env,
      { waitUntil } as unknown as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(mockState.insertedRows).toHaveLength(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('POST /strava/webhook returns 200 for duplicate event_key', async () => {
    mockState.insertError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint'
    };

    const waitUntil = vi.fn();
    const response = await app.fetch(
      new Request('http://localhost/strava/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-strava-signature': 't=1,v1=abc' },
        body: JSON.stringify(validPayload())
      }),
      env,
      { waitUntil } as unknown as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(waitUntil).not.toHaveBeenCalled();
  });
});

function validPayload() {
  return {
    aspect_type: 'create',
    event_time: 1_716_126_040,
    object_id: 1_360_128_428,
    object_type: 'activity',
    owner_id: 134_815,
    subscription_id: 120_475
  };
}

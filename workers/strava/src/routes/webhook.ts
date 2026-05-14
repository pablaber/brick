import { Hono } from 'hono';
import type { Database } from '@brick/shared';

import type { Env } from '../env.js';
import {
  createWebhookEventKey,
  parseStravaWebhookEventPayload,
  processStravaWebhookEvent,
  resolveConnectionForOwner
} from '../lib/strava-webhook.js';
import { createServiceSupabaseClient } from '../lib/supabase.js';
import { verifyStravaWebhookSignature } from '../lib/webhook-signature.js';

export const webhookRoutes = new Hono<{ Bindings: Env }>();

type WebhookEventInsert = Database['public']['Tables']['strava_webhook_events']['Insert'];

webhookRoutes.get('/webhook', async (c) => {
  const mode = c.req.query('hub.mode');
  const challenge = c.req.query('hub.challenge');
  const verifyToken = c.req.query('hub.verify_token');

  if (mode !== 'subscribe' || !challenge) {
    return c.json({ ok: false, error: 'Malformed webhook verification request.' }, 400);
  }

  if (!c.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return c.json({ ok: false, error: 'Webhook verify token is not configured.' }, 500);
  }

  if (!verifyToken || verifyToken !== c.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return c.json({ ok: false, error: 'Invalid webhook verification token.' }, 403);
  }

  return c.json({ 'hub.challenge': challenge }, 200);
});

webhookRoutes.post('/webhook', async (c) => {
  const disableSignatureVerification =
    c.env.STRAVA_WEBHOOK_DISABLE_SIGNATURE_VERIFICATION?.trim().toLowerCase() === 'true';
  const signingSecret = c.env.STRAVA_WEBHOOK_SIGNING_SECRET?.trim();
  const signatureHeader = c.req.header('x-strava-signature');

  const rawBody = await c.req.raw.text();

  if (!disableSignatureVerification) {
    if (!signingSecret) {
      return c.json({ ok: false, error: 'Webhook signing secret is not configured.' }, 500);
    }

    if (!signatureHeader) {
      return c.json({ ok: false, error: 'Missing X-Strava-Signature header.' }, 401);
    }

    const isValidSignature = await verifyStravaWebhookSignature({
      signatureHeader,
      rawBody,
      signingSecret
    });

    if (!isValidSignature) {
      return c.json({ ok: false, error: 'Invalid X-Strava-Signature header.' }, 401);
    }
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawBody) as unknown;
  } catch {
    return c.json({ ok: false, error: 'Invalid webhook JSON payload.' }, 400);
  }

  let event;
  try {
    event = parseStravaWebhookEventPayload(rawJson);
  } catch {
    return c.json({ ok: false, error: 'Invalid webhook payload shape.' }, 400);
  }

  const supabase = createServiceSupabaseClient(c.env);
  const nowIso = new Date().toISOString();
  const eventTimeIso = event.event_time ? new Date(event.event_time * 1000).toISOString() : null;

  let connectionUserId: string | null = null;
  try {
    const resolvedConnection = await resolveConnectionForOwner({
      env: c.env,
      ownerId: event.owner_id,
      supabase
    });
    connectionUserId = resolvedConnection.userId;
  } catch (error) {
    console.error('Failed to resolve webhook owner connection.', error);
    return c.json({ ok: false, error: 'Unable to resolve webhook owner.' }, 500);
  }

  let eventKey: string;
  try {
    eventKey = await createWebhookEventKey(event);
  } catch (error) {
    console.error('Failed to compute webhook event key.', error);
    return c.json({ ok: false, error: 'Unable to compute webhook event key.' }, 500);
  }

  const insertPayload: WebhookEventInsert = {
    event_key: eventKey,
    user_id: connectionUserId ?? undefined,
    object_type: event.object_type,
    object_id: event.object_id,
    aspect_type: event.aspect_type,
    owner_id: event.owner_id,
    subscription_id: event.subscription_id,
    event_time: eventTimeIso,
    updates: event.updates as WebhookEventInsert['updates'],
    raw_json: rawJson as WebhookEventInsert['raw_json'],
    signature_header: signatureHeader ?? 'DISABLED',
    received_at: nowIso,
    processing_status: 'pending'
  };

  const { data: persistedEvent, error: insertError } = await supabase
    .from('strava_webhook_events')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError) {
    if (isUniqueConstraintViolation(insertError)) {
      return c.json({ ok: true }, 200);
    }

    console.error('Failed to persist webhook event.', insertError);
    return c.json({ ok: false, error: 'Unable to persist webhook event.' }, 500);
  }

  if (connectionUserId) {
    const { error: updateConnectionError } = await supabase
      .from('strava_connections')
      .update({
        webhook_events_received_at: nowIso,
        last_webhook_event_at: eventTimeIso ?? nowIso,
        updated_at: nowIso
      })
      .eq('user_id', connectionUserId);

    if (updateConnectionError) {
      console.error(
        'Failed to update Strava connection webhook timestamps.',
        updateConnectionError
      );
      return c.json({ ok: false, error: 'Unable to update webhook timestamps.' }, 500);
    }
  }

  c.executionCtx.waitUntil(
    processStravaWebhookEvent({
      env: c.env,
      eventId: persistedEvent.id,
      event,
      userId: connectionUserId
    })
  );

  return c.json({ ok: true }, 200);
});

function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? (error as { code?: unknown }).code : null;
  return code === '23505';
}

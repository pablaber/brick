import { mapStravaActivityToActivityRow, type Database } from '@brick/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';

import type { Env } from '../env.js';
import { createLogger } from './logger.js';
import { fetchStravaActivityById, StravaApiStatusError } from './strava-api.js';
import { refreshStravaToken, isTokenExpiredOrExpiringSoon } from './strava-token.js';
import { createServiceSupabaseClient } from './supabase.js';

type StravaConnectionRow = Database['public']['Tables']['strava_connections']['Row'];

type StravaWebhookObjectType = 'activity' | 'athlete';
type StravaWebhookAspectType = 'create' | 'update' | 'delete';

export type StravaWebhookEvent = {
  object_type: StravaWebhookObjectType;
  object_id: number;
  aspect_type: StravaWebhookAspectType;
  owner_id: number;
  subscription_id: number | null;
  event_time: number | null;
  updates: Record<string, string> | null;
};

export type ProcessStravaWebhookEventOptions = {
  env: Env;
  eventId: string;
  event: StravaWebhookEvent;
  userId: string | null;
  logger?: Logger;
  now?: Date;
  supabase?: SupabaseClient<Database>;
};

export type ResolveConnectionForOwnerResult = {
  userId: string | null;
  connection: Pick<StravaConnectionRow, 'user_id'> | null;
};

export async function resolveConnectionForOwner({
  env,
  ownerId,
  supabase = createServiceSupabaseClient(env)
}: {
  env: Env;
  ownerId: number;
  supabase?: SupabaseClient<Database>;
}): Promise<ResolveConnectionForOwnerResult> {
  const { data: connections, error } = await supabase
    .from('strava_connections')
    .select('user_id')
    .eq('strava_athlete_id', ownerId)
    .limit(1);

  if (error) {
    throw new Error('Unable to resolve Strava connection.');
  }

  const connection = connections?.[0] ?? null;
  return {
    userId: connection?.user_id ?? null,
    connection
  };
}

export function parseStravaWebhookEventPayload(raw: unknown): StravaWebhookEvent {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid payload.');
  }

  const payload = raw as Record<string, unknown>;
  const objectType = parseEnum(payload.object_type, ['activity', 'athlete']);
  const aspectType = parseEnum(payload.aspect_type, ['create', 'update', 'delete']);
  const objectId = parsePositiveSafeInteger(payload.object_id);
  const ownerId = parsePositiveSafeInteger(payload.owner_id);
  const subscriptionId = parseNullablePositiveSafeInteger(payload.subscription_id);
  const eventTime = parseNullablePositiveSafeInteger(payload.event_time);
  const updates = parseUpdates(payload.updates);

  return {
    object_type: objectType,
    object_id: objectId,
    aspect_type: aspectType,
    owner_id: ownerId,
    subscription_id: subscriptionId,
    event_time: eventTime,
    updates
  };
}

export async function createWebhookEventKey(event: StravaWebhookEvent): Promise<string> {
  const payload = {
    object_type: event.object_type,
    object_id: event.object_id,
    aspect_type: event.aspect_type,
    owner_id: event.owner_id,
    subscription_id: event.subscription_id,
    event_time: event.event_time,
    updates: event.updates
  };
  const canonical = stableStringify(payload);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return toHex(new Uint8Array(digest));
}

export async function processStravaWebhookEvent({
  env,
  eventId,
  event,
  userId,
  logger,
  now = new Date(),
  supabase = createServiceSupabaseClient(env)
}: ProcessStravaWebhookEventOptions): Promise<void> {
  const baseLogger =
    logger ??
    createLogger({
      env
    });
  const log = baseLogger.child({
    methodName: 'processStravaWebhookEvent',
    eventId,
    objectType: event.object_type,
    objectId: event.object_id,
    aspectType: event.aspect_type,
    ownerId: event.owner_id,
    userId
  });
  log.debug('Started webhook event processing.');

  try {
    if (isAthleteDeauthorizationEvent(event)) {
      log.debug('Handling athlete deauthorization webhook event.');
      const connections = await findConnectionsForDeauthorization({
        supabase,
        ownerId: event.owner_id,
        objectId: event.object_id
      });

      if (connections.length === 0) {
        log.debug('No connection found for deauthorization event. Marking ignored.');
        await markWebhookEventIgnored({
          supabase,
          eventId,
          reason: 'No matching Strava connection found for athlete deauthorization.',
          nowIso: now.toISOString()
        });
        return;
      }

      for (const connection of connections) {
        await deleteStravaDataForUser({ supabase, userId: connection.user_id });
        log.info(
          { userId: connection.user_id },
          'Deleted Strava data after athlete deauthorization.'
        );

        const { error: deauthError } = await supabase
          .from('strava_connections')
          .update({
            access_token: null,
            refresh_token: null,
            expires_at: null,
            deauthorized_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('user_id', connection.user_id);

        if (deauthError) {
          throw new Error('Unable to persist deauthorization state.');
        }
        log.info({ userId: connection.user_id }, 'Persisted athlete deauthorization state.');
      }

      await markWebhookEventProcessed({ supabase, eventId, nowIso: now.toISOString() });
      log.info('Marked athlete deauthorization event as processed.');
      return;
    }

    if (!userId) {
      log.debug('Webhook event has no resolved user. Marking ignored.');
      await markWebhookEventIgnored({
        supabase,
        eventId,
        reason: 'No Strava connection found for owner.',
        nowIso: now.toISOString()
      });
      return;
    }

    const connection = await getConnectionForProcessing({ supabase, userId });
    if (!connection) {
      log.debug('No active connection found for user. Marking ignored.');
      await markWebhookEventIgnored({
        supabase,
        eventId,
        reason: 'No Strava connection found for user.',
        nowIso: now.toISOString()
      });
      return;
    }

    if (event.object_type !== 'activity') {
      log.debug({ objectType: event.object_type }, 'Unsupported object type. Marking ignored.');
      await markWebhookEventIgnored({
        supabase,
        eventId,
        reason: 'Unsupported webhook object type.',
        nowIso: now.toISOString()
      });
      return;
    }

    if (event.aspect_type === 'delete') {
      log.debug('Handling delete activity webhook event.');
      await deleteLocalActivity({
        supabase,
        userId: connection.user_id,
        objectId: event.object_id
      });
      await markWebhookEventProcessed({ supabase, eventId, nowIso: now.toISOString() });
      log.info('Deleted local activity and marked event processed.');
      return;
    }

    if (
      connection.deauthorized_at ||
      !connection.access_token ||
      !connection.refresh_token ||
      !connection.expires_at
    ) {
      log.debug('Connection is missing token data or is deauthorized. Marking ignored.');
      await markWebhookEventIgnored({
        supabase,
        eventId,
        reason: 'Connection is deauthorized or missing token fields.',
        nowIso: now.toISOString()
      });
      return;
    }

    let activeConnection = connection;
    if (isTokenExpiredOrExpiringSoon(connection.expires_at)) {
      log.debug('Connection token is expired/expiring soon. Refreshing token.');
      activeConnection = await refreshStravaToken({
        env,
        supabase,
        connection,
        logger: log
      });
      log.debug('Token refresh completed.');
    }

    const accessToken = activeConnection.access_token;
    if (!accessToken) {
      throw new Error('Missing access token after refresh.');
    }

    try {
      log.debug('Fetching Strava activity by id for webhook event.');
      const activity = await fetchStravaActivityById({
        accessToken,
        activityId: event.object_id,
        logger: log
      });

      const mappedRow = mapStravaActivityToActivityRow(activity, activeConnection.user_id);
      const { error: upsertError } = await supabase
        .from('activities')
        .upsert(mappedRow, { onConflict: 'user_id,strava_activity_id' });

      if (upsertError) {
        throw new Error('Unable to store Strava activity from webhook.');
      }
      log.info({ stravaActivityId: event.object_id }, 'Upserted Strava activity from webhook.');

      await markWebhookEventProcessed({ supabase, eventId, nowIso: now.toISOString() });
      log.info('Marked webhook event as processed.');
      return;
    } catch (error) {
      if (error instanceof StravaApiStatusError) {
        log.warn(
          {
            statusCode: error.statusCode,
            message: error.message
          },
          'Strava API status error while processing webhook event.'
        );
        if (event.aspect_type === 'update' && error.statusCode === 404) {
          log.debug('Activity update returned 404. Deleting local activity and marking processed.');
          await deleteLocalActivity({
            supabase,
            userId: activeConnection.user_id,
            objectId: event.object_id
          });
          await markWebhookEventProcessed({ supabase, eventId, nowIso: now.toISOString() });
          log.info('Deleted local activity after 404 and marked processed.');
          return;
        }

        if (event.aspect_type === 'update' && error.statusCode === 403) {
          const shouldDeleteForPrivacy =
            updatesContainPrivacySignal(event.updates) ||
            !hasActivityReadAllScope(activeConnection.scope);

          if (shouldDeleteForPrivacy) {
            log.debug(
              { shouldDeleteForPrivacy },
              'Activity update returned 403 with privacy signal. Deleting local activity.'
            );
            await deleteLocalActivity({
              supabase,
              userId: activeConnection.user_id,
              objectId: event.object_id
            });
            await markWebhookEventProcessed({ supabase, eventId, nowIso: now.toISOString() });
            log.info('Deleted local activity after 403 privacy signal and marked processed.');
            return;
          }
        }
      }

      throw error;
    }
  } catch (error) {
    const safeError =
      error instanceof Error ? error.message.slice(0, 500) : 'Webhook processing failed.';

    log.error({ err: error, error: safeError }, 'Webhook event processing failed.');

    await markWebhookEventFailed({
      supabase,
      eventId,
      reason: safeError,
      nowIso: now.toISOString(),
      log
    });
  }
}

async function deleteStravaDataForUser({
  supabase,
  userId
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  const { error: activitiesDeleteError } = await supabase
    .from('activities')
    .delete()
    .eq('user_id', userId);

  if (activitiesDeleteError) {
    throw new Error('Unable to delete Strava activities after deauthorization.');
  }

  const { error: webhookEventsDeleteError } = await supabase
    .from('strava_webhook_events')
    .delete()
    .eq('user_id', userId);

  if (webhookEventsDeleteError) {
    throw new Error('Unable to delete Strava webhook events after deauthorization.');
  }
}

async function getConnectionForProcessing({
  supabase,
  userId
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<StravaConnectionRow | null> {
  const { data: connection, error } = await supabase
    .from('strava_connections')
    .select(
      'user_id,strava_athlete_id,access_token,refresh_token,expires_at,scope,deauthorized_at,last_synced_at,created_at,updated_at,webhook_events_received_at,last_webhook_event_at'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to load Strava connection for webhook processing.');
  }

  return connection;
}

async function findConnectionsForDeauthorization({
  supabase,
  ownerId,
  objectId
}: {
  supabase: SupabaseClient<Database>;
  ownerId: number;
  objectId: number;
}): Promise<Array<Pick<StravaConnectionRow, 'user_id'>>> {
  const { data: byOwner, error: byOwnerError } = await supabase
    .from('strava_connections')
    .select('user_id')
    .eq('strava_athlete_id', ownerId);

  if (byOwnerError) {
    throw new Error('Unable to resolve deauthorization connection by owner.');
  }

  const connectionsByUserId = new Map<string, Pick<StravaConnectionRow, 'user_id'>>();
  for (const connection of byOwner ?? []) {
    connectionsByUserId.set(connection.user_id, connection);
  }

  if (objectId !== ownerId) {
    const { data: byObject, error: byObjectError } = await supabase
      .from('strava_connections')
      .select('user_id')
      .eq('strava_athlete_id', objectId);

    if (byObjectError) {
      throw new Error('Unable to resolve deauthorization connection by object.');
    }

    for (const connection of byObject ?? []) {
      connectionsByUserId.set(connection.user_id, connection);
    }
  }

  return [...connectionsByUserId.values()];
}

async function deleteLocalActivity({
  supabase,
  userId,
  objectId
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  objectId: number;
}) {
  const { error: deleteError } = await supabase
    .from('activities')
    .delete()
    .eq('user_id', userId)
    .eq('strava_activity_id', objectId);

  if (deleteError) {
    throw new Error('Unable to delete local activity from webhook event.');
  }
}

async function markWebhookEventProcessed({
  supabase,
  eventId,
  nowIso
}: {
  supabase: SupabaseClient<Database>;
  eventId: string;
  nowIso: string;
}) {
  const { error } = await supabase
    .from('strava_webhook_events')
    .update({
      processing_status: 'processed',
      processed_at: nowIso,
      processing_error: null
    })
    .eq('id', eventId);

  if (error) {
    throw new Error('Unable to mark webhook event as processed.');
  }
}

async function markWebhookEventIgnored({
  supabase,
  eventId,
  reason,
  nowIso
}: {
  supabase: SupabaseClient<Database>;
  eventId: string;
  reason: string;
  nowIso: string;
}) {
  const { error } = await supabase
    .from('strava_webhook_events')
    .update({
      processing_status: 'ignored',
      processed_at: nowIso,
      processing_error: reason
    })
    .eq('id', eventId);

  if (error) {
    throw new Error('Unable to mark webhook event as ignored.');
  }
}

async function markWebhookEventFailed({
  supabase,
  eventId,
  reason,
  nowIso,
  log
}: {
  supabase: SupabaseClient<Database>;
  eventId: string;
  reason: string;
  nowIso: string;
  log: ReturnType<typeof createLogger>;
}) {
  const { error } = await supabase
    .from('strava_webhook_events')
    .update({
      processing_status: 'failed',
      processed_at: nowIso,
      processing_error: reason
    })
    .eq('id', eventId);

  if (error) {
    log.error(
      {
        err: error,
        failedEventId: eventId,
        reason
      },
      'Unable to persist webhook failed status.'
    );
  }
}

function parseEnum<T extends string>(raw: unknown, values: readonly T[]): T {
  if (typeof raw !== 'string' || !values.includes(raw as T)) {
    throw new Error('Invalid enum value in webhook payload.');
  }

  return raw as T;
}

function parsePositiveSafeInteger(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw <= 0) {
    throw new Error('Expected positive safe integer in webhook payload.');
  }

  return raw;
}

function parseNullablePositiveSafeInteger(raw: unknown): number | null {
  if (raw == null) {
    return null;
  }

  return parsePositiveSafeInteger(raw);
}

function parseUpdates(raw: unknown): Record<string, string> | null {
  if (raw == null) {
    return null;
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid updates payload.');
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) {
      continue;
    }

    if (typeof value !== 'string') {
      throw new Error('Invalid updates payload value.');
    }

    normalized[key] = value;
  }

  return normalized;
}

function isAthleteDeauthorizationEvent(event: StravaWebhookEvent): boolean {
  return (
    event.object_type === 'athlete' &&
    event.aspect_type === 'update' &&
    event.updates?.authorized === 'false'
  );
}

function updatesContainPrivacySignal(updates: Record<string, string> | null): boolean {
  if (!updates) {
    return false;
  }

  return Object.hasOwn(updates, 'private') || Object.hasOwn(updates, 'visibility');
}

function hasActivityReadAllScope(scope: string | null): boolean {
  if (!scope) {
    return false;
  }

  return scope
    .split(/[,\s]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes('activity:read_all');
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  return 'null';
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

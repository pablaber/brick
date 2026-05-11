import { Hono } from 'hono';
import { mapStravaActivityToActivityRow, verifySignedManualSyncToken } from '@workout/shared';

import type { Env } from '../env.js';
import { fetchStravaActivities } from '../lib/strava-api.js';
import { createServiceSupabaseClient } from '../lib/supabase.js';
import { isTokenExpiredOrExpiringSoon, refreshStravaToken } from '../lib/strava-token.js';

export const syncRoutes = new Hono<{ Bindings: Env }>();

const RUNNING_SYNC_WINDOW_MINUTES = 10;
const LAST_SYNC_LOOKBACK_SECONDS = 24 * 60 * 60;
const INITIAL_SYNC_MAX_PAGES = 10;
const INITIAL_SYNC_PER_PAGE = 100;

type ManualSyncRequestBody = {
  token?: string;
};

syncRoutes.post('/manual', async (c) => {
  const body = await parseJsonBody(c.req.raw);
  const token = body?.token;

  if (!token) {
    return c.json({ ok: false, error: 'Missing token.' }, 400);
  }

  let payload: { userId: string };
  try {
    payload = await verifySignedManualSyncToken(token, c.env.WORKER_SHARED_SECRET);
  } catch (error) {
    console.warn('Invalid manual sync token.', error);
    return c.json({ ok: false, error: 'Invalid token.' }, 401);
  }

  const supabase = createServiceSupabaseClient(c.env);
  const runningSince = new Date(Date.now() - RUNNING_SYNC_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: runningSync, error: runningSyncError } = await supabase
    .from('sync_runs')
    .select('id')
    .eq('user_id', payload.userId)
    .eq('status', 'running')
    .gte('started_at', runningSince)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runningSyncError) {
    console.error('Unable to check running sync.', runningSyncError);
    return c.json({ ok: false, error: 'Unable to start sync.' }, 500);
  }

  if (runningSync) {
    return c.json({ ok: false, error: 'A sync is already running.' }, 409);
  }

  const { data: startedSyncRun, error: syncRunInsertError } = await supabase
    .from('sync_runs')
    .insert({
      user_id: payload.userId,
      status: 'running'
    })
    .select('id')
    .single();

  if (syncRunInsertError || !startedSyncRun) {
    console.error('Unable to create sync run.', syncRunInsertError);
    return c.json({ ok: false, error: 'Unable to start sync.' }, 500);
  }

  const syncRunId = startedSyncRun.id;

  try {
    const { data: connection, error: connectionError } = await supabase
      .from('strava_connections')
      .select(
        'user_id,strava_athlete_id,access_token,refresh_token,expires_at,scope,last_synced_at,created_at,updated_at'
      )
      .eq('user_id', payload.userId)
      .maybeSingle();

    if (connectionError) {
      throw new ManualSyncError('Unable to load Strava connection.', 500);
    }

    if (!connection) {
      throw new ManualSyncError('No Strava connection found', 400);
    }

    let activeConnection = connection;
    if (isTokenExpiredOrExpiringSoon(connection.expires_at)) {
      activeConnection = await refreshStravaToken({
        env: c.env,
        supabase,
        connection
      });
    }

    const after = computeAfterUnixTimestamp(connection.last_synced_at);
    const activities = await fetchStravaActivities({
      accessToken: activeConnection.access_token,
      after,
      perPage: INITIAL_SYNC_PER_PAGE,
      maxPages: INITIAL_SYNC_MAX_PAGES
    });

    const mappedActivities = activities.map((activity) =>
      mapStravaActivityToActivityRow(activity, payload.userId)
    );

    if (mappedActivities.length > 0) {
      const { error: upsertError } = await supabase
        .from('activities')
        .upsert(mappedActivities, { onConflict: 'user_id,strava_activity_id' });

      if (upsertError) {
        throw new ManualSyncError('Unable to store synced activities.', 500);
      }
    }

    const nowIso = new Date().toISOString();
    const { error: connectionUpdateError } = await supabase
      .from('strava_connections')
      .update({
        last_synced_at: nowIso,
        updated_at: nowIso
      })
      .eq('user_id', payload.userId);

    if (connectionUpdateError) {
      throw new ManualSyncError('Unable to update last sync time.', 500);
    }

    const { error: successUpdateError } = await supabase
      .from('sync_runs')
      .update({
        status: 'success',
        completed_at: nowIso,
        activities_fetched: activities.length,
        error: null
      })
      .eq('id', syncRunId);

    if (successUpdateError) {
      throw new ManualSyncError('Unable to complete sync run.', 500);
    }

    return c.json({
      ok: true,
      syncRunId,
      activitiesFetched: activities.length,
      activitiesUpserted: mappedActivities.length,
      lastSyncedAt: nowIso
    });
  } catch (error) {
    const statusCode: SyncRouteStatusCode =
      error instanceof ManualSyncError ? error.statusCode : 500;
    const safeErrorMessage =
      error instanceof ManualSyncError ? error.message : 'Manual sync failed.';

    console.error('Manual sync failed.', error);
    await supabase
      .from('sync_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: safeErrorMessage
      })
      .eq('id', syncRunId);

    return c.json({ ok: false, error: safeErrorMessage }, statusCode);
  }
});

async function parseJsonBody(request: Request): Promise<ManualSyncRequestBody | null> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== 'object') {
      return null;
    }
    return body as ManualSyncRequestBody;
  } catch {
    return null;
  }
}

function computeAfterUnixTimestamp(lastSyncedAt: string | null): number | undefined {
  if (!lastSyncedAt) {
    return undefined;
  }

  const parsed = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return Math.floor(parsed / 1000) - LAST_SYNC_LOOKBACK_SECONDS;
}

class ManualSyncError extends Error {
  constructor(
    message: string,
    readonly statusCode: SyncRouteStatusCode
  ) {
    super(message);
  }
}

type SyncRouteStatusCode = 400 | 500;

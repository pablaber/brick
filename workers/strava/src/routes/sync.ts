import { Hono } from 'hono';
import { mapStravaActivityToActivityRow, verifySignedManualSyncToken } from '@workout/shared';
import type { Database } from '@workout/shared';

import type { Env } from '../env.js';
import { fetchStravaActivities, fetchStravaActivityTotalCount } from '../lib/strava-api.js';
import { createServiceSupabaseClient } from '../lib/supabase.js';
import { isTokenExpiredOrExpiringSoon, refreshStravaToken } from '../lib/strava-token.js';

export const syncRoutes = new Hono<{ Bindings: Env }>();

const RUNNING_SYNC_WINDOW_MINUTES = 10;
const LAST_SYNC_LOOKBACK_SECONDS = 24 * 60 * 60;
const INITIAL_SYNC_MAX_PAGES = 1;
const INITIAL_SYNC_PER_PAGE = 100;
const BATCH_ACTIVITY_CAP = INITIAL_SYNC_MAX_PAGES * INITIAL_SYNC_PER_PAGE;

type ManualSyncRequestBody = {
  token?: string;
  cursorBefore?: number;
  syncRunId?: string;
  estimatedTotalActivities?: number;
};

type SyncRunRow = Pick<
  Database['public']['Tables']['sync_runs']['Row'],
  'id' | 'user_id' | 'status' | 'activities_fetched'
>;

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
  const cursorBefore = normalizeFinitePositiveInteger(body?.cursorBefore);
  const estimatedTotalFromClient = normalizeFinitePositiveInteger(body?.estimatedTotalActivities);

  let activeSyncRun: SyncRunRow;
  try {
    const candidateSyncRun = await getOrCreateActiveSyncRun({
      supabase,
      userId: payload.userId,
      requestedSyncRunId: body?.syncRunId
    });

    if (!candidateSyncRun) {
      return c.json({ ok: false, error: 'A sync is already running.' }, 409);
    }

    activeSyncRun = candidateSyncRun;
  } catch (error) {
    console.error('Unable to initialize manual sync run.', error);
    return c.json({ ok: false, error: 'Unable to start sync.' }, 500);
  }

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

    const hasLastSyncedAt = Boolean(connection.last_synced_at);
    const isBackfillMode = cursorBefore !== null || !hasLastSyncedAt;

    let activeConnection = connection;
    if (isTokenExpiredOrExpiringSoon(connection.expires_at)) {
      activeConnection = await refreshStravaToken({
        env: c.env,
        supabase,
        connection
      });
    }

    const after =
      cursorBefore === null && hasLastSyncedAt
        ? computeAfterUnixTimestamp(connection.last_synced_at)
        : undefined;
    const before = isBackfillMode ? (cursorBefore ?? Math.floor(Date.now() / 1000)) : undefined;

    const activities = await fetchStravaActivities({
      accessToken: activeConnection.access_token,
      after,
      before,
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

    const totalActivitiesFetched = (activeSyncRun.activities_fetched ?? 0) + activities.length;
    const hasMore = isBackfillMode && activities.length >= BATCH_ACTIVITY_CAP;
    const nextCursorBefore = hasMore ? computeNextCursorBefore(activities) : null;
    const shouldContinue = hasMore && nextCursorBefore !== null;
    const estimatedTotalActivities =
      estimatedTotalFromClient ??
      (await fetchStravaActivityTotalCount({
        accessToken: activeConnection.access_token,
        athleteId: activeConnection.strava_athlete_id
      }));

    const { error: runningUpdateError } = await supabase
      .from('sync_runs')
      .update({
        activities_fetched: totalActivitiesFetched
      })
      .eq('id', activeSyncRun.id);

    if (runningUpdateError) {
      throw new ManualSyncError('Unable to update sync progress.', 500);
    }

    activeSyncRun = {
      ...activeSyncRun,
      activities_fetched: totalActivitiesFetched
    };

    if (shouldContinue) {
      return c.json({
        ok: true,
        syncRunId: activeSyncRun.id,
        batchActivitiesFetched: activities.length,
        totalActivitiesFetched,
        activitiesUpserted: mappedActivities.length,
        hasMore: true,
        nextCursorBefore,
        estimatedTotalActivities
      });
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
        activities_fetched: totalActivitiesFetched,
        error: null
      })
      .eq('id', activeSyncRun.id);

    if (successUpdateError) {
      throw new ManualSyncError('Unable to complete sync run.', 500);
    }

    return c.json({
      ok: true,
      syncRunId: activeSyncRun.id,
      batchActivitiesFetched: activities.length,
      totalActivitiesFetched,
      activitiesUpserted: mappedActivities.length,
      hasMore: false,
      nextCursorBefore: null,
      estimatedTotalActivities,
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
      .eq('id', activeSyncRun.id);

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

function computeNextCursorBefore(activities: Array<{ start_date?: string | null }>): number | null {
  let oldestTimestamp: number | null = null;

  for (const activity of activities) {
    if (!activity.start_date) {
      continue;
    }

    const parsed = new Date(activity.start_date).getTime();
    if (Number.isNaN(parsed)) {
      continue;
    }

    if (oldestTimestamp === null || parsed < oldestTimestamp) {
      oldestTimestamp = parsed;
    }
  }

  if (oldestTimestamp === null) {
    return null;
  }

  return Math.floor(oldestTimestamp / 1000) - 1;
}

function normalizeFinitePositiveInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
}

async function getOrCreateActiveSyncRun({
  supabase,
  userId,
  requestedSyncRunId
}: {
  supabase: ReturnType<typeof createServiceSupabaseClient>;
  userId: string;
  requestedSyncRunId?: string;
}): Promise<SyncRunRow | null> {
  if (requestedSyncRunId) {
    const { data: existingRun, error: existingRunError } = await supabase
      .from('sync_runs')
      .select('id,user_id,status,activities_fetched')
      .eq('id', requestedSyncRunId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingRunError) {
      throw new ManualSyncError('Unable to resume sync run.', 500);
    }

    if (!existingRun || existingRun.status !== 'running') {
      return null;
    }

    return existingRun;
  }

  const runningSince = new Date(Date.now() - RUNNING_SYNC_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: runningSync, error: runningSyncError } = await supabase
    .from('sync_runs')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'running')
    .gte('started_at', runningSince)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runningSyncError) {
    throw new ManualSyncError('Unable to check running sync.', 500);
  }

  if (runningSync) {
    return null;
  }

  const { data: startedSyncRun, error: syncRunInsertError } = await supabase
    .from('sync_runs')
    .insert({
      user_id: userId,
      status: 'running',
      activities_fetched: 0
    })
    .select('id,user_id,status,activities_fetched')
    .single();

  if (syncRunInsertError || !startedSyncRun) {
    throw new ManualSyncError('Unable to start sync.', 500);
  }

  return startedSyncRun;
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

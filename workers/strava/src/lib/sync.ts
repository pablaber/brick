import { mapStravaActivityToActivityRow } from '@workout/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@workout/shared';

import type { Env } from '../env.js';
import { fetchStravaActivities, fetchStravaActivityTotalCount } from './strava-api.js';
import { createServiceSupabaseClient } from './supabase.js';
import { isTokenExpiredOrExpiringSoon, refreshStravaToken } from './strava-token.js';

const RUNNING_SYNC_WINDOW_MINUTES = 10;
const LAST_SYNC_LOOKBACK_SECONDS = 24 * 60 * 60;
const INITIAL_SYNC_MAX_PAGES = 1;
const INITIAL_SYNC_PER_PAGE = 100;
const BATCH_ACTIVITY_CAP = INITIAL_SYNC_MAX_PAGES * INITIAL_SYNC_PER_PAGE;

export type SyncType = 'manual' | 'scheduled';
export type SyncTrigger = 'manual-route' | 'cron';

type StravaConnectionRow = Database['public']['Tables']['strava_connections']['Row'];
type SyncRunRow = Pick<
  Database['public']['Tables']['sync_runs']['Row'],
  'id' | 'user_id' | 'status' | 'activities_fetched' | 'activities_upserted'
>;

export type SyncUserActivitiesOptions = {
  env: Env;
  userId: string;
  syncType: SyncType;
  triggeredBy: SyncTrigger;
  now?: Date;
  cursorBefore?: number | null;
  requestedSyncRunId?: string;
  estimatedTotalActivities?: number | null;
  minSyncIntervalHours?: number;
  supabase?: SupabaseClient<Database>;
};

export type SyncUserActivitiesResult = {
  ok: boolean;
  statusCode: number;
  syncType: SyncType;
  syncRunId: string | null;
  batchActivitiesFetched: number;
  totalActivitiesFetched: number;
  activitiesUpserted: number;
  totalActivitiesUpserted: number;
  hasMore: boolean;
  nextCursorBefore: number | null;
  estimatedTotalActivities: number | null;
  lastSyncedAt: string | null;
  skipped: boolean;
  skipReason: 'running_sync' | 'recently_synced' | null;
  error: string | null;
};

export async function syncUserActivities(
  options: SyncUserActivitiesOptions
): Promise<SyncUserActivitiesResult> {
  const supabase = options.supabase ?? createServiceSupabaseClient(options.env);
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const normalizedCursorBefore = normalizeFinitePositiveInteger(options.cursorBefore);
  const estimatedTotalFromClient = normalizeFinitePositiveInteger(options.estimatedTotalActivities);

  let activeSyncRun: SyncRunRow | null = null;

  try {
    const candidateSyncRun = await getOrCreateActiveSyncRun({
      supabase,
      userId: options.userId,
      requestedSyncRunId: options.requestedSyncRunId,
      syncType: options.syncType,
      now
    });

    if (!candidateSyncRun) {
      return buildSkipResult({
        syncType: options.syncType,
        statusCode: options.syncType === 'manual' ? 409 : 200,
        skipReason: 'running_sync'
      });
    }

    activeSyncRun = candidateSyncRun;

    const { data: connection, error: connectionError } = await supabase
      .from('strava_connections')
      .select(
        'user_id,strava_athlete_id,access_token,refresh_token,expires_at,scope,last_synced_at,created_at,updated_at'
      )
      .eq('user_id', options.userId)
      .maybeSingle();

    if (connectionError) {
      throw new SyncError('Unable to load Strava connection.', 500);
    }

    if (!connection) {
      throw new SyncError('No Strava connection found', 400);
    }

    if (options.syncType === 'scheduled') {
      const intervalHours = options.minSyncIntervalHours ?? 6;
      if (wasSyncedRecently(connection.last_synced_at, intervalHours, now)) {
        await markSyncRunSkipped({
          supabase,
          syncRunId: activeSyncRun.id,
          syncType: options.syncType,
          nowIso
        });

        return buildSkipResult({
          syncType: options.syncType,
          statusCode: 200,
          skipReason: 'recently_synced',
          syncRunId: activeSyncRun.id
        });
      }
    }

    const hasLastSyncedAt = Boolean(connection.last_synced_at);
    const isBackfillMode = normalizedCursorBefore !== null || !hasLastSyncedAt;

    let activeConnection: StravaConnectionRow = connection;
    if (isTokenExpiredOrExpiringSoon(connection.expires_at)) {
      activeConnection = await refreshStravaToken({
        env: options.env,
        supabase,
        connection
      });
    }

    const after =
      normalizedCursorBefore === null && hasLastSyncedAt
        ? computeAfterUnixTimestamp(connection.last_synced_at)
        : undefined;
    const before =
      isBackfillMode && normalizedCursorBefore !== null
        ? normalizedCursorBefore
        : isBackfillMode
          ? Math.floor(now.getTime() / 1000)
          : undefined;

    const activities = await fetchStravaActivities({
      accessToken: activeConnection.access_token,
      after,
      before,
      perPage: INITIAL_SYNC_PER_PAGE,
      maxPages: INITIAL_SYNC_MAX_PAGES
    });

    const mappedActivities = activities.map((activity) =>
      mapStravaActivityToActivityRow(activity, options.userId)
    );

    if (mappedActivities.length > 0) {
      const { error: upsertError } = await supabase
        .from('activities')
        .upsert(mappedActivities, { onConflict: 'user_id,strava_activity_id' });

      if (upsertError) {
        throw new SyncError('Unable to store synced activities.', 500);
      }
    }

    const totalActivitiesFetched = (activeSyncRun.activities_fetched ?? 0) + activities.length;
    const totalActivitiesUpserted = (activeSyncRun.activities_upserted ?? 0) + mappedActivities.length;
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
        activities_fetched: totalActivitiesFetched,
        activities_upserted: totalActivitiesUpserted
      })
      .eq('id', activeSyncRun.id);

    if (runningUpdateError) {
      throw new SyncError('Unable to update sync progress.', 500);
    }

    activeSyncRun = {
      ...activeSyncRun,
      activities_fetched: totalActivitiesFetched,
      activities_upserted: totalActivitiesUpserted
    };

    if (shouldContinue) {
      return {
        ok: true,
        statusCode: 200,
        syncType: options.syncType,
        syncRunId: activeSyncRun.id,
        batchActivitiesFetched: activities.length,
        totalActivitiesFetched,
        activitiesUpserted: mappedActivities.length,
        totalActivitiesUpserted,
        hasMore: true,
        nextCursorBefore,
        estimatedTotalActivities,
        lastSyncedAt: null,
        skipped: false,
        skipReason: null,
        error: null
      };
    }

    const { error: connectionUpdateError } = await supabase
      .from('strava_connections')
      .update({
        last_synced_at: nowIso,
        updated_at: nowIso
      })
      .eq('user_id', options.userId);

    if (connectionUpdateError) {
      throw new SyncError('Unable to update last sync time.', 500);
    }

    const { error: successUpdateError } = await supabase
      .from('sync_runs')
      .update({
        status: 'success',
        completed_at: nowIso,
        activities_fetched: totalActivitiesFetched,
        activities_upserted: totalActivitiesUpserted,
        error: null
      })
      .eq('id', activeSyncRun.id);

    if (successUpdateError) {
      throw new SyncError('Unable to complete sync run.', 500);
    }

    return {
      ok: true,
      statusCode: 200,
      syncType: options.syncType,
      syncRunId: activeSyncRun.id,
      batchActivitiesFetched: activities.length,
      totalActivitiesFetched,
      activitiesUpserted: mappedActivities.length,
      totalActivitiesUpserted,
      hasMore: false,
      nextCursorBefore: null,
      estimatedTotalActivities,
      lastSyncedAt: nowIso,
      skipped: false,
      skipReason: null,
      error: null
    };
  } catch (error) {
    const statusCode = error instanceof SyncError ? error.statusCode : 500;
    const safeErrorMessage = error instanceof SyncError ? error.message : 'Sync failed.';

    if (activeSyncRun) {
      await supabase
        .from('sync_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error: safeErrorMessage
        })
        .eq('id', activeSyncRun.id);
    }

    return {
      ok: false,
      statusCode,
      syncType: options.syncType,
      syncRunId: activeSyncRun?.id ?? null,
      batchActivitiesFetched: 0,
      totalActivitiesFetched: activeSyncRun?.activities_fetched ?? 0,
      activitiesUpserted: 0,
      totalActivitiesUpserted: activeSyncRun?.activities_upserted ?? 0,
      hasMore: false,
      nextCursorBefore: null,
      estimatedTotalActivities: estimatedTotalFromClient,
      lastSyncedAt: null,
      skipped: false,
      skipReason: null,
      error: safeErrorMessage
    };
  }
}

export async function hasRecentRunningSync({
  supabase,
  userId,
  now = new Date()
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  now?: Date;
}): Promise<boolean> {
  const runningSince = new Date(now.getTime() - RUNNING_SYNC_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: runningSync, error } = await supabase
    .from('sync_runs')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'running')
    .gte('started_at', runningSince)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new SyncError('Unable to check running sync.', 500);
  }

  return Boolean(runningSync);
}

function normalizeFinitePositiveInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
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

async function getOrCreateActiveSyncRun({
  supabase,
  userId,
  requestedSyncRunId,
  syncType,
  now
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  requestedSyncRunId?: string;
  syncType: SyncType;
  now: Date;
}): Promise<SyncRunRow | null> {
  if (requestedSyncRunId) {
    const { data: existingRun, error: existingRunError } = await supabase
      .from('sync_runs')
      .select('id,user_id,status,activities_fetched,activities_upserted')
      .eq('id', requestedSyncRunId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingRunError) {
      throw new SyncError('Unable to resume sync run.', 500);
    }

    if (!existingRun || existingRun.status !== 'running') {
      return null;
    }

    return existingRun;
  }

  const runningSyncExists = await hasRecentRunningSync({ supabase, userId, now });
  if (runningSyncExists) {
    return null;
  }

  const { data: startedSyncRun, error: syncRunInsertError } = await supabase
    .from('sync_runs')
    .insert({
      user_id: userId,
      status: 'running',
      sync_type: syncType,
      activities_fetched: 0,
      activities_upserted: 0
    })
    .select('id,user_id,status,activities_fetched,activities_upserted')
    .single();

  if (syncRunInsertError || !startedSyncRun) {
    throw new SyncError('Unable to start sync.', 500);
  }

  return startedSyncRun;
}

async function markSyncRunSkipped({
  supabase,
  syncRunId,
  syncType,
  nowIso
}: {
  supabase: SupabaseClient<Database>;
  syncRunId: string;
  syncType: SyncType;
  nowIso: string;
}) {
  await supabase
    .from('sync_runs')
    .update({
      status: 'success',
      sync_type: syncType,
      completed_at: nowIso,
      activities_fetched: 0,
      activities_upserted: 0,
      error: null
    })
    .eq('id', syncRunId);
}

function buildSkipResult({
  syncType,
  statusCode,
  skipReason,
  syncRunId = null
}: {
  syncType: SyncType;
  statusCode: number;
  skipReason: 'running_sync' | 'recently_synced';
  syncRunId?: string | null;
}): SyncUserActivitiesResult {
  return {
    ok: true,
    statusCode,
    syncType,
    syncRunId,
    batchActivitiesFetched: 0,
    totalActivitiesFetched: 0,
    activitiesUpserted: 0,
    totalActivitiesUpserted: 0,
    hasMore: false,
    nextCursorBefore: null,
    estimatedTotalActivities: null,
    lastSyncedAt: null,
    skipped: true,
    skipReason,
    error: null
  };
}

function wasSyncedRecently(
  lastSyncedAt: string | null,
  minSyncIntervalHours: number,
  now: Date
): boolean {
  if (!lastSyncedAt) {
    return false;
  }

  const lastSyncedTime = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(lastSyncedTime)) {
    return false;
  }

  const intervalMs = minSyncIntervalHours * 60 * 60 * 1000;
  return now.getTime() - lastSyncedTime < intervalMs;
}

class SyncError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

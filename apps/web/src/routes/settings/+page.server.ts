import { requireUser } from '$lib/server/auth';
import { ensureProfile } from '$lib/server/profiles';
import type { PageServerLoad } from './$types';

const STRAVA_RESULTS = new Set(['connected', 'denied', 'invalid_state', 'error']);
const SYNC_RESULTS = new Set(['success', 'error', 'running', 'not_connected']);

export const load: PageServerLoad = async (event) => {
  const user = await requireUser(event);
  await ensureProfile(event.locals.supabase, user);

  const { data: profile } = await event.locals.supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const { data: stravaConnection } = await event.locals.supabase
    .from('strava_connections')
    .select('strava_athlete_id,scope,last_synced_at,created_at,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: latestSyncRun } = await event.locals.supabase
    .from('sync_runs')
    .select('status,started_at,completed_at,activities_fetched,error')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const stravaResultQuery = event.url.searchParams.get('strava');
  const stravaResult =
    stravaResultQuery && STRAVA_RESULTS.has(stravaResultQuery) ? stravaResultQuery : null;
  const syncResultQuery = event.url.searchParams.get('sync');
  const syncResult = syncResultQuery && SYNC_RESULTS.has(syncResultQuery) ? syncResultQuery : null;

  return {
    email: user.email ?? null,
    userId: user.id,
    displayName: profile?.display_name ?? null,
    stravaResult,
    syncResult,
    strava: stravaConnection
      ? {
          connected: true,
          strava_athlete_id: stravaConnection.strava_athlete_id,
          scope: stravaConnection.scope,
          last_synced_at: stravaConnection.last_synced_at,
          created_at: stravaConnection.created_at,
          updated_at: stravaConnection.updated_at
        }
      : {
          connected: false,
          strava_athlete_id: null,
          scope: null,
          last_synced_at: null,
          created_at: null,
          updated_at: null
        },
    latestSyncRun: latestSyncRun
      ? {
          status: latestSyncRun.status,
          started_at: latestSyncRun.started_at,
          completed_at: latestSyncRun.completed_at,
          activities_fetched: latestSyncRun.activities_fetched,
          error: latestSyncRun.error
        }
      : null
  };
};

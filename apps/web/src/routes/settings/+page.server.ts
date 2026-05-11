import { requireUser } from '$lib/server/auth';
import { ensureProfile } from '$lib/server/profiles';
import type { PageServerLoad } from './$types';

const STRAVA_RESULTS = new Set(['connected', 'denied', 'invalid_state', 'error']);

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

  const stravaResultQuery = event.url.searchParams.get('strava');
  const stravaResult =
    stravaResultQuery && STRAVA_RESULTS.has(stravaResultQuery) ? stravaResultQuery : null;

  return {
    email: user.email ?? null,
    userId: user.id,
    displayName: profile?.display_name ?? null,
    stravaResult,
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
        }
  };
};

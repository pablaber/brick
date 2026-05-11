import { requireUser } from '$lib/server/auth';
import { ensureProfile } from '$lib/server/profiles';
import type { PageServerLoad } from './$types';

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
    .select('strava_athlete_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    email: user.email ?? null,
    userId: user.id,
    displayName: profile?.display_name ?? null,
    stravaConnected: !!stravaConnection
  };
};

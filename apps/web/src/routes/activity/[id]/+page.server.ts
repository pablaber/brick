import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth';
import { loadUserSettings } from '$lib/server/user-settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const user = await requireUser(event);
  const activityId = event.params.id;

  const [activityResult, settingsResult] = await Promise.allSettled([
    event.locals.supabase
      .from('activities')
      .select(
        'id,strava_activity_id,name,sport_type,start_date,moving_time_seconds,elapsed_time_seconds,distance_meters,total_elevation_gain_meters,average_speed_mps,max_speed_mps,average_heartrate,max_heartrate'
      )
      .eq('user_id', user.id)
      .eq('id', activityId)
      .maybeSingle(),
    loadUserSettings(event.locals.supabase, user.id)
  ]);

  if (activityResult.status === 'rejected') {
    console.error('Unable to load activity detail', activityResult.reason);
    throw error(500, 'Unable to load activity.');
  }

  const { data: activity, error: activityError } = activityResult.value;

  if (activityError) {
    console.error('Unable to load activity detail', activityError);
    throw error(500, 'Unable to load activity.');
  }

  if (!activity) {
    throw error(404, 'Activity not found.');
  }

  const categoryColors =
    settingsResult.status === 'fulfilled'
      ? settingsResult.value.colors
      : { running: '#F97316', cycling: '#22C55E', swimming: '#0EA5E9', other: '#8B5CF6' };

  return { activity, categoryColors };
};

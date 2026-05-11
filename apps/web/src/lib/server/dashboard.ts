import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@workout/shared';

type Supabase = SupabaseClient<Database>;

function dateStringWeeksAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function dateStringMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

export async function getStravaConnectionStatus(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from('strava_connections')
    .select('strava_athlete_id, scope, last_synced_at, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    connected: !!data,
    stravaAthleteId: data?.strava_athlete_id ?? null,
    scope: data?.scope ?? null,
    lastSyncedAt: data?.last_synced_at ?? null
  };
}

export async function getLatestSyncRun(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from('sync_runs')
    .select('status, started_at, completed_at, activities_fetched, error')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    status: data.status,
    startedAt: data.started_at,
    completedAt: data.completed_at ?? null,
    activitiesFetched: data.activities_fetched ?? null,
    error: data.error ?? null
  };
}

export async function getRecentActivities(supabase: Supabase, userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, strava_activity_id, name, sport_type, start_date, moving_time_seconds, distance_meters, total_elevation_gain_meters, average_heartrate'
    )
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    stravaActivityId: row.strava_activity_id,
    name: row.name,
    sportType: row.sport_type,
    startDate: row.start_date,
    movingTimeSeconds: row.moving_time_seconds,
    distanceMeters: row.distance_meters,
    totalElevationGainMeters: row.total_elevation_gain_meters,
    averageHeartrate: row.average_heartrate
  }));
}

export async function getWeeklyActivityMinutes(supabase: Supabase, userId: string, weeksBack = 16) {
  const { data, error } = await supabase
    .from('weekly_activity_minutes')
    .select('week_start, sport_type, total_moving_minutes, activity_count')
    .eq('user_id', userId)
    .gte('week_start', dateStringWeeksAgo(weeksBack))
    .order('week_start', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMonthlyDistanceBySport(
  supabase: Supabase,
  userId: string,
  monthsBack = 12
) {
  const { data, error } = await supabase
    .from('monthly_distance_by_sport')
    .select('month_start, sport_type, total_distance_miles, total_distance_meters, activity_count')
    .eq('user_id', userId)
    .gte('month_start', dateStringMonthsAgo(monthsBack))
    .order('month_start', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getYearlyRunningDistance(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from('yearly_running_distance')
    .select('year_start, total_distance_miles, total_distance_meters, activity_count')
    .eq('user_id', userId)
    .order('year_start', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getWeeklySportBreakdown(supabase: Supabase, userId: string, weeksBack = 16) {
  const { data, error } = await supabase
    .from('weekly_sport_breakdown')
    .select(
      'week_start, sport_type, total_moving_minutes, total_moving_seconds, total_distance_meters, activity_count'
    )
    .eq('user_id', userId)
    .gte('week_start', dateStringWeeksAgo(weeksBack))
    .order('week_start', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getActivityCount(supabase: Supabase, userId: string) {
  const { count, error } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

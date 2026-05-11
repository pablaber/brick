import { requireUser } from '$lib/server/auth';
import {
  getActivityCount,
  getLatestSyncRun,
  getMonthlyDistanceBySport,
  getRecentActivities,
  getStravaConnectionStatus,
  getWeeklyActivityMinutes,
  getWeeklySportBreakdown,
  getYearlyRunningDistance
} from '$lib/server/dashboard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const user = await requireUser(event);
  const supabase = event.locals.supabase;
  const userId = user.id;

  const [
    connectionResult,
    syncRunResult,
    recentActivitiesResult,
    weeklyMinutesResult,
    monthlyDistanceResult,
    yearlyDistanceResult,
    weeklySportBreakdownResult,
    activityCountResult
  ] = await Promise.allSettled([
    getStravaConnectionStatus(supabase, userId),
    getLatestSyncRun(supabase, userId),
    getRecentActivities(supabase, userId),
    getWeeklyActivityMinutes(supabase, userId),
    getMonthlyDistanceBySport(supabase, userId),
    getYearlyRunningDistance(supabase, userId),
    getWeeklySportBreakdown(supabase, userId),
    getActivityCount(supabase, userId)
  ]);

  const connection =
    connectionResult.status === 'fulfilled'
      ? connectionResult.value
      : { connected: false, stravaAthleteId: null, scope: null, lastSyncedAt: null };

  const latestSyncRun = syncRunResult.status === 'fulfilled' ? syncRunResult.value : null;
  const recentActivities =
    recentActivitiesResult.status === 'fulfilled' ? recentActivitiesResult.value : [];
  const weeklyActivityMinutes =
    weeklyMinutesResult.status === 'fulfilled' ? weeklyMinutesResult.value : [];
  const monthlyDistanceBySport =
    monthlyDistanceResult.status === 'fulfilled' ? monthlyDistanceResult.value : [];
  const yearlyRunningDistance =
    yearlyDistanceResult.status === 'fulfilled' ? yearlyDistanceResult.value : [];
  const weeklySportBreakdown =
    weeklySportBreakdownResult.status === 'fulfilled' ? weeklySportBreakdownResult.value : [];
  const activityCount =
    activityCountResult.status === 'fulfilled' ? activityCountResult.value : null;

  // Current year running miles
  const currentYear = new Date().getFullYear().toString();
  const currentYearRow = yearlyRunningDistance.find((row) =>
    row.year_start?.startsWith(currentYear)
  );
  const currentYearRunningMiles = currentYearRow?.total_distance_miles ?? null;

  // Weekly minutes: aggregate by week, then find most recent week
  const weekMap = new Map<string, number>();
  for (const row of weeklyActivityMinutes) {
    if (row.week_start && row.total_moving_minutes) {
      weekMap.set(row.week_start, (weekMap.get(row.week_start) ?? 0) + row.total_moving_minutes);
    }
  }
  const sortedWeeks = [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const thisWeekWorkoutMinutes =
    sortedWeeks.length > 0 ? sortedWeeks[sortedWeeks.length - 1][1] : null;

  // Charts
  const weeklyMinutesChart = sortedWeeks.map(([week, minutes]) => ({ week, minutes }));

  const monthMap = new Map<string, number>();
  for (const row of monthlyDistanceBySport) {
    if (row.month_start && row.total_distance_miles) {
      monthMap.set(
        row.month_start,
        (monthMap.get(row.month_start) ?? 0) + row.total_distance_miles
      );
    }
  }
  const monthlyDistanceChart = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, miles]) => ({ month, miles }));

  const yearlyDistanceChart = yearlyRunningDistance.map((row) => ({
    year: row.year_start ?? '',
    miles: row.total_distance_miles ?? 0
  }));

  // Sport breakdown aggregate across weeks
  const sportTotals = new Map<string, number>();
  for (const row of weeklySportBreakdown) {
    if (row.sport_type && row.total_moving_minutes) {
      sportTotals.set(
        row.sport_type,
        (sportTotals.get(row.sport_type) ?? 0) + row.total_moving_minutes
      );
    }
  }
  const totalSportMinutes = [...sportTotals.values()].reduce((sum, v) => sum + v, 0);
  const sportBreakdownChart = [...sportTotals.entries()]
    .map(([sport, minutes]) => ({
      sport,
      minutes,
      pct: totalSportMinutes > 0 ? Math.round((minutes / totalSportMinutes) * 100) : 0
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    connection,
    latestSyncRun,
    stats: {
      currentYearRunningMiles,
      thisWeekWorkoutMinutes,
      syncedActivityCount: activityCount,
      lastSyncedAt: connection.lastSyncedAt
    },
    charts: {
      weeklyMinutes: weeklyMinutesChart,
      monthlyDistance: monthlyDistanceChart,
      yearlyDistance: yearlyDistanceChart,
      sportBreakdown: sportBreakdownChart
    },
    recentActivities
  };
};

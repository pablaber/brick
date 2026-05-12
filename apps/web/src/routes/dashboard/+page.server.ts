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

  const runningSports = new Set(['Run', 'TrailRun', 'VirtualRun']);
  const cyclingSports = new Set(['Ride', 'VirtualRide', 'GravelRide', 'EBikeRide', 'MountainBikeRide']);
  const swimmingSports = new Set(['Swim', 'OpenWaterSwimming']);

  // Current year cycling miles
  let currentYearCyclingMiles = 0;
  for (const row of monthlyDistanceBySport) {
    if (
      row.month_start?.startsWith(currentYear) &&
      cyclingSports.has(row.sport_type ?? '') &&
      row.total_distance_miles
    ) {
      currentYearCyclingMiles += row.total_distance_miles;
    }
  }

  // Weekly minutes: aggregate by week and sport category
  type WeekEntry = { running: number; cycling: number; swimming: number; other: number };
  const weekBreakdown = new Map<string, WeekEntry>();
  for (const row of weeklyActivityMinutes) {
    if (row.week_start && row.total_moving_minutes) {
      const entry = weekBreakdown.get(row.week_start) ?? { running: 0, cycling: 0, swimming: 0, other: 0 };
      const sport = row.sport_type ?? '';
      if (runningSports.has(sport)) {
        entry.running += row.total_moving_minutes;
      } else if (cyclingSports.has(sport)) {
        entry.cycling += row.total_moving_minutes;
      } else if (swimmingSports.has(sport)) {
        entry.swimming += row.total_moving_minutes;
      } else {
        entry.other += row.total_moving_minutes;
      }
      weekBreakdown.set(row.week_start, entry);
    }
  }
  const sortedWeeks = [...weekBreakdown.entries()].sort(([a], [b]) => a.localeCompare(b));
  const lastWeek = sortedWeeks.length > 0 ? sortedWeeks[sortedWeeks.length - 1][1] : null;
  const thisWeekWorkoutMinutes = lastWeek
    ? lastWeek.running + lastWeek.cycling + lastWeek.swimming + lastWeek.other
    : null;

  // Charts
  const weeklyMinutesChart = sortedWeeks.map(([week, { running, cycling, swimming, other }]) => ({
    week,
    running,
    cycling,
    swimming,
    other,
    minutes: running + cycling + swimming + other
  }));

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
      currentYearCyclingMiles,
      thisWeekWorkoutMinutes,
      syncedActivityCount: activityCount
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

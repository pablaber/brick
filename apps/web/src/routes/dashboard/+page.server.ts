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
import { loadUserSettings } from '$lib/server/user-settings';
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
    activityCountResult,
    settingsResult
  ] = await Promise.allSettled([
    getStravaConnectionStatus(supabase, userId),
    getLatestSyncRun(supabase, userId),
    getRecentActivities(supabase, userId),
    getWeeklyActivityMinutes(supabase, userId),
    getMonthlyDistanceBySport(supabase, userId),
    getYearlyRunningDistance(supabase, userId),
    getWeeklySportBreakdown(supabase, userId, 53),
    getActivityCount(supabase, userId),
    loadUserSettings(supabase, userId)
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
  const userSettings =
    settingsResult.status === 'fulfilled'
      ? settingsResult.value
      : {
          colors: {
            running: '#0D6EFD',
            cycling: '#E8A838',
            swimming: '#38BDF8',
            other: '#8B5CF6'
          },
          activeGoals: {}
        };

  // Current year running miles
  const currentYear = new Date().getFullYear().toString();
  const currentYearRow = yearlyRunningDistance.find((row) =>
    row.year_start?.startsWith(currentYear)
  );
  const currentYearRunningMiles = currentYearRow?.total_distance_miles ?? null;

  const runningSports = new Set(['Run', 'TrailRun', 'VirtualRun']);
  const cyclingSports = new Set([
    'Ride',
    'VirtualRide',
    'GravelRide',
    'EBikeRide',
    'MountainBikeRide'
  ]);
  const swimmingSports = new Set(['Swim', 'OpenWaterSwimming']);

  // Cumulative weekly miles for current year (running + cycling)
  const metersToMiles = (m: number) => m * 0.000621371;
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const currentYearNumber = new Date().getUTCFullYear();
  const yearStartUtc = new Date(Date.UTC(currentYearNumber, 0, 1));
  const yearStartDow = yearStartUtc.getUTCDay();
  const firstWeekStartUtc = new Date(yearStartUtc);
  firstWeekStartUtc.setUTCDate(firstWeekStartUtc.getUTCDate() - ((yearStartDow + 6) % 7));

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const currentWeekIdx = Math.max(
    0,
    Math.floor((todayUtc.getTime() - firstWeekStartUtc.getTime()) / MS_PER_WEEK)
  );

  function weekIndexFromIsoDate(dateStr: string): number {
    const dateUtc = new Date(`${dateStr}T00:00:00Z`);
    return Math.floor((dateUtc.getTime() - firstWeekStartUtc.getTime()) / MS_PER_WEEK);
  }

  function weekStartIsoForIndex(idx: number): string {
    const d = new Date(firstWeekStartUtc);
    d.setUTCDate(d.getUTCDate() + idx * 7);
    return d.toISOString().split('T')[0];
  }

  const weeklyRunningMilesMap = new Map<number, number>();
  const weeklyCyclingMilesMap = new Map<number, number>();
  for (const row of weeklySportBreakdown) {
    if (!row.week_start || !row.total_distance_meters) continue;
    const weekIdx = weekIndexFromIsoDate(row.week_start);
    if (weekIdx < 0 || weekIdx > currentWeekIdx) continue;

    const sport = row.sport_type ?? '';
    const miles = metersToMiles(row.total_distance_meters);
    if (runningSports.has(sport)) {
      weeklyRunningMilesMap.set(weekIdx, (weeklyRunningMilesMap.get(weekIdx) ?? 0) + miles);
    } else if (cyclingSports.has(sport)) {
      weeklyCyclingMilesMap.set(weekIdx, (weeklyCyclingMilesMap.get(weekIdx) ?? 0) + miles);
    }
  }

  function buildFullYearProgress(weekMap: Map<number, number>) {
    const points: { week: string; miles: number }[] = [];
    let cumulative = 0;
    for (let idx = 0; idx <= currentWeekIdx; idx += 1) {
      cumulative += weekMap.get(idx) ?? 0;
      points.push({ week: weekStartIsoForIndex(idx), miles: cumulative });
    }

    return points;
  }

  const runningProgress = buildFullYearProgress(weeklyRunningMilesMap);
  const cyclingProgress = buildFullYearProgress(weeklyCyclingMilesMap);
  const currentYearCyclingMiles =
    cyclingProgress.length > 0 ? cyclingProgress[cyclingProgress.length - 1].miles : 0;

  // Weekly minutes: aggregate by week and sport category
  type WeekEntry = { running: number; cycling: number; swimming: number; other: number };
  const weekBreakdown = new Map<string, WeekEntry>();
  for (const row of weeklyActivityMinutes) {
    if (row.week_start && row.total_moving_minutes) {
      const entry = weekBreakdown.get(row.week_start) ?? {
        running: 0,
        cycling: 0,
        swimming: 0,
        other: 0
      };
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

  // Sport breakdown aggregate across recent 16 weeks
  const sixteenWeeksAgo = new Date();
  sixteenWeeksAgo.setDate(sixteenWeeksAgo.getDate() - 16 * 7);
  const sixteenWeeksAgoStr = sixteenWeeksAgo.toISOString().split('T')[0];
  const sportTotals = new Map<string, number>();
  for (const row of weeklySportBreakdown) {
    if (
      row.sport_type &&
      row.total_moving_minutes &&
      (row.week_start ?? '') >= sixteenWeeksAgoStr
    ) {
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

  const yearlyRunningGoal = userSettings.activeGoals.yearly_running_distance;
  const weeklyWorkoutGoal = userSettings.activeGoals.weekly_workout_minutes;

  const runningCurrent = currentYearRunningMiles ?? 0;
  const weeklyCurrent = thisWeekWorkoutMinutes ?? 0;

  return {
    connection,
    latestSyncRun,
    stats: {
      currentYearRunningMiles,
      currentYearCyclingMiles,
      thisWeekWorkoutMinutes,
      syncedActivityCount: activityCount,
      goals: {
        yearlyRunningDistance: yearlyRunningGoal
          ? {
              target: yearlyRunningGoal.targetValue,
              current: runningCurrent,
              unit: yearlyRunningGoal.unit,
              pct: Math.round((runningCurrent / yearlyRunningGoal.targetValue) * 100)
            }
          : null,
        weeklyWorkoutMinutes: weeklyWorkoutGoal
          ? {
              target: weeklyWorkoutGoal.targetValue,
              current: weeklyCurrent,
              unit: weeklyWorkoutGoal.unit,
              pct: Math.round((weeklyCurrent / weeklyWorkoutGoal.targetValue) * 100)
            }
          : null
      }
    },
    categoryColors: userSettings.colors,
    charts: {
      weeklyMinutes: weeklyMinutesChart,
      monthlyDistance: monthlyDistanceChart,
      yearlyDistance: yearlyDistanceChart,
      sportBreakdown: sportBreakdownChart,
      runningProgress,
      cyclingProgress
    },
    recentActivities
  };
};

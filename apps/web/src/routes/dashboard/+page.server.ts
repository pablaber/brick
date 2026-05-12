import { requireUser } from '$lib/server/auth';
import {
  getActivityCount,
  getLatestSyncRun,
  getMonthlyActivityBreakdown,
  getRecentActivities,
  getStravaConnectionStatus,
  getWeeklyActivityBreakdown,
  getYearlyActivityBreakdown
} from '$lib/server/dashboard';
import { loadUserSettings } from '$lib/server/user-settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const user = await requireUser(event);
  const supabase = event.locals.supabase;
  const userId = user.id;
  const now = new Date();
  const currentYearNumber = now.getUTCFullYear();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [
    connectionResult,
    syncRunResult,
    recentActivitiesResult,
    weeklyBreakdownResult,
    monthlyBreakdownResult,
    yearlyBreakdownResult,
    activityCountResult,
    settingsResult
  ] = await Promise.allSettled([
    getStravaConnectionStatus(supabase, userId),
    getLatestSyncRun(supabase, userId),
    getRecentActivities(supabase, userId),
    getWeeklyActivityBreakdown(supabase, userId, 53),
    getMonthlyActivityBreakdown(supabase, userId, 12),
    getYearlyActivityBreakdown(supabase, userId),
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
  const weeklyActivityBreakdown =
    weeklyBreakdownResult.status === 'fulfilled' ? weeklyBreakdownResult.value : [];
  const monthlyActivityBreakdown =
    monthlyBreakdownResult.status === 'fulfilled' ? monthlyBreakdownResult.value : [];
  const yearlyActivityBreakdown =
    yearlyBreakdownResult.status === 'fulfilled' ? yearlyBreakdownResult.value : [];
  const activityCount =
    activityCountResult.status === 'fulfilled' ? activityCountResult.value : null;
  const userSettings =
    settingsResult.status === 'fulfilled'
      ? settingsResult.value
      : {
          colors: {
            running: '#F97316',
            cycling: '#22C55E',
            swimming: '#0EA5E9',
            other: '#8B5CF6'
          },
          activeGoals: {}
        };

  const runningSports = new Set(['Run', 'TrailRun', 'VirtualRun']);
  const cyclingSports = new Set([
    'Ride',
    'VirtualRide',
    'GravelRide',
    'EBikeRide',
    'MountainBikeRide'
  ]);
  const swimmingSports = new Set(['Swim', 'OpenWaterSwimming']);

  const currentYear = currentYearNumber.toString();
  const yearStartDate = `${currentYear}-01-01`;
  const todayDate = todayUtc.toISOString().split('T')[0];

  function sumDistanceMiles(
    rows: { sport_type: string | null; total_distance_miles: number | null }[],
    sports?: Set<string>
  ): number {
    return rows.reduce((sum, row) => {
      if (sports && !sports.has(row.sport_type ?? '')) return sum;
      return sum + (row.total_distance_miles ?? 0);
    }, 0);
  }

  function buildYearProgress(sports: Set<string>) {
    const monthlyMiles = new Map<string, number>();
    for (const row of monthlyActivityBreakdown) {
      if (
        !row.period_start?.startsWith(currentYear) ||
        !row.total_distance_miles ||
        !sports.has(row.sport_type ?? '')
      ) {
        continue;
      }

      monthlyMiles.set(
        row.period_start,
        (monthlyMiles.get(row.period_start) ?? 0) + row.total_distance_miles
      );
    }

    const points: { date: string; miles: number }[] = [{ date: yearStartDate, miles: 0 }];
    let cumulative = 0;
    for (const [periodStart, miles] of [...monthlyMiles.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      const monthDate = new Date(`${periodStart}T00:00:00Z`);
      const isCurrentMonth =
        monthDate.getUTCFullYear() === todayUtc.getUTCFullYear() &&
        monthDate.getUTCMonth() === todayUtc.getUTCMonth();

      // Hold the line flat until the month starts, then slope across the month.
      if (points[points.length - 1]?.date !== periodStart) {
        points.push({ date: periodStart, miles: cumulative });
      }

      cumulative += miles;
      const pointDate = new Date(monthDate);
      if (!isCurrentMonth) {
        pointDate.setUTCMonth(pointDate.getUTCMonth() + 1);
      }
      const date = isCurrentMonth ? todayDate : pointDate.toISOString().split('T')[0];
      points.push({ date, miles: cumulative });
    }

    if (points[points.length - 1]?.date !== todayDate) {
      points.push({ date: todayDate, miles: cumulative });
    }

    return points;
  }

  const runningProgress = buildYearProgress(runningSports);
  const cyclingProgress = buildYearProgress(cyclingSports);
  const swimmingProgress = buildYearProgress(swimmingSports);
  const currentYearRows = yearlyActivityBreakdown.filter((row) =>
    row.period_start?.startsWith(currentYear)
  );
  const currentYearRunningMiles = sumDistanceMiles(currentYearRows, runningSports);
  const currentYearCyclingMiles = sumDistanceMiles(currentYearRows, cyclingSports);
  const currentYearSwimmingMiles = sumDistanceMiles(currentYearRows, swimmingSports);

  // Weekly minutes: aggregate by week and sport category
  type WeekEntry = { running: number; cycling: number; swimming: number; other: number };
  const weekBreakdown = new Map<string, WeekEntry>();
  const sixteenWeeksAgo = new Date(todayUtc);
  sixteenWeeksAgo.setUTCDate(sixteenWeeksAgo.getUTCDate() - 16 * 7);
  const sixteenWeeksAgoStr = sixteenWeeksAgo.toISOString().split('T')[0];
  for (const row of weeklyActivityBreakdown) {
    if (row.period_start && row.total_moving_minutes && row.period_start >= sixteenWeeksAgoStr) {
      const entry = weekBreakdown.get(row.period_start) ?? {
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
      weekBreakdown.set(row.period_start, entry);
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
  for (const row of monthlyActivityBreakdown) {
    if (row.period_start && row.total_distance_miles) {
      monthMap.set(
        row.period_start,
        (monthMap.get(row.period_start) ?? 0) + row.total_distance_miles
      );
    }
  }
  const monthlyDistanceChart = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, miles]) => ({ month, miles }));

  const yearMap = new Map<string, number>();
  for (const row of yearlyActivityBreakdown) {
    if (row.period_start && row.total_distance_miles) {
      yearMap.set(
        row.period_start,
        (yearMap.get(row.period_start) ?? 0) + row.total_distance_miles
      );
    }
  }
  const yearlyDistanceChart = [...yearMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, miles]) => ({ year, miles }));

  // Sport breakdown aggregate across recent 1 year
  const sportTotals = new Map<string, number>();
  const oneYearAgo = new Date(todayUtc);
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
  for (const row of weeklyActivityBreakdown) {
    if (
      row.sport_type &&
      row.total_moving_minutes &&
      (row.period_start ?? '') >= oneYearAgoStr
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
  const yearlyCyclingGoal = userSettings.activeGoals.yearly_cycling_distance;
  const yearlySwimmingGoal = userSettings.activeGoals.yearly_swimming_distance;
  const weeklyWorkoutGoal = userSettings.activeGoals.weekly_workout_minutes;

  const runningCurrent = currentYearRunningMiles ?? 0;
  const cyclingCurrent = currentYearCyclingMiles ?? 0;
  const swimmingCurrent = currentYearSwimmingMiles ?? 0;
  const weeklyCurrent = thisWeekWorkoutMinutes ?? 0;

  function buildGoalSummary(
    goal: typeof yearlyRunningGoal | typeof yearlyCyclingGoal | typeof yearlySwimmingGoal,
    current: number
  ) {
    if (!goal) return null;
    return {
      target: goal.targetValue,
      current,
      unit: goal.unit,
      pct: Math.round((current / goal.targetValue) * 100)
    };
  }

  return {
    connection,
    latestSyncRun,
    stats: {
      currentYearRunningMiles,
      currentYearCyclingMiles,
      currentYearSwimmingMiles,
      thisWeekWorkoutMinutes,
      syncedActivityCount: activityCount,
      goals: {
        yearlyRunningDistance: buildGoalSummary(yearlyRunningGoal, runningCurrent),
        yearlyCyclingDistance: buildGoalSummary(yearlyCyclingGoal, cyclingCurrent),
        yearlySwimmingDistance: buildGoalSummary(yearlySwimmingGoal, swimmingCurrent),
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
      cyclingProgress,
      swimmingProgress
    },
    recentActivities
  };
};

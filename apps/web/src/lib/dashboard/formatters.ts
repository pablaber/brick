import { metersToMiles } from '@workout/shared';

export function formatMiles(miles: number | null | undefined): string {
  if (miles == null || !Number.isFinite(miles)) return '—';
  return miles.toFixed(1) + ' mi';
}

export function formatMetersAsMiles(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return '—';
  return formatMiles(metersToMiles(meters));
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const m = Math.round(minutes);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  }
  return `${m} min`;
}

export function formatSecondsAsDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  return formatMinutes(seconds / 60);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatMonth(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  // Add noon time to avoid UTC midnight shifting date to previous day/month
  const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatMonthShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short' });
}

export function formatWeek(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatYear(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
  if (isNaN(d.getTime())) return '—';
  return String(d.getFullYear());
}

export function formatSportType(sportType: string | null | undefined): string {
  if (!sportType) return 'Unknown';
  const map: Record<string, string> = {
    Run: 'Run',
    Ride: 'Ride',
    Swim: 'Swim',
    Walk: 'Walk',
    Hike: 'Hike',
    VirtualRide: 'Virtual Ride',
    VirtualRun: 'Virtual Run',
    WeightTraining: 'Weights',
    Yoga: 'Yoga',
    Workout: 'Workout'
  };
  return map[sportType] ?? sportType;
}

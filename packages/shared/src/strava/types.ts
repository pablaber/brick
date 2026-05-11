import type { Database } from '../database.types.js';

export type StravaSummaryActivity = {
  id: number;
  name?: string | null;
  sport_type?: string | null;
  type?: string | null;
  start_date?: string | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  distance?: number | null;
  total_elevation_gain?: number | null;
  average_speed?: number | null;
  max_speed?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  [key: string]: unknown;
};

export type ActivityInsert = Database['public']['Tables']['activities']['Insert'];

export const RUNNING_SPORT_TYPES = ['Run', 'TrailRun', 'VirtualRun'] as const;

export function isRunningSportType(sportType: string | null | undefined): boolean {
  return RUNNING_SPORT_TYPES.some((runningSportType) => runningSportType === sportType);
}

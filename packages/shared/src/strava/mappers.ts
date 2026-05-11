import type { Json } from '../database.types.js';
import type { ActivityInsert, StravaSummaryActivity } from './types.js';

function requireValidStravaActivityId(id: number): number {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Strava activity id must be a positive safe integer.');
  }

  return id;
}

function requireUserId(userId: string): string {
  const trimmedUserId = userId.trim();

  if (trimmedUserId.length === 0) {
    throw new Error('User id is required.');
  }

  return trimmedUserId;
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullableString(value: string | null | undefined): string | null {
  return value ?? null;
}

function normalizeStartDate(startDate: string | null | undefined): string | null {
  if (!startDate) {
    return null;
  }

  const date = new Date(startDate);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function mapStravaActivityToActivityRow(
  activity: StravaSummaryActivity,
  userId: string
): ActivityInsert {
  return {
    user_id: requireUserId(userId),
    strava_activity_id: requireValidStravaActivityId(activity.id),
    name: nullableString(activity.name),
    sport_type: nullableString(activity.sport_type ?? activity.type),
    start_date: normalizeStartDate(activity.start_date),
    moving_time_seconds: nullableNumber(activity.moving_time),
    elapsed_time_seconds: nullableNumber(activity.elapsed_time),
    distance_meters: nullableNumber(activity.distance),
    total_elevation_gain_meters: nullableNumber(activity.total_elevation_gain),
    average_speed_mps: nullableNumber(activity.average_speed),
    max_speed_mps: nullableNumber(activity.max_speed),
    average_heartrate: nullableNumber(activity.average_heartrate),
    max_heartrate: nullableNumber(activity.max_heartrate),
    raw_json: activity as Json
  };
}

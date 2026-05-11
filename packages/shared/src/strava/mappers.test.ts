import { describe, expect, it } from 'vitest';

import { mapStravaActivityToActivityRow } from './mappers.js';
import type { StravaSummaryActivity } from './types.js';

const userId = '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510';

describe('mapStravaActivityToActivityRow', () => {
  it('maps a full Strava activity to the activities insert shape', () => {
    const activity: StravaSummaryActivity = {
      id: 123456789,
      name: 'Morning Run',
      sport_type: 'Run',
      type: 'Workout',
      start_date: '2026-05-10T12:34:56Z',
      moving_time: 3600,
      elapsed_time: 3660,
      distance: 10000.5,
      total_elevation_gain: 120.75,
      average_speed: 2.78,
      max_speed: 5.12,
      average_heartrate: 145.2,
      max_heartrate: 178,
      external_id: 'garmin.fit'
    };

    const row = mapStravaActivityToActivityRow(activity, userId);

    expect(row).toEqual({
      user_id: userId,
      strava_activity_id: 123456789,
      name: 'Morning Run',
      sport_type: 'Run',
      start_date: '2026-05-10T12:34:56.000Z',
      moving_time_seconds: 3600,
      elapsed_time_seconds: 3660,
      distance_meters: 10000.5,
      total_elevation_gain_meters: 120.75,
      average_speed_mps: 2.78,
      max_speed_mps: 5.12,
      average_heartrate: 145.2,
      max_heartrate: 178,
      raw_json: activity
    });
  });

  it('falls back to legacy type when sport_type is missing', () => {
    const row = mapStravaActivityToActivityRow(
      {
        id: 42,
        type: 'Run'
      },
      userId
    );

    expect(row.sport_type).toBe('Run');
  });

  it('maps missing optional fields to null', () => {
    const row = mapStravaActivityToActivityRow({ id: 42 }, userId);

    expect(row).toEqual({
      user_id: userId,
      strava_activity_id: 42,
      name: null,
      sport_type: null,
      start_date: null,
      moving_time_seconds: null,
      elapsed_time_seconds: null,
      distance_meters: null,
      total_elevation_gain_meters: null,
      average_speed_mps: null,
      max_speed_mps: null,
      average_heartrate: null,
      max_heartrate: null,
      raw_json: { id: 42 }
    });
  });

  it('stores null for invalid start dates and non-finite numeric values', () => {
    const row = mapStravaActivityToActivityRow(
      {
        id: 42,
        start_date: 'not-a-date',
        distance: Number.NaN,
        average_speed: Number.POSITIVE_INFINITY
      },
      userId
    );

    expect(row.start_date).toBeNull();
    expect(row.distance_meters).toBeNull();
    expect(row.average_speed_mps).toBeNull();
  });

  it('throws when activity id is missing or invalid', () => {
    expect(() => mapStravaActivityToActivityRow({} as StravaSummaryActivity, userId)).toThrow(
      'Strava activity id must be a positive safe integer.'
    );
    expect(() => mapStravaActivityToActivityRow({ id: 0 }, userId)).toThrow(
      'Strava activity id must be a positive safe integer.'
    );
    expect(() =>
      mapStravaActivityToActivityRow({ id: Number.MAX_SAFE_INTEGER + 1 }, userId)
    ).toThrow('Strava activity id must be a positive safe integer.');
  });

  it('throws when userId is empty', () => {
    expect(() => mapStravaActivityToActivityRow({ id: 42 }, '   ')).toThrow('User id is required.');
  });

  it('does not include generated database fields', () => {
    const row = mapStravaActivityToActivityRow({ id: 42 }, userId);

    expect(row).not.toHaveProperty('id');
    expect(row).not.toHaveProperty('created_at');
    expect(row).not.toHaveProperty('updated_at');
  });
});

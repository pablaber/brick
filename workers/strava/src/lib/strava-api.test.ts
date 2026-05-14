import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import {
  buildStravaActivitiesUrl,
  fetchStravaActivities,
  fetchStravaActivityById,
  fetchStravaActivityTotalCount,
  StravaApiStatusError
} from './strava-api.js';

const testLogger = {
  debug: vi.fn(),
  warn: vi.fn(),
  child: vi.fn(function child() {
    return testLogger;
  })
} as unknown as Logger;

describe('buildStravaActivitiesUrl', () => {
  it('builds activities URL with pagination and time filters', () => {
    const url = buildStravaActivitiesUrl({
      page: 2,
      perPage: 100,
      after: 1_700_000_000,
      before: 1_800_000_000
    });

    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/v3/athlete/activities');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('per_page')).toBe('100');
    expect(parsed.searchParams.get('after')).toBe('1700000000');
    expect(parsed.searchParams.get('before')).toBe('1800000000');
  });
});

describe('fetchStravaActivities', () => {
  it('paginates until an empty page', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 1 }, { id: 2 }]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 3 }]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );

    const activities = await fetchStravaActivities({
      accessToken: 'token',
      fetchImpl,
      maxPages: 10,
      logger: testLogger
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(activities).toHaveLength(3);
  });

  it('respects maxPages', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify([{ id: 1 }]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    );

    await fetchStravaActivities({
      accessToken: 'token',
      fetchImpl,
      maxPages: 2,
      logger: testLogger
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws a safe error when Strava returns non-2xx', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'invalid token' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        })
    );

    await expect(
      fetchStravaActivities({
        accessToken: 'token',
        fetchImpl,
        logger: testLogger
      })
    ).rejects.toThrow('Unable to fetch Strava activities.');
  });
});

describe('fetchStravaActivityTotalCount', () => {
  it('returns summed totals for rides, runs, and swims', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            all_ride_totals: { count: 120 },
            all_run_totals: { count: 80 },
            all_swim_totals: { count: 5 }
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
    );

    const total = await fetchStravaActivityTotalCount({
      accessToken: 'token',
      athleteId: 123,
      fetchImpl,
      logger: testLogger
    });

    expect(total).toBe(205);
  });

  it('returns null for non-2xx responses', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        })
    );

    const total = await fetchStravaActivityTotalCount({
      accessToken: 'token',
      athleteId: 123,
      fetchImpl,
      logger: testLogger
    });

    expect(total).toBeNull();
  });
});

describe('fetchStravaActivityById', () => {
  it('calls the expected endpoint with bearer auth and returns activity', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://www.strava.com/api/v3/activities/456');
      expect(init?.headers).toMatchObject({
        authorization: 'Bearer token-1'
      });

      return new Response(JSON.stringify({ id: 456, name: 'Morning Run' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const activity = await fetchStravaActivityById({
      accessToken: 'token-1',
      activityId: 456,
      fetchImpl,
      logger: testLogger
    });

    expect(activity.id).toBe(456);
    expect(activity.name).toBe('Morning Run');
  });

  it('throws for invalid payload ids', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    );

    await expect(
      fetchStravaActivityById({
        accessToken: 'token-1',
        activityId: 456,
        fetchImpl,
        logger: testLogger
      })
    ).rejects.toThrow('Invalid Strava activity payload id.');
  });

  it('throws typed status errors for supported status codes', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'nope' }), {
          status: 404,
          headers: { 'content-type': 'application/json' }
        })
    );

    await expect(
      fetchStravaActivityById({
        accessToken: 'token-1',
        activityId: 456,
        fetchImpl,
        logger: testLogger
      })
    ).rejects.toEqual(expect.objectContaining({ statusCode: 404 }));

    await expect(
      fetchStravaActivityById({
        accessToken: 'token-1',
        activityId: 456,
        fetchImpl,
        logger: testLogger
      })
    ).rejects.toBeInstanceOf(StravaApiStatusError);
  });
});

import { describe, expect, it, vi } from 'vitest';

import { buildStravaActivitiesUrl, fetchStravaActivities } from './strava-api.js';

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
      maxPages: 10
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
      maxPages: 2
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
        fetchImpl
      })
    ).rejects.toThrow('Unable to fetch Strava activities.');
  });
});

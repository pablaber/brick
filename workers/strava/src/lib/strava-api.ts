import type { StravaSummaryActivity } from '@brick/shared';

const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const STRAVA_ATHLETE_STATS_BASE_URL = 'https://www.strava.com/api/v3/athletes';

export type FetchStravaActivitiesOptions = {
  accessToken: string;
  after?: number;
  before?: number;
  perPage?: number;
  maxPages?: number;
  fetchImpl?: typeof fetch;
};

export type FetchStravaActivityTotalCountOptions = {
  accessToken: string;
  athleteId: number;
  fetchImpl?: typeof fetch;
};

export async function fetchStravaActivities({
  accessToken,
  after,
  before,
  perPage = 100,
  maxPages = 10,
  fetchImpl = fetch
}: FetchStravaActivitiesOptions): Promise<StravaSummaryActivity[]> {
  const activities: StravaSummaryActivity[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const url = buildStravaActivitiesUrl({ page, perPage, after, before });

    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Unable to fetch Strava activities.');
    }

    const raw = (await response.json()) as unknown;
    const pageActivities = normalizeActivitiesPage(raw);

    if (pageActivities.length === 0) {
      break;
    }

    activities.push(...pageActivities);
  }

  return activities;
}

export async function fetchStravaActivityTotalCount({
  accessToken,
  athleteId,
  fetchImpl = fetch
}: FetchStravaActivityTotalCountOptions): Promise<number | null> {
  if (!Number.isSafeInteger(athleteId) || athleteId <= 0) {
    return null;
  }

  const response = await fetchImpl(`${STRAVA_ATHLETE_STATS_BASE_URL}/${athleteId}/stats`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const raw = (await response.json()) as unknown;
  return normalizeActivityCountFromStats(raw);
}

export function buildStravaActivitiesUrl({
  page,
  perPage,
  after,
  before
}: {
  page: number;
  perPage: number;
  after?: number;
  before?: number;
}) {
  const url = new URL(STRAVA_ACTIVITIES_URL);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));

  if (typeof after === 'number' && Number.isFinite(after)) {
    url.searchParams.set('after', String(Math.floor(after)));
  }

  if (typeof before === 'number' && Number.isFinite(before)) {
    url.searchParams.set('before', String(Math.floor(before)));
  }

  return url.toString();
}

function normalizeActivitiesPage(raw: unknown): StravaSummaryActivity[] {
  if (!Array.isArray(raw)) {
    throw new Error('Invalid activities response from Strava.');
  }

  return raw.map((entry) => normalizeStravaSummaryActivity(entry));
}

function normalizeStravaSummaryActivity(raw: unknown): StravaSummaryActivity {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid activity payload from Strava.');
  }

  const activity = raw as Partial<StravaSummaryActivity>;
  if (!Number.isSafeInteger(activity.id) || (activity.id ?? 0) <= 0) {
    throw new Error('Invalid Strava activity payload id.');
  }

  return activity as StravaSummaryActivity;
}

function normalizeActivityCountFromStats(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const stats = raw as {
    all_ride_totals?: { count?: unknown };
    all_run_totals?: { count?: unknown };
    all_swim_totals?: { count?: unknown };
  };

  const rideCount = normalizeCount(stats.all_ride_totals?.count);
  const runCount = normalizeCount(stats.all_run_totals?.count);
  const swimCount = normalizeCount(stats.all_swim_totals?.count);
  const total = rideCount + runCount + swimCount;

  return total > 0 ? total : null;
}

function normalizeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

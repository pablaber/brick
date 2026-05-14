import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@brick/shared';
import type { Logger } from 'pino';

import type { Env } from '../env.js';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const EXPIRING_SOON_WINDOW_MS = 5 * 60 * 1000;

type StravaConnectionRow = Database['public']['Tables']['strava_connections']['Row'];

type RefreshStravaTokenOptions = {
  env: Pick<Env, 'STRAVA_CLIENT_ID' | 'STRAVA_CLIENT_SECRET' | 'LOG_LEVEL'>;
  supabase: SupabaseClient<Database>;
  connection: StravaConnectionRow;
  fetchImpl?: typeof fetch;
  logger?: Logger;
};

export function isTokenExpiredOrExpiringSoon(expiresAt: string, nowMs = Date.now()) {
  const expiresAtMs = new Date(expiresAt).getTime();

  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= nowMs + EXPIRING_SOON_WINDOW_MS;
}

export async function refreshStravaToken({
  env,
  supabase,
  connection,
  fetchImpl = fetch,
  logger
}: RefreshStravaTokenOptions): Promise<StravaConnectionRow> {
  const log =
    logger?.child({
      methodName: 'refreshStravaToken',
      userId: connection.user_id
    }) ?? logger;
  if (!connection.refresh_token) {
    throw new Error('Unable to refresh Strava token without a refresh token.');
  }
  log?.debug('Requesting Strava token refresh.');

  const response = await fetchImpl(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token: connection.refresh_token
    }).toString()
  });
  log?.debug(
    {
      status: response.status,
      ok: response.ok
    },
    'Received Strava token refresh response.'
  );

  if (!response.ok) {
    const responseBody = await readResponseBodySnippet(response);
    log?.warn(
      {
        status: response.status,
        responseBody
      },
      'Strava token refresh failed.'
    );
    throw new Error('Unable to refresh Strava token.');
  }

  const raw = (await response.json()) as unknown;

  const refreshedToken = normalizeStravaRefreshTokenResponse(raw);
  if (
    refreshedToken.athleteId !== null &&
    refreshedToken.athleteId !== connection.strava_athlete_id
  ) {
    log?.error(
      {
        expectedAthleteId: connection.strava_athlete_id,
        actualAthleteId: refreshedToken.athleteId
      },
      'Strava refresh token response athlete id mismatch.'
    );
    throw new Error('Refreshed token athlete mismatch.');
  }
  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(refreshedToken.expires_at * 1000).toISOString();

  const { error } = await supabase
    .from('strava_connections')
    .update({
      access_token: refreshedToken.access_token,
      refresh_token: refreshedToken.refresh_token,
      expires_at: expiresAtIso,
      scope: refreshedToken.scope ?? connection.scope,
      updated_at: nowIso
    })
    .eq('user_id', connection.user_id);

  if (error) {
    throw new Error('Unable to persist refreshed Strava token.');
  }

  return {
    ...connection,
    access_token: refreshedToken.access_token,
    refresh_token: refreshedToken.refresh_token,
    expires_at: expiresAtIso,
    scope: refreshedToken.scope ?? connection.scope,
    updated_at: nowIso
  };
}

type StravaRefreshTokenResponse = {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  scope?: string;
  athleteId: number | null;
};

function normalizeStravaRefreshTokenResponse(raw: unknown): StravaRefreshTokenResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid token response from Strava.');
  }

  const record = raw as Record<string, unknown>;
  const tokenType = record.token_type;
  const expiresAt = record.expires_at;
  const expiresIn = record.expires_in;
  const refreshToken = record.refresh_token;
  const accessToken = record.access_token;
  const scope = record.scope;
  const athleteId = parseOptionalAthleteId(record.athlete);

  if (typeof tokenType !== 'string') {
    throw new Error('Invalid token_type in Strava response.');
  }
  if (typeof expiresAt !== 'number' || !Number.isInteger(expiresAt) || expiresAt <= 0) {
    throw new Error('Invalid expires_at in Strava response.');
  }
  if (typeof expiresIn !== 'number' || !Number.isInteger(expiresIn) || expiresIn < 0) {
    throw new Error('Invalid expires_in in Strava response.');
  }
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new Error('Invalid refresh_token in Strava response.');
  }
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Invalid access_token in Strava response.');
  }
  if (scope !== undefined && typeof scope !== 'string') {
    throw new Error('Invalid scope in Strava response.');
  }

  return {
    token_type: tokenType,
    expires_at: expiresAt,
    expires_in: expiresIn,
    refresh_token: refreshToken,
    access_token: accessToken,
    scope: scope as string | undefined,
    athleteId
  };
}

function parseOptionalAthleteId(rawAthlete: unknown): number | null {
  if (!rawAthlete || typeof rawAthlete !== 'object') {
    return null;
  }

  const athlete = rawAthlete as { id?: unknown };
  if (athlete.id == null) {
    return null;
  }
  if (typeof athlete.id === 'number' && Number.isSafeInteger(athlete.id) && athlete.id > 0) {
    return athlete.id;
  }

  return null;
}

async function readResponseBodySnippet(
  response: Response,
  maxLength = 1_000
): Promise<string | null> {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }

    return text.length > maxLength ? `${text.slice(0, maxLength)}...[truncated]` : text;
  } catch {
    return null;
  }
}

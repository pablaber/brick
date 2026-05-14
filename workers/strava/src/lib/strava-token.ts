import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@brick/shared';

import type { Env } from '../env.js';
import { normalizeStravaTokenResponse } from './strava-oauth.js';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const EXPIRING_SOON_WINDOW_MS = 5 * 60 * 1000;

type StravaConnectionRow = Database['public']['Tables']['strava_connections']['Row'];

type RefreshStravaTokenOptions = {
  env: Pick<Env, 'STRAVA_CLIENT_ID' | 'STRAVA_CLIENT_SECRET'>;
  supabase: SupabaseClient<Database>;
  connection: StravaConnectionRow;
  fetchImpl?: typeof fetch;
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
  fetchImpl = fetch
}: RefreshStravaTokenOptions): Promise<StravaConnectionRow> {
  if (!connection.refresh_token) {
    throw new Error('Unable to refresh Strava token without a refresh token.');
  }

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

  if (!response.ok) {
    throw new Error('Unable to refresh Strava token.');
  }

  const raw = (await response.json()) as unknown;

  const refreshedToken = normalizeStravaTokenResponse(raw);
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

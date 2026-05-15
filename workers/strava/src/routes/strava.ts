import { Hono } from 'hono';
import { verifySignedConnectToken } from '@brick/shared';

import type { Env } from '../env.js';
import { createServiceSupabaseClient } from '../lib/supabase.js';
import { buildStravaAuthorizeUrl, exchangeStravaCodeForToken } from '../lib/strava-oauth.js';

export const stravaRoutes = new Hono<{ Bindings: Env }>();

const STRAVA_SCOPE = 'read,activity:read_all';
const OAUTH_PROVIDER = 'strava';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

stravaRoutes.get('/connect', async (c) => {
  const token = c.req.query('token');
  if (!token) {
    return c.json({ ok: false, error: 'Missing token.' }, 400);
  }

  let payload: { userId: string };
  try {
    payload = await verifySignedConnectToken(token, c.env.WORKER_SHARED_SECRET);
  } catch (error) {
    console.warn('Invalid connect token.', error);
    return c.json({ ok: false, error: 'Invalid token.' }, 401);
  }

  const state = createOAuthState();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_SECONDS * 1000).toISOString();
  const supabase = createServiceSupabaseClient(c.env);
  const { error } = await supabase.from('oauth_states').insert({
    user_id: payload.userId,
    provider: OAUTH_PROVIDER,
    state,
    expires_at: expiresAt
  });

  if (error) {
    console.error('Failed to insert oauth state.', error);
    return c.json({ ok: false, error: 'Unable to start OAuth flow.' }, 500);
  }

  const authorizeUrl = buildStravaAuthorizeUrl({
    clientId: c.env.STRAVA_CLIENT_ID,
    redirectUri: c.env.STRAVA_REDIRECT_URI,
    scope: STRAVA_SCOPE,
    state
  });

  return c.redirect(authorizeUrl, 302);
});

stravaRoutes.get('/callback', async (c) => {
  const oauthError = c.req.query('error');
  if (oauthError) {
    const status = oauthError === 'access_denied' ? 'denied' : 'error';
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, status), 302);
  }

  const state = c.req.query('state');
  if (!state) {
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'invalid_state'), 302);
  }

  const code = c.req.query('code');
  if (!code) {
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
  }

  const supabase = createServiceSupabaseClient(c.env);
  const { data: oauthState, error: oauthStateError } = await supabase
    .from('oauth_states')
    .select('id,user_id,provider,state,expires_at,used_at')
    .eq('provider', OAUTH_PROVIDER)
    .eq('state', state)
    .maybeSingle();

  if (oauthStateError) {
    console.error('Failed to fetch oauth state.', oauthStateError);
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
  }

  if (!oauthState) {
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'invalid_state'), 302);
  }

  if (oauthState.used_at) {
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'invalid_state'), 302);
  }

  if (oauthState.provider !== OAUTH_PROVIDER) {
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'invalid_state'), 302);
  }

  if (new Date(oauthState.expires_at).getTime() <= Date.now()) {
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'invalid_state'), 302);
  }

  let tokenResponse;
  try {
    tokenResponse = await exchangeStravaCodeForToken({
      clientId: c.env.STRAVA_CLIENT_ID,
      clientSecret: c.env.STRAVA_CLIENT_SECRET,
      code
    });
  } catch (error) {
    console.error('Strava token exchange failed.', error);
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
  }

  const { data: existingActiveConnections, error: existingConnectionError } = await supabase
    .from('strava_connections')
    .select('user_id')
    .eq('strava_athlete_id', tokenResponse.athlete.id)
    .is('deauthorized_at', null)
    .neq('user_id', oauthState.user_id)
    .limit(1);

  if (existingConnectionError) {
    console.error('Failed to check existing Strava connection.', existingConnectionError);
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
  }

  if ((existingActiveConnections ?? []).length > 0) {
    const existingConnection = existingActiveConnections?.[0];
    if (!existingConnection) {
      return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
    }

    const existingConnectionUpdated = await updateExistingConnectionTokens({
      supabase,
      userId: existingConnection.user_id,
      tokenResponse
    });

    if (!existingConnectionUpdated) {
      return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
    }

    const markedUsed = await markOAuthStateUsed({
      supabase,
      oauthStateId: oauthState.id
    });

    if (!markedUsed) {
      return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
    }

    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'already_connected'), 302);
  }

  const { error: upsertError } = await supabase.from('strava_connections').upsert(
    {
      user_id: oauthState.user_id,
      strava_athlete_id: tokenResponse.athlete.id,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: new Date(tokenResponse.expires_at * 1000).toISOString(),
      scope: tokenResponse.scope ?? STRAVA_SCOPE,
      deauthorized_at: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  );

  if (upsertError) {
    console.error('Failed to upsert strava connection.', upsertError);
    if (isUniqueConstraintViolation(upsertError)) {
      const existingConnectionUpdated = await refreshExistingConnectionForAthlete({
        supabase,
        athleteId: tokenResponse.athlete.id,
        currentUserId: oauthState.user_id,
        tokenResponse
      });

      if (!existingConnectionUpdated) {
        return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
      }

      const markedUsed = await markOAuthStateUsed({
        supabase,
        oauthStateId: oauthState.id
      });

      if (!markedUsed) {
        return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
      }

      return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'already_connected'), 302);
    }
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
  }

  const markedUsed = await markOAuthStateUsed({
    supabase,
    oauthStateId: oauthState.id
  });
  if (!markedUsed) {
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
  }

  return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'connected'), 302);
});

function buildSettingsRedirectUrl(appUrl: string, status: string) {
  const url = new URL('/settings', appUrl);
  if (status) {
    url.searchParams.set('strava', status);
  }
  return url.toString();
}

async function refreshExistingConnectionForAthlete({
  supabase,
  athleteId,
  currentUserId,
  tokenResponse
}: {
  supabase: ReturnType<typeof createServiceSupabaseClient>;
  athleteId: number;
  currentUserId: string;
  tokenResponse: Awaited<ReturnType<typeof exchangeStravaCodeForToken>>;
}) {
  const { data: existingActiveConnections, error } = await supabase
    .from('strava_connections')
    .select('user_id')
    .eq('strava_athlete_id', athleteId)
    .is('deauthorized_at', null)
    .neq('user_id', currentUserId)
    .limit(1);

  if (error) {
    console.error('Failed to reload existing Strava connection after uniqueness conflict.', error);
    return false;
  }

  const existingConnection = existingActiveConnections?.[0];
  if (!existingConnection) {
    return false;
  }

  return updateExistingConnectionTokens({
    supabase,
    userId: existingConnection.user_id,
    tokenResponse
  });
}

async function updateExistingConnectionTokens({
  supabase,
  userId,
  tokenResponse
}: {
  supabase: ReturnType<typeof createServiceSupabaseClient>;
  userId: string;
  tokenResponse: Awaited<ReturnType<typeof exchangeStravaCodeForToken>>;
}) {
  const { error } = await supabase
    .from('strava_connections')
    .update({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: new Date(tokenResponse.expires_at * 1000).toISOString(),
      scope: tokenResponse.scope ?? STRAVA_SCOPE,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to refresh existing Strava connection tokens.', error);
    return false;
  }

  return true;
}

async function markOAuthStateUsed({
  supabase,
  oauthStateId
}: {
  supabase: ReturnType<typeof createServiceSupabaseClient>;
  oauthStateId: string;
}) {
  const { error } = await supabase
    .from('oauth_states')
    .update({ used_at: new Date().toISOString() })
    .eq('id', oauthStateId);

  if (error) {
    console.error('Failed to mark oauth state as used.', error);
    return false;
  }

  return true;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? (error as { code?: unknown }).code : null;
  return code === '23505';
}

function createOAuthState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  let state = '';
  for (const byte of bytes) {
    state += byte.toString(16).padStart(2, '0');
  }
  return state;
}

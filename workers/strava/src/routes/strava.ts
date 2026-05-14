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
    return c.redirect(buildSettingsRedirectUrl(c.env.APP_URL, 'error'), 302);
  }

  const { error: markUsedError } = await supabase
    .from('oauth_states')
    .update({ used_at: new Date().toISOString() })
    .eq('id', oauthState.id);

  if (markUsedError) {
    console.error('Failed to mark oauth state as used.', markUsedError);
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

function createOAuthState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  let state = '';
  for (const byte of bytes) {
    state += byte.toString(16).padStart(2, '0');
  }
  return state;
}

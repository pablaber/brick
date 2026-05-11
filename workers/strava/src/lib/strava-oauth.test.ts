import { describe, expect, it } from 'vitest';

import {
  buildStravaAuthorizeUrl,
  exchangeStravaCodeForToken,
  normalizeStravaTokenResponse
} from './strava-oauth.js';

describe('strava oauth helpers', () => {
  it('buildStravaAuthorizeUrl includes expected params', () => {
    const url = buildStravaAuthorizeUrl({
      clientId: '12345',
      redirectUri: 'http://localhost:8787/strava/callback',
      scope: 'read,activity:read_all',
      state: 'state-123'
    });
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://www.strava.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('12345');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:8787/strava/callback');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('scope')).toBe('read,activity:read_all');
    expect(parsed.searchParams.get('state')).toBe('state-123');
  });

  it('normalizeStravaTokenResponse validates the token payload shape', () => {
    const token = normalizeStravaTokenResponse({
      token_type: 'Bearer',
      expires_at: 1_700_000_000,
      expires_in: 3600,
      refresh_token: 'refresh-token',
      access_token: 'access-token',
      athlete: {
        id: 42
      }
    });

    expect(token.athlete.id).toBe(42);
  });

  it('exchangeStravaCodeForToken exchanges code and normalizes the response', async () => {
    const response = await exchangeStravaCodeForToken({
      clientId: '12345',
      clientSecret: 'secret',
      code: 'oauth-code',
      fetchImpl: async (input, init) => {
        const request = new Request(input, init);
        const body = await request.text();
        const params = new URLSearchParams(body);

        expect(params.get('client_id')).toBe('12345');
        expect(params.get('client_secret')).toBe('secret');
        expect(params.get('code')).toBe('oauth-code');
        expect(params.get('grant_type')).toBe('authorization_code');

        return new Response(
          JSON.stringify({
            token_type: 'Bearer',
            expires_at: 1_700_000_000,
            expires_in: 3600,
            refresh_token: 'refresh-token',
            access_token: 'access-token',
            athlete: {
              id: 42
            }
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        );
      }
    });

    expect(response.access_token).toBe('access-token');
  });
});

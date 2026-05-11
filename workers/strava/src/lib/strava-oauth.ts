const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

type BuildStravaAuthorizeUrlOptions = {
  clientId: string;
  redirectUri: string;
  responseType?: 'code';
  approvalPrompt?: 'auto' | 'force';
  scope: string;
  state: string;
};

type ExchangeStravaCodeForTokenOptions = {
  clientId: string;
  clientSecret: string;
  code: string;
  fetchImpl?: typeof fetch;
};

export type StravaTokenExchangeResponse = {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  scope?: string;
  athlete: {
    id: number;
  };
};

export function buildStravaAuthorizeUrl({
  clientId,
  redirectUri,
  responseType = 'code',
  approvalPrompt = 'auto',
  scope,
  state
}: BuildStravaAuthorizeUrlOptions) {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    approval_prompt: approvalPrompt,
    scope,
    state
  });

  return `${STRAVA_AUTHORIZE_URL}?${query.toString()}`;
}

export async function exchangeStravaCodeForToken({
  clientId,
  clientSecret,
  code,
  fetchImpl = fetch
}: ExchangeStravaCodeForTokenOptions) {
  const response = await fetchImpl(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code'
    }).toString()
  });

  const raw = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error('Strava token exchange failed.');
  }

  return normalizeStravaTokenResponse(raw);
}

export function normalizeStravaTokenResponse(raw: unknown): StravaTokenExchangeResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid token response from Strava.');
  }

  const record = raw as Partial<StravaTokenExchangeResponse>;
  const athleteId = record.athlete?.id;
  const expiresAt = record.expires_at;
  const expiresIn = record.expires_in;
  const tokenType = record.token_type;
  const refreshToken = record.refresh_token;
  const accessToken = record.access_token;
  const scope = record.scope;

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
  if (!Number.isSafeInteger(athleteId) || (athleteId ?? 0) <= 0) {
    throw new Error('Invalid athlete.id in Strava response.');
  }
  if (scope !== undefined && typeof scope !== 'string') {
    throw new Error('Invalid scope in Strava response.');
  }
  const normalizedAthleteId = athleteId as number;

  return {
    token_type: tokenType,
    expires_at: expiresAt,
    expires_in: expiresIn,
    refresh_token: refreshToken,
    access_token: accessToken,
    scope,
    athlete: {
      id: normalizedAthleteId
    }
  };
}

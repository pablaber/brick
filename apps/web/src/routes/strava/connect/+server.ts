import { STRAVA_WORKER_URL, WORKER_SHARED_SECRET } from '$env/static/private';
import { redirect } from '@sveltejs/kit';
import { createSignedConnectToken } from '@workout/shared';

import { requireUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const CONNECT_TOKEN_TTL_SECONDS = 5 * 60;

export const POST: RequestHandler = async (event) => {
  const user = await requireUser(event);

  const workerUrl = STRAVA_WORKER_URL?.trim();
  const sharedSecret = WORKER_SHARED_SECRET?.trim();

  if (!workerUrl || !sharedSecret) {
    console.error('Missing STRAVA_WORKER_URL or WORKER_SHARED_SECRET.');
    throw redirect(303, '/settings?strava=error');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const token = await createSignedConnectToken(
    {
      userId: user.id,
      iat: nowSeconds,
      exp: nowSeconds + CONNECT_TOKEN_TTL_SECONDS,
      nonce: crypto.randomUUID()
    },
    sharedSecret
  );

  const startUrl = new URL('/strava/connect', workerUrl);
  startUrl.searchParams.set('token', token);

  throw redirect(303, startUrl.toString());
};

export const GET = POST;

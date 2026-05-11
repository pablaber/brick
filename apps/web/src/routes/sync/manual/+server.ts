import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import { createSignedManualSyncToken } from '@workout/shared';

import { requireUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const SYNC_TOKEN_TTL_SECONDS = 5 * 60;

type WorkerSyncResponse = {
  ok?: boolean;
  error?: string;
};

export const POST: RequestHandler = async (event) => {
  const user = await requireUser(event);

  const workerUrl = env.STRAVA_WORKER_URL?.trim();
  const sharedSecret = env.WORKER_SHARED_SECRET?.trim();

  if (!workerUrl || !sharedSecret) {
    console.error('Missing STRAVA_WORKER_URL or WORKER_SHARED_SECRET.');
    throw redirect(303, '/settings?sync=error');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const token = await createSignedManualSyncToken(
    {
      userId: user.id,
      iat: nowSeconds,
      exp: nowSeconds + SYNC_TOKEN_TTL_SECONDS,
      nonce: crypto.randomUUID(),
      action: 'manual_sync'
    },
    sharedSecret
  );

  const url = new URL('/sync/manual', workerUrl);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (response.ok) {
      const body = (await response.json()) as WorkerSyncResponse;
      if (body.ok) {
        throw redirect(303, '/settings?sync=success');
      }

      throw redirect(303, '/settings?sync=error');
    }

    if (response.status === 409) {
      throw redirect(303, '/settings?sync=running');
    }

    if (response.status === 400) {
      throw redirect(303, '/settings?sync=not_connected');
    }

    throw redirect(303, '/settings?sync=error');
  } catch (error) {
    if (isRedirect(error)) {
      throw error;
    }

    console.error('Manual sync request failed.', error);
    throw redirect(303, '/settings?sync=error');
  }
};

function isRedirect(error: unknown): error is { status: number } {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

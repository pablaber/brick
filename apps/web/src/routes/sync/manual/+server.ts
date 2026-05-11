import { env } from '$env/dynamic/private';
import { json, redirect } from '@sveltejs/kit';
import { createSignedManualSyncToken } from '@workout/shared';

import { requireUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const SYNC_TOKEN_TTL_SECONDS = 5 * 60;

type ManualSyncRequestPayload = {
  cursorBefore?: number;
  syncRunId?: string;
  estimatedTotalActivities?: number;
};

type WorkerSyncResponse = {
  ok?: boolean;
  error?: string;
  syncRunId?: string;
  batchActivitiesFetched?: number;
  totalActivitiesFetched?: number;
  activitiesUpserted?: number;
  hasMore?: boolean;
  nextCursorBefore?: number | null;
  estimatedTotalActivities?: number | null;
  lastSyncedAt?: string;
};

export const POST: RequestHandler = async (event) => {
  const user = await requireUser(event);

  const workerUrl = env.STRAVA_WORKER_URL?.trim();
  const sharedSecret = env.WORKER_SHARED_SECRET?.trim();

  if (!workerUrl || !sharedSecret) {
    console.error('Missing STRAVA_WORKER_URL or WORKER_SHARED_SECRET.');

    if (expectsJson(event.request)) {
      return json({ ok: false, error: 'Sync is not configured.' }, { status: 500 });
    }

    throw redirect(303, '/settings?sync=error');
  }

  const payload = await parseJsonPayload(event.request);
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
      body: JSON.stringify({
        token,
        cursorBefore: payload?.cursorBefore,
        syncRunId: payload?.syncRunId,
        estimatedTotalActivities: payload?.estimatedTotalActivities
      })
    });

    const responseBody = (await response.json()) as WorkerSyncResponse;

    if (expectsJson(event.request)) {
      return json(responseBody, { status: response.status });
    }

    if (response.ok && responseBody.ok && responseBody.hasMore) {
      throw redirect(303, '/settings?sync=running');
    }

    if (response.ok && responseBody.ok) {
      throw redirect(303, '/settings?sync=success');
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

    if (expectsJson(event.request)) {
      return json({ ok: false, error: 'Manual sync request failed.' }, { status: 500 });
    }

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

function expectsJson(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  const contentType = request.headers.get('content-type') ?? '';

  return accept.includes('application/json') || contentType.includes('application/json');
}

async function parseJsonPayload(request: Request): Promise<ManualSyncRequestPayload | null> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== 'object') {
      return null;
    }

    const record = body as Record<string, unknown>;
    return {
      cursorBefore: normalizePositiveNumber(record.cursorBefore),
      syncRunId: typeof record.syncRunId === 'string' ? record.syncRunId : undefined,
      estimatedTotalActivities: normalizePositiveNumber(record.estimatedTotalActivities)
    };
  } catch {
    return null;
  }
}

function normalizePositiveNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.floor(value);
}

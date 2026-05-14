import { env } from '$env/dynamic/private';
import { json, redirect } from '@sveltejs/kit';
import { createSignedManualSyncToken } from '@brick/shared';

import { requireUser } from '$lib/server/auth';
import { createRequestLogger } from '$lib/server/logger';
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
  const expectsJsonResponse = expectsJson(event.request);
  const requestLogger = createRequestLogger({
    request: event.request,
    methodName: 'POST /sync/manual',
    values: { expectsJson: expectsJsonResponse }
  });
  requestLogger.debug('Manual sync request received.');

  const user = await requireUser(event);
  const log = requestLogger.child({ userId: user.id });

  const workerUrl = env.STRAVA_WORKER_URL?.trim();
  const sharedSecret = env.WORKER_SHARED_SECRET?.trim();

  if (!workerUrl || !sharedSecret) {
    log.error('Missing STRAVA_WORKER_URL or WORKER_SHARED_SECRET.');

    if (expectsJsonResponse) {
      return json({ ok: false, error: 'Sync is not configured.' }, { status: 500 });
    }

    throw redirect(303, '/settings?sync=error');
  }

  const payload = await parseJsonPayload(event.request);
  log.debug(
    {
      hasPayload: Boolean(payload)
    },
    'Manual sync payload parsed.'
  );
  log.info(
    {
      cursorBefore: payload?.cursorBefore ?? null,
      syncRunId: payload?.syncRunId ?? null,
      estimatedTotalActivities: payload?.estimatedTotalActivities ?? null
    },
    'Manual sync requested.'
  );

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
  log.debug(
    {
      workerOrigin: url.origin,
      workerPath: url.pathname
    },
    'Calling Strava worker manual sync endpoint.'
  );

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
    log.debug(
      {
        responseStatus: response.status,
        responseOk: response.ok
      },
      'Manual sync worker response received.'
    );
    log.info(
      {
        status: response.status,
        ok: response.ok,
        bodyOk: responseBody.ok ?? null,
        syncRunId: responseBody.syncRunId ?? null,
        hasMore: responseBody.hasMore ?? null,
        nextCursorBefore: responseBody.nextCursorBefore ?? null,
        totalActivitiesFetched: responseBody.totalActivitiesFetched ?? null,
        activitiesUpserted: responseBody.activitiesUpserted ?? null,
        error: responseBody.error ?? null
      },
      'Manual sync worker response.'
    );

    if (expectsJsonResponse) {
      return json(responseBody, { status: response.status });
    }

    if (response.ok && responseBody.ok && responseBody.hasMore) {
      log.info(
        {
          syncRunId: responseBody.syncRunId ?? payload?.syncRunId ?? null
        },
        'Manual sync redirecting with running status.'
      );
      throw redirect(303, '/settings?sync=running');
    }

    if (response.ok && responseBody.ok) {
      log.info(
        {
          syncRunId: responseBody.syncRunId ?? payload?.syncRunId ?? null
        },
        'Manual sync redirecting with success status.'
      );
      throw redirect(303, '/settings?sync=success');
    }

    if (response.status === 409) {
      log.info(
        {
          syncRunId: responseBody.syncRunId ?? payload?.syncRunId ?? null
        },
        'Manual sync redirecting with running status (409 conflict).'
      );
      throw redirect(303, '/settings?sync=running');
    }

    if (response.status === 400) {
      log.info('Manual sync redirecting with not_connected status.');
      throw redirect(303, '/settings?sync=not_connected');
    }

    log.warn(
      {
        status: response.status,
        error: responseBody.error ?? null
      },
      'Manual sync redirecting with error status due to worker response.'
    );
    throw redirect(303, '/settings?sync=error');
  } catch (error) {
    if (isRedirect(error)) {
      throw error;
    }

    log.error({ err: error }, 'Manual sync request failed.');

    if (expectsJsonResponse) {
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

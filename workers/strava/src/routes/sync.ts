import { Hono } from 'hono';
import { verifySignedManualSyncToken } from '@brick/shared';

import type { Env } from '../env.js';
import { createRequestLogger } from '../lib/logger.js';
import { syncUserActivities } from '../lib/sync.js';

export const syncRoutes = new Hono<{ Bindings: Env }>();

type ManualSyncRequestBody = {
  token?: string;
  cursorBefore?: number;
  syncRunId?: string;
  estimatedTotalActivities?: number;
};

syncRoutes.post('/manual', async (c) => {
  const requestLogger = createRequestLogger({
    env: c.env,
    request: c.req.raw,
    methodName: 'POST /sync/manual'
  });
  const body = await parseJsonBody(c.req.raw);
  const token = body?.token;
  requestLogger.debug(
    {
      hasToken: Boolean(token),
      hasCursorBefore: typeof body?.cursorBefore === 'number',
      hasSyncRunId: typeof body?.syncRunId === 'string',
      hasEstimatedTotalActivities: typeof body?.estimatedTotalActivities === 'number'
    },
    'Manual sync request received.'
  );

  if (!token) {
    requestLogger.warn('Manual sync request missing token.');
    return c.json({ ok: false, error: 'Missing token.' }, 400);
  }

  let payload: { userId: string };
  try {
    payload = await verifySignedManualSyncToken(token, c.env.WORKER_SHARED_SECRET);
  } catch (error) {
    requestLogger.warn({ err: error }, 'Invalid manual sync token.');
    return c.json({ ok: false, error: 'Invalid token.' }, 401);
  }
  const log = requestLogger.child({ userId: payload.userId });
  log.debug('Manual sync token verified.');

  const result = await syncUserActivities({
    env: c.env,
    userId: payload.userId,
    syncType: 'manual',
    triggeredBy: 'manual-route',
    logger: log,
    cursorBefore: body?.cursorBefore,
    requestedSyncRunId: body?.syncRunId,
    estimatedTotalActivities: body?.estimatedTotalActivities
  });
  log.debug(
    {
      ok: result.ok,
      statusCode: result.statusCode,
      skipped: result.skipped,
      skipReason: result.skipReason,
      syncRunId: result.syncRunId,
      batchActivitiesFetched: result.batchActivitiesFetched,
      totalActivitiesFetched: result.totalActivitiesFetched,
      activitiesUpserted: result.activitiesUpserted,
      hasMore: result.hasMore,
      nextCursorBefore: result.nextCursorBefore,
      error: result.error
    },
    'Manual sync completed.'
  );

  if (result.skipped && result.skipReason === 'running_sync') {
    log.info(
      {
        syncRunId: result.syncRunId
      },
      'Manual sync skipped because another sync is running.'
    );
    return c.json({ ok: false, error: 'A sync is already running.' }, 409);
  }

  if (!result.ok) {
    const status = result.statusCode === 400 ? 400 : 500;
    log.warn(
      {
        status,
        syncRunId: result.syncRunId,
        error: result.error
      },
      'Manual sync failed.'
    );
    return c.json({ ok: false, error: result.error ?? 'Manual sync failed.' }, status);
  }

  return c.json({
    ok: true,
    syncRunId: result.syncRunId,
    batchActivitiesFetched: result.batchActivitiesFetched,
    totalActivitiesFetched: result.totalActivitiesFetched,
    activitiesUpserted: result.activitiesUpserted,
    hasMore: result.hasMore,
    nextCursorBefore: result.nextCursorBefore,
    estimatedTotalActivities: result.estimatedTotalActivities,
    lastSyncedAt: result.lastSyncedAt
  });
});

async function parseJsonBody(request: Request): Promise<ManualSyncRequestBody | null> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== 'object') {
      return null;
    }
    return body as ManualSyncRequestBody;
  } catch {
    return null;
  }
}

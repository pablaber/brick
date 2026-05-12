import { Hono } from 'hono';
import { verifySignedManualSyncToken } from '@workout/shared';

import type { Env } from '../env.js';
import { syncUserActivities } from '../lib/sync.js';

export const syncRoutes = new Hono<{ Bindings: Env }>();

type ManualSyncRequestBody = {
  token?: string;
  cursorBefore?: number;
  syncRunId?: string;
  estimatedTotalActivities?: number;
};

syncRoutes.post('/manual', async (c) => {
  const body = await parseJsonBody(c.req.raw);
  const token = body?.token;

  if (!token) {
    return c.json({ ok: false, error: 'Missing token.' }, 400);
  }

  let payload: { userId: string };
  try {
    payload = await verifySignedManualSyncToken(token, c.env.WORKER_SHARED_SECRET);
  } catch (error) {
    console.warn('Invalid manual sync token.', error);
    return c.json({ ok: false, error: 'Invalid token.' }, 401);
  }

  const result = await syncUserActivities({
    env: c.env,
    userId: payload.userId,
    syncType: 'manual',
    triggeredBy: 'manual-route',
    cursorBefore: body?.cursorBefore,
    requestedSyncRunId: body?.syncRunId,
    estimatedTotalActivities: body?.estimatedTotalActivities
  });

  if (result.skipped && result.skipReason === 'running_sync') {
    return c.json({ ok: false, error: 'A sync is already running.' }, 409);
  }

  if (!result.ok) {
    const status = result.statusCode === 400 ? 400 : 500;
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

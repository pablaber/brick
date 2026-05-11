import { Hono } from 'hono';

import type { Env } from '../env.js';

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'strava-worker',
    timestamp: new Date().toISOString()
  });
});

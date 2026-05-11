import { Hono } from 'hono';

import type { Env } from '../env.js';

export const syncRoutes = new Hono<{ Bindings: Env }>();

syncRoutes.post('/manual', (c) => {
  return c.json({
    ok: true,
    message: 'Manual sync route placeholder'
  });
});

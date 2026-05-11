import { Hono } from 'hono';

import type { Env } from '../env.js';

export const stravaRoutes = new Hono<{ Bindings: Env }>();

stravaRoutes.get('/connect', (c) => {
  return c.json({
    ok: true,
    message: 'Strava connect route placeholder'
  });
});

stravaRoutes.get('/callback', (c) => {
  return c.json({
    ok: true,
    message: 'Strava callback route placeholder'
  });
});

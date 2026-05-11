import { Hono } from 'hono';

import type { Env } from './env.js';
import { handleError } from './middleware/error.js';
import { healthRoutes } from './routes/health.js';
import { stravaRoutes } from './routes/strava.js';
import { syncRoutes } from './routes/sync.js';

const app = new Hono<{ Bindings: Env }>();

app.route('/', healthRoutes);
app.route('/strava', stravaRoutes);
app.route('/sync', syncRoutes);

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: 'Not found'
    },
    404
  );
});

app.onError(handleError);

export default app;

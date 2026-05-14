import { Hono } from 'hono';

import type { Env } from './env.js';
import { runScheduledSync } from './lib/scheduled-sync.js';
import { handleError } from './middleware/error.js';
import { healthRoutes } from './routes/health.js';
import { stravaRoutes } from './routes/strava.js';
import { syncRoutes } from './routes/sync.js';
import { webhookRoutes } from './routes/webhook.js';

const app = new Hono<{ Bindings: Env }>();

app.route('/', healthRoutes);
app.route('/strava', stravaRoutes);
app.route('/strava', webhookRoutes);
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

export { app };

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledSync({ env, controller }));
  }
};

import type { Context } from 'hono';

import type { Env } from '../env.js';

export function handleError(error: unknown, c: Context<{ Bindings: Env }>) {
  console.error('Unhandled worker error', error);

  return c.json(
    {
      ok: false,
      error: 'Internal server error'
    },
    500
  );
}

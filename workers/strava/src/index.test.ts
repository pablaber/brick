import { describe, expect, it } from 'vitest';

import app from './index.js';

describe('strava worker routes', () => {
  it('GET /health returns a healthy response', async () => {
    const response = await app.request('/health');
    const body = await response.json<{
      ok: boolean;
      service: string;
    }>();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe('strava-worker');
  });

  it('GET /strava/connect returns placeholder payload', async () => {
    const response = await app.request('/strava/connect');

    expect(response.status).toBe(200);
  });

  it('GET /strava/callback returns placeholder payload', async () => {
    const response = await app.request('/strava/callback');

    expect(response.status).toBe(200);
  });

  it('POST /sync/manual returns placeholder payload', async () => {
    const response = await app.request('/sync/manual', { method: 'POST' });

    expect(response.status).toBe(200);
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await app.request('/unknown');
    const body = await response.json<{
      ok: boolean;
      error: string;
    }>();

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Not found');
  });
});

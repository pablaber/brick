#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const WORKER_URL = process.env.WORKER_URL ?? 'http://localhost:8787';
const CRON = process.env.CRON ?? '0 */6 * * *';
const STARTUP_TIMEOUT_MS = Number.parseInt(process.env.STARTUP_TIMEOUT_MS ?? '30000', 10);

let stopped = false;
const wrangler = spawn('pnpm', ['exec', 'wrangler', 'dev', '--test-scheduled'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

async function stopWrangler(exitCode = 0) {
  if (stopped) {
    return;
  }

  stopped = true;

  if (!wrangler.killed) {
    wrangler.kill('SIGTERM');
  }

  await delay(250);
  process.exit(exitCode);
}

process.on('SIGINT', () => {
  void stopWrangler(130);
});

process.on('SIGTERM', () => {
  void stopWrangler(143);
});

try {
  await waitForHealth(`${WORKER_URL}/health`, STARTUP_TIMEOUT_MS);

  const triggerUrl = new URL('/__scheduled', WORKER_URL);
  triggerUrl.searchParams.set('cron', CRON);
  console.log(`Triggering scheduled sync: ${triggerUrl.toString()}`);

  const response = await fetch(triggerUrl, { method: 'GET' });
  const responseText = await response.text();

  console.log(`Scheduled endpoint status: ${response.status}`);
  console.log(responseText);

  await stopWrangler(response.ok ? 0 : 1);
} catch (error) {
  console.error(
    'Scheduled sync test failed:',
    error instanceof Error ? error.message : String(error)
  );
  await stopWrangler(1);
}

async function waitForHealth(url, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }

    await delay(500);
  }

  throw new Error(`Worker health check timed out after ${timeoutMs}ms.`);
}

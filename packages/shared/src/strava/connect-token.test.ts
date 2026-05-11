import { describe, expect, it } from 'vitest';

import {
  createSignedManualSyncToken,
  createSignedConnectToken,
  type ConnectTokenPayload,
  type ManualSyncTokenPayload,
  verifySignedManualSyncToken,
  verifySignedConnectToken
} from './connect-token.js';

const sharedSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function buildPayload(nowSeconds: number): ConnectTokenPayload {
  return {
    userId: '2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510',
    iat: nowSeconds,
    exp: nowSeconds + 300,
    nonce: 'nonce-1'
  };
}

function buildManualSyncPayload(nowSeconds: number): ManualSyncTokenPayload {
  return {
    ...buildPayload(nowSeconds),
    action: 'manual_sync'
  };
}

describe('strava connect token signing', () => {
  it('accepts a valid token', async () => {
    const nowSeconds = 1_700_000_000;
    const token = await createSignedConnectToken(buildPayload(nowSeconds), sharedSecret);

    const payload = await verifySignedConnectToken(token, sharedSecret, { nowSeconds });

    expect(payload.userId).toBe('2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510');
  });

  it('rejects tampered tokens', async () => {
    const nowSeconds = 1_700_000_000;
    const token = await createSignedConnectToken(buildPayload(nowSeconds), sharedSecret);
    const [payload, signature] = token.split('.');
    const tamperedPayload = `${payload}x`;

    await expect(
      verifySignedConnectToken(`${tamperedPayload}.${signature}`, sharedSecret, { nowSeconds })
    ).rejects.toThrow('Invalid token signature.');
  });

  it('rejects expired tokens', async () => {
    const token = await createSignedConnectToken(buildPayload(1_700_000_000), sharedSecret);

    await expect(
      verifySignedConnectToken(token, sharedSecret, { nowSeconds: 1_700_000_301 })
    ).rejects.toThrow('Token expired.');
  });
});

describe('strava manual sync token signing', () => {
  it('accepts a valid manual sync token', async () => {
    const nowSeconds = 1_700_000_000;
    const token = await createSignedManualSyncToken(
      buildManualSyncPayload(nowSeconds),
      sharedSecret
    );

    const payload = await verifySignedManualSyncToken(token, sharedSecret, { nowSeconds });

    expect(payload.action).toBe('manual_sync');
    expect(payload.userId).toBe('2b4698be-0ebd-4a4a-a6f1-3c65ce9a4510');
  });

  it('rejects token with invalid action', async () => {
    const nowSeconds = 1_700_000_000;
    const token = await createSignedConnectToken(buildPayload(nowSeconds), sharedSecret);

    await expect(verifySignedManualSyncToken(token, sharedSecret, { nowSeconds })).rejects.toThrow(
      'Invalid token action.'
    );
  });
});

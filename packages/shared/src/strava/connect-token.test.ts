import { describe, expect, it } from 'vitest';

import {
  createSignedConnectToken,
  type ConnectTokenPayload,
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

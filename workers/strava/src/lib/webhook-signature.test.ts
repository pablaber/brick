import { describe, expect, it } from 'vitest';

import { parseStravaSignatureHeader, verifyStravaWebhookSignature } from './webhook-signature.js';

const SIGNING_SECRET = 'test-signing-secret';
const FIXED_NOW_MS = 1_714_000_000_000;

describe('parseStravaSignatureHeader', () => {
  it('parses a valid signature header', () => {
    const parsed = parseStravaSignatureHeader(
      't=1714000000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8f9'
    );

    expect(parsed).toEqual({
      timestamp: 1714000000,
      signatureHex: '5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8f9'
    });
  });

  it('rejects malformed headers', () => {
    expect(parseStravaSignatureHeader('')).toBeNull();
    expect(parseStravaSignatureHeader('t=abc,v1=xyz')).toBeNull();
    expect(parseStravaSignatureHeader('t=1714000000')).toBeNull();
  });
});

describe('verifyStravaWebhookSignature', () => {
  it('verifies a valid signature', async () => {
    const body = JSON.stringify({ object_type: 'activity', object_id: 123 });
    const timestamp = Math.floor(FIXED_NOW_MS / 1000);
    const signature = await createSignature(`${timestamp}.${body}`, SIGNING_SECRET);

    const verified = await verifyStravaWebhookSignature({
      signatureHeader: `t=${timestamp},v1=${signature}`,
      rawBody: body,
      signingSecret: SIGNING_SECRET,
      nowMs: FIXED_NOW_MS
    });

    expect(verified).toBe(true);
  });

  it('rejects invalid signatures', async () => {
    const body = JSON.stringify({ object_type: 'activity', object_id: 123 });
    const timestamp = Math.floor(FIXED_NOW_MS / 1000);

    const verified = await verifyStravaWebhookSignature({
      signatureHeader: `t=${timestamp},v1=${'0'.repeat(64)}`,
      rawBody: body,
      signingSecret: SIGNING_SECRET,
      nowMs: FIXED_NOW_MS
    });

    expect(verified).toBe(false);
  });

  it('rejects signatures outside the timestamp window', async () => {
    const body = JSON.stringify({ object_type: 'activity', object_id: 123 });
    const timestamp = Math.floor(FIXED_NOW_MS / 1000) - 301;
    const signature = await createSignature(`${timestamp}.${body}`, SIGNING_SECRET);

    const verified = await verifyStravaWebhookSignature({
      signatureHeader: `t=${timestamp},v1=${signature}`,
      rawBody: body,
      signingSecret: SIGNING_SECRET,
      nowMs: FIXED_NOW_MS
    });

    expect(verified).toBe(false);
  });
});

async function createSignature(payload: string, signingSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

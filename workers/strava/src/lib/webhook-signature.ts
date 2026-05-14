const DEFAULT_TOLERANCE_SECONDS = 300;

export type ParsedStravaSignature = {
  timestamp: number;
  signatureHex: string;
};

export type VerifyStravaSignatureOptions = {
  signatureHeader: string;
  rawBody: string;
  signingSecret: string;
  nowMs?: number;
  toleranceSeconds?: number;
};

export async function verifyStravaWebhookSignature({
  signatureHeader,
  rawBody,
  signingSecret,
  nowMs = Date.now(),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS
}: VerifyStravaSignatureOptions): Promise<boolean> {
  const parsed = parseStravaSignatureHeader(signatureHeader);
  if (!parsed) {
    return false;
  }

  const timestampAgeSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.timestamp);
  if (timestampAgeSeconds > toleranceSeconds) {
    return false;
  }

  const payload = `${parsed.timestamp}.${rawBody}`;
  const expectedSignature = await computeHmacSha256Hex(payload, signingSecret);

  return timingSafeEqualHex(expectedSignature, parsed.signatureHex);
}

export function parseStravaSignatureHeader(value: string): ParsedStravaSignature | null {
  const parts = Object.fromEntries(
    value
      .split(',')
      .map((entry) => entry.trim())
      .map((entry) => entry.split('=', 2))
      .filter((entry) => entry.length === 2)
  );

  const timestampRaw = parts.t;
  const signatureRaw = parts.v1;

  if (!timestampRaw || !signatureRaw) {
    return null;
  }

  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return null;
  }

  const signatureHex = signatureRaw.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(signatureHex)) {
    return null;
  }

  return {
    timestamp,
    signatureHex
  };
}

async function computeHmacSha256Hex(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const bytes = new Uint8Array(signature);

  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }

  return hex;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

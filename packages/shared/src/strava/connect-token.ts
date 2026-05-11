const TOKEN_DELIMITER = '.';
const DEFAULT_MAX_FUTURE_IAT_SKEW_SECONDS = 60;
const MANUAL_SYNC_ACTION = 'manual_sync';

export type SignedUserTokenPayload = {
  userId: string;
  iat: number;
  exp: number;
  nonce: string;
};

export type ConnectTokenPayload = SignedUserTokenPayload;

export type ManualSyncTokenPayload = SignedUserTokenPayload & {
  action: typeof MANUAL_SYNC_ACTION;
};

export type VerifyConnectTokenOptions = {
  nowSeconds?: number;
  maxFutureIatSkewSeconds?: number;
};

export async function createSignedConnectToken(
  payload: ConnectTokenPayload,
  secret: string
): Promise<string> {
  validatePayloadShape(payload);
  assertSecret(secret);

  const payloadSegment = base64UrlEncodeText(JSON.stringify(payload));
  const signatureSegment = await signSegment(payloadSegment, secret);

  return `${payloadSegment}${TOKEN_DELIMITER}${signatureSegment}`;
}

export async function verifySignedConnectToken(
  token: string,
  secret: string,
  options: VerifyConnectTokenOptions = {}
): Promise<ConnectTokenPayload> {
  return verifySignedUserToken(token, secret, options);
}

export async function createSignedManualSyncToken(
  payload: ManualSyncTokenPayload,
  secret: string
): Promise<string> {
  validateManualSyncPayloadShape(payload);
  assertSecret(secret);

  const payloadSegment = base64UrlEncodeText(JSON.stringify(payload));
  const signatureSegment = await signSegment(payloadSegment, secret);

  return `${payloadSegment}${TOKEN_DELIMITER}${signatureSegment}`;
}

export async function verifySignedManualSyncToken(
  token: string,
  secret: string,
  options: VerifyConnectTokenOptions = {}
): Promise<ManualSyncTokenPayload> {
  const payload = (await verifySignedUserToken(
    token,
    secret,
    options
  )) as SignedUserTokenPayload & {
    action?: unknown;
  };

  if (payload.action !== MANUAL_SYNC_ACTION) {
    throw new Error('Invalid token action.');
  }

  return payload as ManualSyncTokenPayload;
}

async function verifySignedUserToken(
  token: string,
  secret: string,
  options: VerifyConnectTokenOptions = {}
): Promise<SignedUserTokenPayload> {
  assertSecret(secret);

  const parts = token.split(TOKEN_DELIMITER);
  if (parts.length !== 2) {
    throw new Error('Invalid token format.');
  }

  const [payloadSegment, signatureSegment] = parts;
  if (!payloadSegment || !signatureSegment) {
    throw new Error('Invalid token format.');
  }

  const expectedSignatureSegment = await signSegment(payloadSegment, secret);
  if (!constantTimeEquals(signatureSegment, expectedSignatureSegment)) {
    throw new Error('Invalid token signature.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecodeText(payloadSegment));
  } catch {
    throw new Error('Invalid token payload.');
  }

  validatePayloadShape(parsed);

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxFutureIatSkewSeconds =
    options.maxFutureIatSkewSeconds ?? DEFAULT_MAX_FUTURE_IAT_SKEW_SECONDS;

  if (parsed.exp <= nowSeconds) {
    throw new Error('Token expired.');
  }

  if (parsed.iat > nowSeconds + maxFutureIatSkewSeconds) {
    throw new Error('Token issued in the future.');
  }

  return parsed;
}

async function signSegment(segment: string, secret: string): Promise<string> {
  const subtle = getRuntimeSubtle();
  const key = await subtle.importKey(
    'raw',
    utf8Encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await subtle.sign('HMAC', key, utf8Encode(segment));

  return base64UrlEncodeBytes(new Uint8Array(signatureBuffer));
}

function getRuntimeSubtle() {
  const runtimeCrypto = (globalThis as { crypto?: { subtle?: unknown } }).crypto;
  if (!runtimeCrypto?.subtle) {
    throw new Error('Web Crypto API is not available in this runtime.');
  }

  return runtimeCrypto.subtle as {
    importKey: (...args: unknown[]) => Promise<unknown>;
    sign: (...args: unknown[]) => Promise<ArrayBuffer>;
  };
}

function assertSecret(secret: string) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Token secret must be at least 32 characters.');
  }
}

function validatePayloadShape(payload: unknown): asserts payload is ConnectTokenPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid token payload.');
  }

  const maybePayload = payload as Partial<ConnectTokenPayload>;
  const iat = maybePayload.iat;
  const exp = maybePayload.exp;

  if (typeof maybePayload.userId !== 'string' || maybePayload.userId.trim().length === 0) {
    throw new Error('Token payload must include userId.');
  }

  if (typeof iat !== 'number' || !Number.isInteger(iat) || iat <= 0) {
    throw new Error('Token payload must include a valid iat.');
  }

  if (typeof exp !== 'number' || !Number.isInteger(exp) || exp <= iat) {
    throw new Error('Token payload must include a valid exp.');
  }

  if (typeof maybePayload.nonce !== 'string' || maybePayload.nonce.trim().length === 0) {
    throw new Error('Token payload must include nonce.');
  }
}

function validateManualSyncPayloadShape(
  payload: unknown
): asserts payload is ManualSyncTokenPayload {
  validatePayloadShape(payload);

  const maybePayload = payload as Partial<ManualSyncTokenPayload>;
  if (maybePayload.action !== MANUAL_SYNC_ACTION) {
    throw new Error('Token payload must include action.');
  }
}

function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function base64UrlEncodeText(value: string): string {
  return base64UrlEncodeBytes(utf8Encode(value));
}

function base64UrlDecodeText(value: string): string {
  const bytes = base64UrlDecodeToBytes(value);
  return new TextDecoder().decode(bytes);
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  const base64 = bytesToBase64(bytes);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return base64ToBytes(padded);
}

function bytesToBase64(bytes: Uint8Array): string {
  const btoaFn = (globalThis as { btoa?: (value: string) => string }).btoa;
  if (!btoaFn) {
    throw new Error('Base64 encoding is not available in this runtime.');
  }
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoaFn(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const atobFn = (globalThis as { atob?: (value: string) => string }).atob;
  if (!atobFn) {
    throw new Error('Base64 decoding is not available in this runtime.');
  }
  const binary = atobFn(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

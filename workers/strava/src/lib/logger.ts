import pino, { type LevelWithSilent, type Logger } from 'pino';

import type { Env } from '../env.js';

type CreateRequestLoggerOptions = {
  env: Pick<Env, 'LOG_LEVEL'>;
  request: Request;
  methodName: string;
  values?: Record<string, unknown>;
};
type CreateLoggerOptions = {
  env: Pick<Env, 'LOG_LEVEL'>;
  values?: Record<string, unknown>;
};

let cachedLogger: Logger | null = null;
let cachedLevel: LevelWithSilent | null = null;

export function createLogger({ env, values }: CreateLoggerOptions): Logger {
  if (!values) {
    return getLogger(env);
  }

  return getLogger(env).child(values);
}

export function createRequestLogger({
  env,
  request,
  methodName,
  values
}: CreateRequestLoggerOptions): Logger {
  const url = new URL(request.url);
  const requestId = resolveRequestId(request);
  const fields: Record<string, unknown> = {
    methodName,
    requestMethod: request.method,
    requestPath: url.pathname,
    ...values
  };

  if (requestId) {
    fields.requestId = requestId;
  }

  return getLogger(env).child(fields);
}

function getLogger(env: Pick<Env, 'LOG_LEVEL'>): Logger {
  const level = resolveLogLevel(env.LOG_LEVEL);
  if (!cachedLogger || cachedLevel !== level) {
    cachedLogger = pino({
      level,
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      browser: {
        asObject: true,
        write: {
          trace: (obj) => console.debug(withCloudflareLevel(obj, 'debug')),
          debug: (obj) => console.debug(withCloudflareLevel(obj, 'debug')),
          info: (obj) => console.info(withCloudflareLevel(obj, 'info')),
          warn: (obj) => console.warn(withCloudflareLevel(obj, 'warn')),
          error: (obj) => console.error(withCloudflareLevel(obj, 'error')),
          fatal: (obj) => console.error(withCloudflareLevel(obj, 'error'))
        }
      }
    });
    cachedLevel = level;
  }

  return cachedLogger;
}

function resolveRequestId(request: Request): string | null {
  return (
    request.headers.get('cf-ray') ??
    request.headers.get('x-request-id') ??
    request.headers.get('cf-request-id')
  );
}

function resolveLogLevel(logLevel: unknown): LevelWithSilent {
  const configuredLevel = normalizeLogLevel(logLevel);
  if (configuredLevel) {
    return configuredLevel;
  }

  return 'info';
}

function normalizeLogLevel(value: unknown): LevelWithSilent | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'fatal' ||
    normalized === 'error' ||
    normalized === 'warn' ||
    normalized === 'info' ||
    normalized === 'debug' ||
    normalized === 'trace' ||
    normalized === 'silent'
  ) {
    return normalized;
  }

  return null;
}

function withCloudflareLevel(
  obj: object,
  level: 'debug' | 'info' | 'warn' | 'error'
): Record<string, unknown> {
  return {
    ...(obj as Record<string, unknown>),
    level
  };
}

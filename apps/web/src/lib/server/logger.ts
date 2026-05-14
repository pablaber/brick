import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import pino, { type LevelWithSilent, type Logger } from 'pino';

export const logger = pino({
  level: resolveLogLevel(),
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

type CreateRequestLoggerOptions = {
  request: Request;
  methodName: string;
  values?: Record<string, unknown>;
};

export function createRequestLogger({
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

  return logger.child(fields);
}

function resolveRequestId(request: Request): string | null {
  return (
    request.headers.get('cf-ray') ??
    request.headers.get('x-request-id') ??
    request.headers.get('cf-request-id')
  );
}

function resolveLogLevel(): LevelWithSilent {
  const configuredLevel = normalizeLogLevel(env.LOG_LEVEL ?? globalThis.process?.env?.LOG_LEVEL);
  if (configuredLevel) {
    return configuredLevel;
  }

  return dev ? 'debug' : 'info';
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

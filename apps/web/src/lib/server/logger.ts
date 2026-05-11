import { dev } from '$app/environment';
import pino from 'pino';

export const logger = pino({
  level: dev ? 'debug' : 'info',
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime
});

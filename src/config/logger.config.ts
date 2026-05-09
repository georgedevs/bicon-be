import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';
import { randomUUID } from 'crypto';

const maskPhone = (value: string): string => {
  if (typeof value !== 'string' || value.length < 6) return '****';
  return (
    value.slice(0, 4) +
    '*'.repeat(Math.max(value.length - 6, 1)) +
    value.slice(-2)
  );
};

const maskPhonesInObject = (obj: unknown): unknown => {
  if (typeof obj !== 'object' || obj === null) return obj;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
      if (typeof v === 'string' && /\+?\d{7,15}/.test(v))
        return [k, maskPhone(v)];
      if (typeof v === 'object') return [k, maskPhonesInObject(v)];
      return [k, v];
    }),
  );
};

export const getPinoConfig = (configService: ConfigService) => {
  const isProd = configService.get<string>('nodeEnv') === 'production';

  return {
    // Override nestjs-pino's default { path: '*' } with the NestJS 11 named wildcard
    // to prevent LegacyRouteConverter warnings from path-to-regexp v8
    forRoutes: [{ path: '*path', method: RequestMethod.ALL }],

    pinoHttp: {
      level: isProd ? 'info' : 'debug',

      transport: !isProd
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,

      formatters: {
        level: (label: string) => ({ level: label }),
      },

      serializers: {
        req: (req: IncomingMessage & { query?: unknown }) => ({
          id: (req as unknown as { id?: string }).id,
          method: req.method,
          url: req.url,
          query: maskPhonesInObject(req.query),
        }),
        res: (res: { statusCode: number }) => ({
          statusCode: res.statusCode,
        }),
      },

      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.adminSecret',
          'req.body.password',
          'req.body.apiKey',
          'req.body.webhookSecret',
        ],
        censor: '***REDACTED***',
      },

      genReqId: (req: IncomingMessage) =>
        (req.headers['x-correlation-id'] as string) ||
        (req.headers['x-request-id'] as string) ||
        randomUUID(),

      customLogLevel: (_req: IncomingMessage, res: { statusCode: number }) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },

      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === '/health',
      },
    },
  };
};

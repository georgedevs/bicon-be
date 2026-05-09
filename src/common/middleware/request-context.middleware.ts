import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { RequestContextService } from '../services/request-context.service.js';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly contextService: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Honour distributed tracing headers from API gateways / load balancers
    const traceId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      (req.id as string) ||
      randomUUID();

    this.contextService.setContext({ traceId, requestId: traceId });

    // Echo the trace ID back so clients can correlate logs
    res.setHeader('x-trace-id', traceId);

    next();
  }
}

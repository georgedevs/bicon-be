import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  traceId: string;
  requestId?: string;
  module?: string;
  service?: string;
  method?: string;
  userId?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  getContext(): RequestContext | undefined {
    return this.storage.getStore();
  }

  getTraceId(): string | undefined {
    return this.storage.getStore()?.traceId;
  }

  setContext(context: RequestContext): void {
    this.storage.enterWith(context);
  }

  assign(partial: Partial<RequestContext>): void {
    const current = this.storage.getStore();
    if (current) Object.assign(current, partial);
  }

  /**
   * Wraps a callback in a new context — use this in BullMQ processors
   * and webhook handlers that run outside the HTTP request lifecycle.
   */
  run<T>(
    context: RequestContext,
    callback: () => T | Promise<T>,
  ): T | Promise<T> {
    return this.storage.run(context, callback);
  }
}

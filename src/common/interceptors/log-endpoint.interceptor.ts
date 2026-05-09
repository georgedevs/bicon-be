import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Response } from 'express';
import { RequestContextService } from '../services/request-context.service.js';

@Injectable()
export class LogEndpointInterceptor implements NestInterceptor {
  constructor(
    @InjectPinoLogger(LogEndpointInterceptor.name)
    private readonly logger: PinoLogger,
    private readonly contextService: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler().name;
    const controller = context.getClass().name;
    const start = Date.now();

    this.contextService.assign({ service: controller, method: handler });

    return next.handle().pipe(
      tap(() => {
        const status = context
          .switchToHttp()
          .getResponse<Response>().statusCode;
        this.logger.info(
          { duration: Date.now() - start, statusCode: status },
          `${controller}.${handler}`,
        );
      }),
      catchError((err: unknown) => {
        this.logger.error(
          { duration: Date.now() - start, err },
          `${controller}.${handler} failed`,
        );
        return throwError(() => err);
      }),
    );
  }
}

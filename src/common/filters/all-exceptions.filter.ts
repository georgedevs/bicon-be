import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Request, Response } from 'express';
import { apiResponse } from '../utils/api-response.util.js';

const maskPhone = (str: string): string =>
  str.replace(/\+?(\d{4})\d+(\d{2})/g, '$1***$2');

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : ((rawMessage as { message?: string }).message ?? 'Error');

    if (status >= 500) {
      this.logger.error(
        {
          method: request.method,
          url: maskPhone(request.url),
          statusCode: status,
          err:
            exception instanceof Error
              ? exception
              : new Error(String(exception)),
        },
        'Unhandled exception',
      );
    } else {
      this.logger.warn(
        {
          method: request.method,
          url: maskPhone(request.url),
          statusCode: status,
        },
        message,
      );
    }

    response.status(status).json(apiResponse(message, status));
  }
}

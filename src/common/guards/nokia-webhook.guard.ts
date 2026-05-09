import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class NokiaWebhookGuard implements CanActivate {
  private readonly logger = new Logger(NokiaWebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get<string>('nokia.webhookSecret');
    if (!secret) {
      // No webhook secret configured — allow through (sandbox/ngrok dev mode)
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('Nokia webhook request missing Authorization Bearer header');
      throw new UnauthorizedException('Missing webhook authorization');
    }

    const token = authHeader.slice(7); // strip "Bearer "

    const expectedBuffer = Buffer.from(secret);
    const tokenBuffer = Buffer.from(token);

    if (
      expectedBuffer.length !== tokenBuffer.length ||
      !timingSafeEqual(expectedBuffer, tokenBuffer)
    ) {
      this.logger.warn('Nokia webhook token mismatch');
      throw new UnauthorizedException('Invalid webhook token');
    }

    return true;
  }
}

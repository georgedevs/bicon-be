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
export class AfricasTalkingWebhookGuard implements CanActivate {
  private readonly logger = new Logger(AfricasTalkingWebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const providedKey =
      (request.headers['apikey'] as string | undefined) ||
      (request.query['apiKey'] as string | undefined);

    if (!providedKey) {
      this.logger.warn("Africa's Talking webhook missing API key");
      throw new UnauthorizedException('Missing API key');
    }

    const configuredKey = this.configService.get<string>(
      'africasTalking.apiKey',
    );
    if (!configuredKey) {
      this.logger.error('AT_API_KEY is not configured');
      throw new UnauthorizedException('Webhook verification not configured');
    }

    const configuredBuffer = Buffer.from(configuredKey);
    const providedBuffer = Buffer.from(providedKey);

    if (
      configuredBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(configuredBuffer, providedBuffer)
    ) {
      this.logger.warn("Africa's Talking webhook API key mismatch");
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}

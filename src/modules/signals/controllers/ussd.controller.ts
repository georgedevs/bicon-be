import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import { AfricasTalkingWebhookGuard } from '../../../common/guards/at-webhook.guard.js';
import {
  IncidentType,
  SIGNAL_INGESTION_QUEUE,
  SignalSource,
  SignalType,
} from '../../../common/types/constant.js';
import { UssdWebhookDto } from '../signals.dto.js';

@ApiTags('webhooks')
@Controller('webhooks/ussd')
export class UssdController {
  constructor(
    @InjectQueue(SIGNAL_INGESTION_QUEUE) private readonly ingestionQueue: Queue,
  ) {}

  @Post()
  @Public()
  @UseGuards(AfricasTalkingWebhookGuard)
  @HttpCode(HttpStatus.OK)
  async handleUssd(
    @Body() body: UssdWebhookDto,
    @Res() res: Response,
  ): Promise<void> {
    const { sessionId, phoneNumber, text } = body;
    const steps = text.split('*').filter(Boolean);
    let response: string;

    if (steps.length === 0) {
      response = 'CON Welcome to Bicon Emergency\n1. Report Emergency';
    } else if (steps[0] === '1' && steps.length === 1) {
      response =
        'CON Type of emergency?\n1. Accident\n2. Fire\n3. Medical\n4. Other';
    } else if (steps[0] === '1' && steps.length === 2) {
      const typeMap: Record<string, IncidentType> = {
        '1': IncidentType.ROAD_ACCIDENT,
        '2': IncidentType.FIRE,
        '3': IncidentType.MEDICAL,
        '4': IncidentType.UNKNOWN,
      };
      const incidentType = typeMap[steps[1]] ?? IncidentType.UNKNOWN;

      await this.ingestionQueue.add('ussd-signal', {
        source: SignalSource.USSD,
        type: SignalType.HUMAN,
        phoneNumber,
        incidentType,
        rawPayload: { sessionId, serviceCode: body.serviceCode, text },
      });

      response = `END Help is on the way. Stay safe and keep your phone on.`;
    } else {
      response = 'END Invalid input. Please dial again.';
    }

    res.set('Content-Type', 'text/plain').send(response);
  }
}

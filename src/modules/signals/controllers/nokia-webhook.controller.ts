import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { NokiaWebhookGuard } from '../../../common/guards/nokia-webhook.guard.js';
import { SIGNAL_INGESTION_QUEUE, SignalSource, SignalType } from '../../../common/types/constant.js';
import { NokiaGeofenceWebhookDto } from '../signals.dto.js';

@ApiTags('webhooks')
@Controller('webhooks/nokia')
export class NokiaWebhookController {
  constructor(
    @InjectQueue(SIGNAL_INGESTION_QUEUE) private readonly ingestionQueue: Queue,
  ) {}

  @Post()
  @Public()
  @UseGuards(NokiaWebhookGuard)
  @HttpCode(HttpStatus.OK)
  async handleGeofenceEvent(@Body() body: NokiaGeofenceWebhookDto) {
    // Nokia sends CloudEvents: payload fields are in body.data
    // Curl tests / legacy format send fields at top level
    const payload = body.data ?? body;
    const device = payload.device ?? body.device;
    const area = payload.area ?? body.area;
    const subscriptionId = payload.subscriptionId ?? body.subscriptionId;

    const phoneNumber = device?.phoneNumber ?? device?.networkAccessIdentifier;
    const coordinates = area?.center
      ? { lat: area.center.latitude, lng: area.center.longitude }
      : undefined;

    await this.ingestionQueue.add('nokia-geofence', {
      source: SignalSource.GEOFENCE,
      type: SignalType.NETWORK_PASSIVE,
      phoneNumber,
      zoneId: subscriptionId,
      coordinates,
      rawPayload: body as unknown as Record<string, unknown>,
    });

    return { received: true };
  }
}

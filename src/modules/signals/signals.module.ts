import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Signal, SignalSchema } from './schemas/signal.schema.js';
import { SignalRepository } from './repositories/signal.repository.js';
import { SignalIngestionProcessor } from './workers/signal-ingestion.processor.js';
import { NokiaWebhookController } from './controllers/nokia-webhook.controller.js';
import { UssdController } from './controllers/ussd.controller.js';
import {
  AGENTIC_INCIDENT_QUEUE,
  SIGNAL_INGESTION_QUEUE,
  VES_SCORING_QUEUE,
} from '../../common/types/constant.js';
import { IncidentsModule } from '../incidents/incidents.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Signal.name, schema: SignalSchema }]),
    BullModule.registerQueue({ name: SIGNAL_INGESTION_QUEUE }),
    BullModule.registerQueue({ name: VES_SCORING_QUEUE }),
    BullModule.registerQueue({ name: AGENTIC_INCIDENT_QUEUE }),
    IncidentsModule,
  ],
  controllers: [NokiaWebhookController, UssdController],
  providers: [SignalRepository, SignalIngestionProcessor],
})
export class SignalsModule {}

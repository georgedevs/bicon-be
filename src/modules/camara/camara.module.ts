import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CamaraService } from './camara.service.js';
import {
  CongestionPollingProcessor,
  CONGESTION_QUEUE,
} from './workers/congestion-polling.processor.js';
import { SIGNAL_INGESTION_QUEUE } from '../../common/types/constant.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: CONGESTION_QUEUE }),
    BullModule.registerQueue({ name: SIGNAL_INGESTION_QUEUE }),
  ],
  providers: [CamaraService, CongestionPollingProcessor],
  exports: [CamaraService],
})
export class CamaraModule {}

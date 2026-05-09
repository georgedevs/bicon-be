import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SIGNAL_INGESTION_QUEUE } from '../../common/types/constant.js';
import { SimulationController } from './simulation.controller.js';

@Module({
  imports: [BullModule.registerQueue({ name: SIGNAL_INGESTION_QUEUE })],
  controllers: [SimulationController],
})
export class SimulationModule {}

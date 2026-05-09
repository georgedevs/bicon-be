import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Warden, WardenSchema } from './schemas/warden.schema.js';
import { WardenRepository } from './repositories/warden.repository.js';
import { WardensService } from './wardens.service.js';
import { WardensController } from './wardens.controller.js';
import { WardenKycProcessor } from './workers/warden-kyc.processor.js';
import { WARDEN_KYC_QUEUE } from '../../common/types/constant.js';
import { CamaraModule } from '../camara/camara.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Warden.name, schema: WardenSchema }]),
    BullModule.registerQueue({ name: WARDEN_KYC_QUEUE }),
    CamaraModule,
  ],
  providers: [WardenRepository, WardensService, WardenKycProcessor],
  controllers: [WardensController],
  exports: [WardenRepository],
})
export class WardensModule {}

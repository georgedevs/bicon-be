import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Zone, ZoneSchema } from './schemas/zone.schema.js';
import { ZoneRepository } from './repositories/zone.repository.js';
import { ZonesService } from './zones.service.js';
import { ZonesController } from './zones.controller.js';
import { CamaraModule } from '../camara/camara.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Zone.name, schema: ZoneSchema }]),
    CamaraModule,
  ],
  providers: [ZoneRepository, ZonesService],
  controllers: [ZonesController],
  exports: [ZoneRepository],
})
export class ZonesModule {}

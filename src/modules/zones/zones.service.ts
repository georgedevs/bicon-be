import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CamaraService } from '../camara/camara.service.js';
import { BiconGateway } from '../gateway/bicon.gateway.js';
import { ZoneRepository } from './repositories/zone.repository.js';
import { ZoneDocument } from './schemas/zone.schema.js';
import { CreateZoneDto, UpdateZoneDto } from './zones.dto.js';

@Injectable()
export class ZonesService {
  constructor(
    private readonly zoneRepository: ZoneRepository,
    private readonly camaraService: CamaraService,
    private readonly gateway: BiconGateway,
    private readonly configService: ConfigService,
    @InjectPinoLogger(ZonesService.name)
    private readonly logger: PinoLogger,
  ) {}

  async create(dto: CreateZoneDto): Promise<ZoneDocument> {
    const zone = await this.zoneRepository.create({
      name: dto.name,
      lat: dto.lat,
      lng: dto.lng,
      radius: dto.radius,
      active: true,
    });

    const webhookBaseUrl = this.configService.get<string>('nokia.webhookBaseUrl')!;
    const apiPrefix = this.configService.get<string>('apiPrefix')!;
    const testPhone = this.configService.get<string>('congestion.testPhoneNumber')!;
    const webhookUrl = `${webhookBaseUrl}/${apiPrefix}/webhooks/nokia`;

    const result = await this.camaraService.subscribeGeofence(
      testPhone,
      dto.lat,
      dto.lng,
      dto.radius,
      webhookUrl,
    );

    if (result?.subscriptionId) {
      const updated = await this.zoneRepository.updateById(
        (zone._id as { toString(): string }).toString(),
        { subscriptionId: result.subscriptionId },
      );
      this.logger.info(
        { zoneId: zone._id, subscriptionId: result.subscriptionId },
        'Nokia geofence subscription created',
      );
      return updated ?? zone;
    }

    return zone;
  }

  async findAll(): Promise<ZoneDocument[]> {
    return this.zoneRepository.findAll();
  }

  async findById(id: string): Promise<ZoneDocument> {
    const zone = await this.zoneRepository.findById(id);
    if (!zone) throw new NotFoundException(`Zone ${id} not found`);
    return zone;
  }

  async update(id: string, dto: UpdateZoneDto): Promise<ZoneDocument> {
    const zone = await this.findById(id);
    const updated = await this.zoneRepository.updateById(id, dto);
    if (!updated) throw new NotFoundException(`Zone ${id} not found`);

    if (dto.active !== undefined && dto.active !== zone.active) {
      this.gateway.emitToAll('zone:updated', {
        zoneId: id,
        active: dto.active,
        name: updated.name,
      });
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const zone = await this.findById(id);

    if (zone.subscriptionId) {
      const success = await this.camaraService.unsubscribeGeofence(zone.subscriptionId);
      if (success) {
        this.logger.info(
          { zoneId: id, subscriptionId: zone.subscriptionId },
          'Nokia geofence subscription cancelled',
        );
      } else {
        this.logger.warn(
          { zoneId: id, subscriptionId: zone.subscriptionId },
          'Nokia geofence unsubscribe failed — deleting zone anyway',
        );
      }
    }

    await this.zoneRepository.deleteById(id);
  }
}

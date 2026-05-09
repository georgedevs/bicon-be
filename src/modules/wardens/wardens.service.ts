import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import { WARDEN_KYC_QUEUE, WardenStatus } from '../../common/types/constant.js';
import type { PaginationMetadata } from '../../common/dto/pagination.dto.js';
import { WardenRepository } from './repositories/warden.repository.js';
import { WardenDocument } from './schemas/warden.schema.js';
import { ListWardensDto, RegisterWardenDto } from './wardens.dto.js';

@Injectable()
export class WardensService {
  constructor(
    private readonly wardenRepository: WardenRepository,
    @InjectQueue(WARDEN_KYC_QUEUE) private readonly kycQueue: Queue,
  ) {}

  async register(dto: RegisterWardenDto): Promise<WardenDocument> {
    const warden = await this.wardenRepository.create({
      name: dto.name,
      phoneNumber: dto.phoneNumber,
      zoneId: dto.zoneId ? new Types.ObjectId(dto.zoneId) : undefined,
      idDocument: dto.idDocument,
      status: WardenStatus.PENDING,
    });

    await this.kycQueue.add('kyc', {
      wardenId: (warden._id as { toString(): string }).toString(),
    });

    return warden;
  }

  async list(
    query: ListWardensDto,
  ): Promise<{ data: WardenDocument[]; pagination: PaginationMetadata }> {
    const { page = 1, limit = 20, zoneId, status } = query;
    const filter: Record<string, unknown> = {};
    if (zoneId) filter['zoneId'] = new Types.ObjectId(zoneId);
    if (status) filter['status'] = status;

    const [data, total] = await this.wardenRepository.findMany(filter, {
      skip: (page - 1) * limit,
      limit,
    });

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<WardenDocument> {
    const warden = await this.wardenRepository.findById(id);
    if (!warden) throw new NotFoundException(`Warden ${id} not found`);
    return warden;
  }

  async deactivate(id: string): Promise<WardenDocument> {
    await this.findById(id);
    const updated = await this.wardenRepository.updateById(id, {
      status: WardenStatus.INACTIVE,
    });
    if (!updated) throw new NotFoundException(`Warden ${id} not found`);
    return updated;
  }
}

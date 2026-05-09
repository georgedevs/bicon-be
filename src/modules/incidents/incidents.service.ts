import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginationMetadata } from '../../common/dto/pagination.dto.js';
import { BiconGateway } from '../gateway/bicon.gateway.js';
import { IncidentRepository } from './repositories/incident.repository.js';
import { IncidentDocument } from './schemas/incident.schema.js';
import { ListIncidentsDto } from './incidents.dto.js';
import { IncidentStatus } from '../../common/types/constant.js';

const DISPATCHABLE_STATUSES: IncidentStatus[] = [
  IncidentStatus.WATCH,
  IncidentStatus.HIGH,
  IncidentStatus.CRITICAL,
];

const DISMISSIBLE_STATUSES: IncidentStatus[] = [
  IncidentStatus.PENDING,
  IncidentStatus.SCORING,
  IncidentStatus.WATCH,
  IncidentStatus.HIGH,
  IncidentStatus.CRITICAL,
];

@Injectable()
export class IncidentsService {
  constructor(
    private readonly incidentRepository: IncidentRepository,
    private readonly gateway: BiconGateway,
  ) {}

  async list(
    query: ListIncidentsDto,
  ): Promise<{ data: IncidentDocument[]; pagination: PaginationMetadata }> {
    const { page = 1, limit = 20, status, tier, zoneId, from, to } = query;

    const filter: Record<string, unknown> = {};
    if (status) filter['status'] = status;
    if (tier) filter['vesTier'] = tier;
    if (zoneId) filter['zoneId'] = zoneId;
    if (from || to) {
      filter['createdAt'] = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      };
    }

    const [data, total] = await this.incidentRepository.findMany(filter, {
      skip: (page - 1) * limit,
      limit,
      sort: { createdAt: -1 },
    });

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<IncidentDocument> {
    const incident = await this.incidentRepository.findById(id);
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  async dispatch(id: string): Promise<IncidentDocument> {
    const incident = await this.findById(id);
    if (!DISPATCHABLE_STATUSES.includes(incident.status)) {
      throw new ConflictException(
        `Incident cannot be dispatched from status: ${incident.status}`,
      );
    }
    return this.changeStatus(id, IncidentStatus.DISPATCHED);
  }

  async dismiss(id: string): Promise<IncidentDocument> {
    const incident = await this.findById(id);
    if (!DISMISSIBLE_STATUSES.includes(incident.status)) {
      throw new ConflictException(
        `Incident cannot be dismissed from status: ${incident.status}`,
      );
    }
    return this.changeStatus(id, IncidentStatus.DISMISSED);
  }

  async resolve(id: string): Promise<IncidentDocument> {
    const incident = await this.findById(id);
    if (incident.status !== IncidentStatus.DISPATCHED) {
      throw new ConflictException(
        `Incident can only be resolved from DISPATCHED status. Current: ${incident.status}`,
      );
    }
    return this.changeStatus(id, IncidentStatus.RESOLVED);
  }

  private async changeStatus(
    id: string,
    status: IncidentStatus,
  ): Promise<IncidentDocument> {
    const updated = await this.incidentRepository.updateById(id, { status });
    if (!updated) throw new NotFoundException(`Incident ${id} not found`);

    this.gateway.emitToAll('incident:status-changed', {
      incidentId: id,
      status,
      updatedAt: new Date(),
    });

    return updated;
  }
}

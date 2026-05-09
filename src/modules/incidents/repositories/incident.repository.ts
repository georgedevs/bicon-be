import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Incident, IncidentDocument } from '../schemas/incident.schema.js';

@Injectable()
export class IncidentRepository {
  constructor(
    @InjectModel(Incident.name)
    private readonly model: Model<IncidentDocument>,
  ) {}

  async create(data: Partial<Incident>): Promise<IncidentDocument> {
    return this.model.create(data);
  }

  async findById(id: string): Promise<IncidentDocument | null> {
    return this.model.findById(id).exec();
  }

  async findMany(
    filter: Record<string, unknown>,
    options?: { skip?: number; limit?: number; sort?: Record<string, 1 | -1> },
  ): Promise<[IncidentDocument[], number]> {
    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .skip(options?.skip ?? 0)
        .limit(options?.limit ?? 20)
        .sort(options?.sort ?? { createdAt: -1 })
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return [data, total];
  }

  async updateById(
    id: string,
    data: UpdateQuery<IncidentDocument>,
  ): Promise<IncidentDocument | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }
}

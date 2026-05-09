import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Warden, WardenDocument } from '../schemas/warden.schema.js';

@Injectable()
export class WardenRepository {
  constructor(
    @InjectModel(Warden.name)
    private readonly model: Model<WardenDocument>,
  ) {}

  async create(data: Partial<Warden>): Promise<WardenDocument> {
    return this.model.create(data);
  }

  async findById(id: string): Promise<WardenDocument | null> {
    return this.model.findById(id).exec();
  }

  async findMany(
    filter: Record<string, unknown>,
    options?: { skip?: number; limit?: number },
  ): Promise<[WardenDocument[], number]> {
    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .skip(options?.skip ?? 0)
        .limit(options?.limit ?? 20)
        .sort({ createdAt: -1 })
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return [data, total];
  }

  async updateById(
    id: string,
    data: UpdateQuery<WardenDocument>,
  ): Promise<WardenDocument | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteById(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}

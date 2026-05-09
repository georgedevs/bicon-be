import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Zone, ZoneDocument } from '../schemas/zone.schema.js';

@Injectable()
export class ZoneRepository {
  constructor(
    @InjectModel(Zone.name)
    private readonly model: Model<ZoneDocument>,
  ) {}

  async create(data: Partial<Zone>): Promise<ZoneDocument> {
    return this.model.create(data);
  }

  async findById(id: string): Promise<ZoneDocument | null> {
    return this.model.findById(id).exec();
  }

  async findAll(): Promise<ZoneDocument[]> {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  async updateById(
    id: string,
    data: UpdateQuery<ZoneDocument>,
  ): Promise<ZoneDocument | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteById(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}

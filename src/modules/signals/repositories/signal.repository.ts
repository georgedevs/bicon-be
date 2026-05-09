import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Signal, SignalDocument } from '../schemas/signal.schema.js';

@Injectable()
export class SignalRepository {
  constructor(
    @InjectModel(Signal.name)
    private readonly model: Model<SignalDocument>,
  ) {}

  async create(data: Partial<Signal>): Promise<SignalDocument> {
    return this.model.create(data);
  }

  async findById(id: string): Promise<SignalDocument | null> {
    return this.model.findById(id).exec();
  }
}

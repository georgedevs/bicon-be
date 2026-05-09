import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SignalSource, SignalType } from '../../../common/types/constant.js';

export type SignalDocument = HydratedDocument<Signal>;

@Schema({ timestamps: true, collection: 'signals' })
export class Signal {
  @Prop({ type: String, enum: SignalSource, required: true })
  source!: SignalSource;

  @Prop({ type: String, enum: SignalType, required: true })
  type!: SignalType;

  @Prop({ type: String })
  phoneNumber?: string;

  @Prop({ type: String })
  zoneId?: string;

  @Prop({ type: { lat: Number, lng: Number }, _id: false })
  coordinates?: { lat: number; lng: number };

  @Prop({ type: Object, required: true })
  rawPayload!: Record<string, unknown>;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const SignalSchema = SchemaFactory.createForClass(Signal);

SignalSchema.index({ source: 1, createdAt: -1 });

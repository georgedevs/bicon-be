import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ZoneDocument = HydratedDocument<Zone>;

@Schema({ timestamps: true, collection: 'zones' })
export class Zone {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: Number, required: true })
  lat!: number;

  @Prop({ type: Number, required: true })
  lng!: number;

  @Prop({ type: Number, required: true })
  radius!: number;

  @Prop({ type: String })
  subscriptionId?: string;

  @Prop({ type: Boolean, default: true })
  active!: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const ZoneSchema = SchemaFactory.createForClass(Zone);

ZoneSchema.index({ active: 1 });

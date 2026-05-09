import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { WardenStatus } from '../../../common/types/constant.js';

export type WardenDocument = HydratedDocument<Warden>;

@Schema({ timestamps: true, collection: 'wardens' })
export class Warden {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  phoneNumber!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Zone' })
  zoneId?: Types.ObjectId;

  @Prop({ type: String, enum: WardenStatus, default: WardenStatus.PENDING })
  status!: WardenStatus;

  @Prop({ type: String })
  idDocument?: string;

  @Prop({ type: String })
  kycMatchResult?: string;

  @Prop({ type: String })
  kycDocumentMatch?: string;

  @Prop({ type: Number })
  kycMatchScore?: number;

  @Prop({ type: Number, default: null })
  kycTenureMonths?: number | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const WardenSchema = SchemaFactory.createForClass(Warden);

WardenSchema.index({ status: 1 });
WardenSchema.index({ zoneId: 1, status: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  IncidentStatus,
  IncidentType,
  SignalSource,
  VesTier,
} from '../../../common/types/constant.js';
import { Signal } from '../../signals/schemas/signal.schema.js';

export type IncidentDocument = HydratedDocument<Incident>;

export interface TriageResult {
  severity: 'LOW' | 'HIGH' | 'CRITICAL';
  incidentType: string;
  escalationRisk: number;
  summary: string;
  recommendedAction: string;
  confidenceNote: string;
}

export interface VesApiResult {
  apiName: string;
  latencyMs: number;
  result: unknown;
  success: boolean;
}

@Schema({ timestamps: true, collection: 'incidents' })
export class Incident {
  @Prop({ type: String, enum: IncidentStatus, default: IncidentStatus.PENDING })
  status!: IncidentStatus;

  @Prop({ type: String, enum: SignalSource, required: true })
  source!: SignalSource;

  @Prop({ type: String, enum: IncidentType, default: IncidentType.UNKNOWN })
  type!: IncidentType;

  @Prop({ type: String })
  phoneNumber?: string;

  @Prop({ type: String })
  zoneId?: string;

  @Prop({ type: { lat: Number, lng: Number }, _id: false })
  coordinates?: { lat: number; lng: number };

  @Prop({ type: Number })
  vesScore?: number;

  @Prop({ type: String, enum: VesTier })
  vesTier?: VesTier;

  @Prop({ type: Object })
  vesBreakdown?: Record<string, unknown>;

  @Prop({ type: [Object] })
  vesApiResults?: VesApiResult[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Signal.name,
    required: true,
  })
  signalId!: Types.ObjectId;

  @Prop({ type: Date })
  scoredAt?: Date;

  @Prop({ type: Object })
  triage?: TriageResult;

  @Prop({ type: String })
  triageError?: string;

  @Prop({ type: Date })
  triagedAt?: Date;

  @Prop({ type: String, enum: ['v1', 'v2'], default: 'v1' })
  pipelineVersion?: string;

  @Prop({ type: String })
  agentReasoning?: string;

  @Prop({ type: Number })
  toolsCalledCount?: number;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const IncidentSchema = SchemaFactory.createForClass(Incident);

IncidentSchema.index({ status: 1, createdAt: -1 });
IncidentSchema.index({ vesScore: -1 });

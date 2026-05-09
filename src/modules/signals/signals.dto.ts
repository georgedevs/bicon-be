import { IsString, IsOptional, IsObject } from 'class-validator';

// Nokia sends geofence events in CloudEvents format:
// { id, source, specversion, type, datacontenttype, time, data: { subscriptionId, device, area } }
export class NokiaGeofenceWebhookDto {
  // CloudEvents envelope fields
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  specversion?: string;

  @IsOptional()
  @IsString()
  datacontenttype?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsString()
  type!: string;

  // CloudEvents data payload — contains subscriptionId, device, area
  @IsOptional()
  @IsObject()
  data?: {
    subscriptionId?: string;
    device?: { phoneNumber?: string; networkAccessIdentifier?: string };
    area?: {
      areaType?: string;
      center?: { latitude: number; longitude: number };
      radius?: number;
    };
  };

  // Legacy flat fields (kept for backward-compat with curl tests)
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsObject()
  device?: {
    phoneNumber?: string;
    networkAccessIdentifier?: string;
  };

  @IsOptional()
  @IsObject()
  area?: {
    areaType?: string;
    center?: { latitude: number; longitude: number };
    radius?: number;
  };
}

export class UssdWebhookDto {
  @IsString()
  sessionId!: string;

  @IsString()
  phoneNumber!: string;

  @IsString()
  serviceCode!: string;

  @IsString()
  text!: string;
}

export interface SignalJobData {
  source: string;
  type: string;
  phoneNumber?: string;
  zoneId?: string;
  coordinates?: { lat: number; lng: number };
  incidentType?: string;
  rawPayload: Record<string, unknown>;
  pipelineVersionOverride?: 'v1' | 'v2';
}

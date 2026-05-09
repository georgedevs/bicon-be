export interface SimSwapResult {
  swapped: boolean;
}

export interface DeviceSwapResult {
  swapped: boolean;
}

export interface NumberVerifyResult {
  authentic: boolean;
}

export interface LocationVerifyResult {
  verified: boolean;
  matchRate?: number;
}

export interface RoamingResult {
  roaming: boolean;
  countryCode?: number;
  countryName?: string[];
}

export interface CongestionResult {
  level: string;
  confidence: number;
  start: Date;
  stop: Date;
}

export interface GeofenceResult {
  subscriptionId: string;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
  radius?: number;
}

export interface QodResult {
  sessionId: string;
}

export interface KycMatchResult {
  nameMatch?: string;
  nameMatchScore?: number;
  idDocumentMatch?: string;
}

export interface CallForwardingResult {
  active: boolean;
}

export interface KycTenureResult {
  tenureMonths: number;
}

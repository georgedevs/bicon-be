export enum SignalSource {
  GEOFENCE = 'GEOFENCE',
  CONGESTION = 'CONGESTION',
  DEVICE_STATUS = 'DEVICE_STATUS',
  USSD = 'USSD',
  SMS = 'SMS',
}

export enum SignalType {
  NETWORK_PASSIVE = 'NETWORK_PASSIVE',
  HUMAN = 'HUMAN',
}

export enum IncidentStatus {
  PENDING = 'PENDING',
  SCORING = 'SCORING',
  WATCH = 'WATCH',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  DISMISSED = 'DISMISSED',
  DISPATCHED = 'DISPATCHED',
  RESOLVED = 'RESOLVED',
}

export enum VesTier {
  DISMISSED = 'DISMISSED',
  WATCH = 'WATCH',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IncidentType {
  ROAD_ACCIDENT = 'ROAD_ACCIDENT',
  FIRE = 'FIRE',
  FLOOD = 'FLOOD',
  CROWD_CRUSH = 'CROWD_CRUSH',
  MEDICAL = 'MEDICAL',
  DOMESTIC = 'DOMESTIC',
  UNKNOWN = 'UNKNOWN',
}

export enum WardenStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE',
}

export enum Severity {
  LOW = 'LOW',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export const VES_TIERS = {
  DISMISSED: { min: 0, max: 40 },
  WATCH: { min: 41, max: 65 },
  HIGH: { min: 66, max: 85 },
  CRITICAL: { min: 86, max: 100 },
} as const;

export const PUBLIC_ROUTE_KEY = 'isPublic';

export const SIGNAL_INGESTION_QUEUE = 'signal-ingestion';
export const VES_SCORING_QUEUE = 'ves-scoring';
export const TRIAGE_QUEUE = 'triage';
export const WARDEN_KYC_QUEUE = 'warden-kyc';
export const AGENTIC_INCIDENT_QUEUE = 'agentic-incident';

export enum SimulationScenario {
  ROAD_ACCIDENT = 'road-accident',
  FLOOD = 'flood',
  STAMPEDE = 'stampede',
  FRAUD_FALSE_ALARM = 'fraud-false-alarm',
  USSD_TRIGGER = 'ussd-trigger',
}

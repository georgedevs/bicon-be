import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NetworkAsCodeClient } from 'network-as-code';
import type {
  CallForwardingResult,
  CongestionResult,
  DeviceSwapResult,
  GeofenceResult,
  KycMatchResult,
  KycTenureResult,
  LocationResult,
  LocationVerifyResult,
  NumberVerifyResult,
  QodResult,
  RoamingResult,
  SimSwapResult,
} from './camara.types.js';

@Injectable()
export class CamaraService {
  private readonly client: NetworkAsCodeClient | null;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(CamaraService.name) private readonly logger: PinoLogger,
  ) {
    const apiKey = this.configService.get<string>('nokia.apiKey')!;
    if (!apiKey) {
      this.logger.warn(
        'NOKIA_API_KEY not set — CamaraService running in stub mode, all methods return null',
      );
      this.client = null;
    } else {
      this.client = new NetworkAsCodeClient(apiKey);
    }
  }

  private device(phoneNumber: string) {
    return this.client!.devices.get({ phoneNumber });
  }

  private log(api: string, latencyMs: number, failed = false): void {
    if (failed) {
      this.logger.warn({ api, latencyMs }, 'CAMARA API call failed');
    } else {
      this.logger.debug({ api, latencyMs }, 'CAMARA API call succeeded');
    }
  }

  async checkSimSwap(phoneNumber: string): Promise<SimSwapResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      const swapped = await this.device(phoneNumber).verifySimSwap();
      this.log('simSwap', Date.now() - t);
      return { swapped };
    } catch (err) {
      this.log('simSwap', Date.now() - t, true);
      this.logger.warn({ err }, 'checkSimSwap failed');
      return null;
    }
  }

  async checkDeviceSwap(phoneNumber: string): Promise<DeviceSwapResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      const swapped = await this.device(phoneNumber).verifyDeviceSwap();
      this.log('deviceSwap', Date.now() - t);
      return { swapped };
    } catch (err) {
      this.log('deviceSwap', Date.now() - t, true);
      this.logger.warn({ err }, 'checkDeviceSwap failed');
      return null;
    }
  }

  async checkCallForwarding(phoneNumber: string): Promise<CallForwardingResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      const active = await this.device(phoneNumber).verifyUnconditionalForwarding();
      this.log('callForwarding', Date.now() - t);
      return { active };
    } catch (err) {
      this.log('callForwarding', Date.now() - t, true);
      this.logger.warn({ err }, 'checkCallForwarding failed');
      return null;
    }
  }

  async verifyNumber(
    phoneNumber: string,
    code: string,
    state: string,
  ): Promise<NumberVerifyResult | null> {
    if (!this.client) return null;
    if (!code || !state) return null;
    const t = Date.now();
    try {
      const authentic = await this.device(phoneNumber).verifyNumber(
        code,
        state,
      );
      this.log('numberVerify', Date.now() - t);
      return { authentic };
    } catch (err) {
      this.log('numberVerify', Date.now() - t, true);
      this.logger.warn({ err }, 'verifyNumber failed');
      return null;
    }
  }

  async verifyLocation(
    phoneNumber: string,
    lat: number,
    lng: number,
    radius: number,
  ): Promise<LocationVerifyResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      const result = await this.device(phoneNumber).verifyLocation(
        lat,
        lng,
        radius,
      );
      this.log('locationVerify', Date.now() - t);
      return {
        verified: result.resultType === 'TRUE',
        matchRate: result.resultType === 'PARTIAL' ? result.matchRate : undefined,
      };
    } catch (err) {
      this.log('locationVerify', Date.now() - t, true);
      this.logger.warn({ err }, 'verifyLocation failed');
      return null;
    }
  }

  async checkRoaming(phoneNumber: string): Promise<RoamingResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      const result = await this.device(phoneNumber).getRoaming();
      this.log('roaming', Date.now() - t);
      return {
        roaming: result.roaming,
        countryCode: result.countryCode,
        countryName: result.countryName,
      };
    } catch (err) {
      this.log('roaming', Date.now() - t, true);
      this.logger.warn({ err }, 'checkRoaming failed');
      return null;
    }
  }

  async getCongestion(
    phoneNumber: string,
    windowMinutes = 5,
  ): Promise<CongestionResult[] | null> {
    if (!this.client) return null;
    const end = new Date();
    const start = new Date(end.getTime() - windowMinutes * 60 * 1000);
    const t = Date.now();
    try {
      const results = await this.device(phoneNumber).getCongestion(start, end);
      this.log('congestion', Date.now() - t);
      return results.map(
        (c: {
          level: string;
          confidence: number;
          start: Date;
          stop: Date;
        }) => ({
          level: c.level,
          confidence: c.confidence,
          start: c.start,
          stop: c.stop,
        }),
      );
    } catch (err) {
      this.log('congestion', Date.now() - t, true);
      this.logger.warn({ err }, 'getCongestion failed');
      return null;
    }
  }

  async subscribeGeofence(
    phoneNumber: string,
    lat: number,
    lng: number,
    radius: number,
    webhookUrl: string,
  ): Promise<GeofenceResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      const webhookSecret = this.configService.get<string>('nokia.webhookSecret');
      const sub = await this.client.geofencing.subscribe(
        this.device(phoneNumber),
        {
          sink: webhookUrl,
          types: [
            'org.camaraproject.geofencing-subscriptions.v0.area-entered',
            'org.camaraproject.geofencing-subscriptions.v0.area-left',
          ],
          // Nokia REST API requires 'CIRCLE' (uppercase); SDK TypeScript types say 'Circle' but that causes 422
          area: {
            areaType: 'CIRCLE' as unknown as 'Circle',
            center: { latitude: lat, longitude: lng },
            radius,
          },
          initialEvent: true,
          subscriptionExpireTime: '2045-12-31T23:59:59Z',
          // Nokia echoes this token back as Authorization: Bearer on every webhook delivery
          ...(webhookSecret && {
            sinkCredential: {
              credentialType: 'ACCESSTOKEN' as const,
              accessToken: webhookSecret,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              accessTokenType: 'bearer' as any,
              accessTokenExpiresUtc: '2045-12-31T23:59:59Z',
            },
          }),
        },
      );
      this.log('geofenceSubscribe', Date.now() - t);
      return { subscriptionId: sub.eventSubscriptionId };
    } catch (err) {
      this.log('geofenceSubscribe', Date.now() - t, true);
      this.logger.warn({ err }, 'subscribeGeofence failed');
      return null;
    }
  }

  async unsubscribeGeofence(subscriptionId: string): Promise<boolean> {
    if (!this.client) return false;
    const t = Date.now();
    try {
      const sub = await this.client.geofencing.get(subscriptionId);
      await sub.delete();
      this.log('geofenceUnsubscribe', Date.now() - t);
      return true;
    } catch (err) {
      this.log('geofenceUnsubscribe', Date.now() - t, true);
      this.logger.warn({ err }, 'unsubscribeGeofence failed');
      return false;
    }
  }

  async subscribeDeviceReachability(
    phoneNumber: string,
    webhookUrl: string,
  ): Promise<GeofenceResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      const sub = await this.client.deviceStatus.subscribe(
        this.device(phoneNumber),
        'org.camaraproject.device-reachability-subscriptions.v0.reachability-data',
        webhookUrl,
      );
      this.log('reachabilitySubscribe', Date.now() - t);
      return { subscriptionId: sub.eventSubscriptionId };
    } catch (err) {
      this.log('reachabilitySubscribe', Date.now() - t, true);
      this.logger.warn({ err }, 'subscribeDeviceReachability failed');
      return null;
    }
  }

  async getLocation(phoneNumber: string): Promise<LocationResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      const result = await this.device(phoneNumber).getLocation();
      this.log('locationRetrieval', Date.now() - t);
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        radius: result.radius,
      };
    } catch (err) {
      this.log('locationRetrieval', Date.now() - t, true);
      this.logger.warn({ err }, 'getLocation failed');
      return null;
    }
  }

  async createQodSession(
    phoneNumber: string,
    profile: string,
    duration: number,
  ): Promise<QodResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      const session = await this.device(phoneNumber).createQodSession(profile, {
        duration,
      });
      this.log('qod', Date.now() - t);
      return { sessionId: session.id };
    } catch (err) {
      this.log('qod', Date.now() - t, true);
      this.logger.warn({ err }, 'createQodSession failed');
      return null;
    }
  }

  async kycMatch(
    phoneNumber: string,
    name: string,
    idDocument?: string,
  ): Promise<KycMatchResult | null> {
    if (!this.client) return null;
    const t = Date.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await this.device(phoneNumber).matchCustomer({
        phoneNumber,
        name,
        ...(idDocument ? { idDocument } : {}),
      });
      this.log('kycMatch', Date.now() - t);
      return {
        nameMatch: result?.nameMatch ?? undefined,
        nameMatchScore: result?.nameMatchScore ?? undefined,
        idDocumentMatch: result?.idDocumentMatch ?? undefined,
      };
    } catch (err) {
      this.log('kycMatch', Date.now() - t, true);
      this.logger.warn({ err }, 'kycMatch failed');
      return null;
    }
  }

  // KYC Tenure is not in Nokia NaC SDK v6 — no URL constant or client method exists.
  // Returns null until Nokia exposes this endpoint (expected in SDK v7).
  kycTenure(_phoneNumber: string): Promise<KycTenureResult | null> {
    this.logger.debug('kycTenure not available in Nokia NaC SDK v6, returning null');
    return Promise.resolve(null);
  }
}

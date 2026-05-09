import { Injectable } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import {
  IncidentStatus,
  SignalType,
  TRIAGE_QUEUE,
  VES_SCORING_QUEUE,
  VesTier,
  VES_TIERS,
} from '../../../common/types/constant.js';
import { RequestContextService } from '../../../common/services/request-context.service.js';
import { BiconGateway } from '../../gateway/bicon.gateway.js';
import { CamaraService } from '../../camara/camara.service.js';
import { IncidentRepository } from '../repositories/incident.repository.js';
import { VesScoringJobData } from '../../signals/workers/signal-ingestion.processor.js';

interface ApiCallResult<T> {
  apiName: string;
  result: T | null;
  latencyMs: number;
  success: boolean;
}

@Processor(VES_SCORING_QUEUE)
@Injectable()
export class VesScoringProcessor extends WorkerHost {
  constructor(
    @InjectQueue(TRIAGE_QUEUE) private readonly triageQueue: Queue,
    private readonly incidentRepository: IncidentRepository,
    private readonly camaraService: CamaraService,
    private readonly gateway: BiconGateway,
    private readonly requestContextService: RequestContextService,
    @InjectPinoLogger(VesScoringProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<VesScoringJobData>): Promise<void> {
    const traceId = randomUUID();
    await this.requestContextService.run(
      { traceId, requestId: job.id ?? traceId },
      async () => {
        const { incidentId, phoneNumber, signalType, coordinates } = job.data;

        await this.incidentRepository.updateById(incidentId, {
          status: IncidentStatus.SCORING,
        });

        this.gateway.emitToAll('incident:scoring-started', {
          incidentId,
          status: IncidentStatus.SCORING,
        });

        this.logger.info({ incidentId }, 'VES scoring started');

        const makeCall = <T>(
          apiName: string,
          fn: () => Promise<T | null>,
        ): Promise<ApiCallResult<T>> => {
          const t = Date.now();
          return fn().then((result) => {
            const latencyMs = Date.now() - t;
            this.gateway.emitToAll('incident:api-call', {
              incidentId,
              apiName,
              result,
              latencyMs,
              success: result !== null,
            });
            return { apiName, result, latencyMs, success: result !== null };
          });
        };

        const phone = phoneNumber ?? '';
        const lat = coordinates?.lat ?? 0;
        const lng = coordinates?.lng ?? 0;

        const [simSwap, deviceSwap, locationVerify, numberVerify, roaming, callForwarding] =
          await Promise.all([
            makeCall('simSwap', () => this.camaraService.checkSimSwap(phone)),
            makeCall('deviceSwap', () =>
              this.camaraService.checkDeviceSwap(phone),
            ),
            makeCall('locationVerify', () =>
              this.camaraService.verifyLocation(phone, lat, lng, 1000),
            ),
            makeCall('numberVerify', () =>
              this.camaraService.verifyNumber(phone, '', ''),
            ),
            makeCall('roaming', () => this.camaraService.checkRoaming(phone)),
            makeCall('callForwarding', () =>
              this.camaraService.checkCallForwarding(phone),
            ),
          ]);

        let score = 50;
        const breakdown: Record<string, number> = {};

        if (simSwap.result?.swapped) {
          score -= 30;
          breakdown.simSwap = -30;
        }

        if (deviceSwap.result?.swapped) {
          score -= 15;
          breakdown.deviceSwap = -15;
        }

        if (locationVerify.result !== null) {
          if (locationVerify.result.verified) {
            score += 20;
            breakdown.locationVerify = 20;
          } else if (locationVerify.result.matchRate !== undefined) {
            const delta = Math.round((locationVerify.result.matchRate / 100) * 20);
            score += delta;
            breakdown.locationVerify = delta;
          } else {
            score -= 25;
            breakdown.locationVerify = -25;
          }
        }

        if (numberVerify.result !== null) {
          if (numberVerify.result.authentic === false) {
            score -= 20;
            breakdown.numberVerify = -20;
          } else if (numberVerify.result.authentic === true) {
            score += 15;
            breakdown.numberVerify = 15;
          }
        }

        if (roaming.result?.roaming) {
          score -= 10;
          breakdown.roaming = -10;
        }

        if (callForwarding.result?.active) {
          score -= 20;
          breakdown.callForwarding = -20;
        }

        if (signalType === SignalType.NETWORK_PASSIVE) {
          score += 10;
          breakdown.signalType = 10;
        } else if (signalType === SignalType.HUMAN) {
          score += 5;
          breakdown.signalType = 5;
        }

        score = Math.max(0, Math.min(100, score));

        const tier = this.scoreTier(score);
        const status = tier as unknown as IncidentStatus;

        const vesApiResults = [simSwap, deviceSwap, locationVerify, numberVerify, roaming, callForwarding];

        await this.incidentRepository.updateById(incidentId, {
          vesScore: score,
          vesTier: tier,
          vesBreakdown: breakdown,
          vesApiResults,
          scoredAt: new Date(),
          status,
        });

        this.gateway.emitToAll('incident:ves-complete', {
          incidentId,
          score,
          tier,
          breakdown,
          status,
        });

        this.logger.info(
          { incidentId, score, tier },
          'VES scoring complete',
        );

        if (tier === VesTier.HIGH || tier === VesTier.CRITICAL) {
          await this.triageQueue.add('triage-incident', { incidentId });
          this.logger.info(
            { incidentId, tier },
            'Incident queued for triage',
          );
        }
      },
    );
  }

  private scoreTier(score: number): VesTier {
    if (score >= VES_TIERS.CRITICAL.min) return VesTier.CRITICAL;
    if (score >= VES_TIERS.HIGH.min) return VesTier.HIGH;
    if (score >= VES_TIERS.WATCH.min) return VesTier.WATCH;
    return VesTier.DISMISSED;
  }
}

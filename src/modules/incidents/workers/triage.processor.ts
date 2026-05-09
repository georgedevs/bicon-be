import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { TRIAGE_QUEUE, VesTier } from '../../../common/types/constant.js';
import { RequestContextService } from '../../../common/services/request-context.service.js';
import { BiconGateway } from '../../gateway/bicon.gateway.js';
import { CamaraService } from '../../camara/camara.service.js';
import { IncidentRepository } from '../repositories/incident.repository.js';
import { TriageService } from '../services/triage.service.js';

export interface TriageJobData {
  incidentId: string;
}

@Processor(TRIAGE_QUEUE)
@Injectable()
export class TriageProcessor extends WorkerHost {
  constructor(
    private readonly incidentRepository: IncidentRepository,
    private readonly triageService: TriageService,
    private readonly camaraService: CamaraService,
    private readonly gateway: BiconGateway,
    private readonly requestContextService: RequestContextService,
    @InjectPinoLogger(TriageProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<TriageJobData>): Promise<void> {
    const traceId = randomUUID();
    await this.requestContextService.run(
      { traceId, requestId: job.id ?? traceId },
      async () => {
        const { incidentId } = job.data;

        const incident = await this.incidentRepository.findById(incidentId);
        if (!incident) {
          this.logger.warn(
            { incidentId },
            'Incident not found for triage, skipping',
          );
          return;
        }

        const triage = await this.triageService.analyze(incident);

        await this.incidentRepository.updateById(incidentId, {
          triage: triage ?? undefined,
          triageError: triage ? undefined : 'Claude analysis unavailable',
          triagedAt: new Date(),
        });

        this.gateway.emitToAll('incident:triage-complete', {
          incidentId,
          triage,
          tier: incident.vesTier,
          score: incident.vesScore,
        });

        this.logger.info(
          {
            incidentId,
            tier: incident.vesTier,
            hasResult: !!triage,
            escalationRisk: triage?.escalationRisk,
          },
          'Triage complete',
        );

        if (incident.vesTier === VesTier.CRITICAL && incident.phoneNumber) {
          try {
            const qod = await this.camaraService.createQodSession(
              incident.phoneNumber,
              'QOS_E',
              3600,
            );
            if (qod) {
              this.logger.info(
                { incidentId, sessionId: qod.sessionId },
                'QoD boost active for CRITICAL incident',
              );
            }
          } catch (err) {
            this.logger.warn(
              { incidentId, err: (err as Error).message },
              'QoD boost failed — triage complete regardless',
            );
          }
        }
      },
    );
  }
}

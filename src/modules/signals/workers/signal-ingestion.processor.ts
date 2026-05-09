import { Injectable } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import {
  AGENTIC_INCIDENT_QUEUE,
  IncidentType,
  SIGNAL_INGESTION_QUEUE,
  SignalSource,
  SignalType,
  VES_SCORING_QUEUE,
} from '../../../common/types/constant.js';
import { RequestContextService } from '../../../common/services/request-context.service.js';
import { BiconGateway } from '../../gateway/bicon.gateway.js';
import { SignalRepository } from '../repositories/signal.repository.js';
import { IncidentRepository } from '../../incidents/repositories/incident.repository.js';
import { SignalJobData } from '../signals.dto.js';
import type { AgenticJobData } from '../../incidents/workers/agentic-incident.processor.js';

export interface VesScoringJobData {
  incidentId: string;
  phoneNumber?: string;
  signalType: SignalType;
  coordinates?: { lat: number; lng: number };
}

@Processor(SIGNAL_INGESTION_QUEUE)
@Injectable()
export class SignalIngestionProcessor extends WorkerHost {
  constructor(
    @InjectQueue(VES_SCORING_QUEUE) private readonly vesQueue: Queue,
    @InjectQueue(AGENTIC_INCIDENT_QUEUE) private readonly agenticQueue: Queue,
    private readonly configService: ConfigService,
    private readonly signalRepository: SignalRepository,
    private readonly incidentRepository: IncidentRepository,
    private readonly gateway: BiconGateway,
    private readonly requestContextService: RequestContextService,
    @InjectPinoLogger(SignalIngestionProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<SignalJobData>): Promise<void> {
    const traceId = randomUUID();
    await this.requestContextService.run(
      { traceId, requestId: job.id ?? traceId },
      async () => {
        const { source, type, phoneNumber, zoneId, coordinates, incidentType, rawPayload } =
          job.data;

        const signal = await this.signalRepository.create({
          source: source as SignalSource,
          type: type as SignalType,
          phoneNumber,
          zoneId,
          coordinates,
          rawPayload,
        });

        const pipelineVersion: 'v1' | 'v2' =
          (job.data.pipelineVersionOverride as 'v1' | 'v2' | undefined) ??
          (this.configService.get<string>('pipeline.version') as 'v1' | 'v2') ??
          'v1';

        const incident = await this.incidentRepository.create({
          source: source as SignalSource,
          type: (incidentType as IncidentType) ?? IncidentType.UNKNOWN,
          phoneNumber,
          zoneId,
          coordinates,
          signalId: signal._id as Types.ObjectId,
          pipelineVersion,
        });

        const incidentId = (incident._id as Types.ObjectId).toString();

        this.gateway.emitToAll('incident:new', {
          incidentId,
          status: incident.status,
          source: incident.source,
          type: incident.type,
          timestamp: incident.createdAt,
        });

        if (pipelineVersion === 'v2') {
          this.logger.info({ incidentId, source, type }, 'Incident created, queuing agentic pipeline (v2)');
          await this.agenticQueue.add('assess-incident', {
            incidentId,
            phoneNumber,
            signalType: type as SignalType,
            signalSource: source as SignalSource,
            coordinates,
            zoneId,
          } satisfies AgenticJobData);
        } else {
          this.logger.info({ incidentId, source, type }, 'Incident created, queuing VES scoring (v1)');
          await this.vesQueue.add('score-incident', {
            incidentId,
            phoneNumber,
            signalType: type as SignalType,
            coordinates,
          } satisfies VesScoringJobData);
        }
      },
    );
  }
}

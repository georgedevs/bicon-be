import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Incident, IncidentSchema } from './schemas/incident.schema.js';
import { IncidentRepository } from './repositories/incident.repository.js';
import { IncidentsService } from './incidents.service.js';
import { IncidentsController } from './incidents.controller.js';
import { VesScoringProcessor } from './workers/ves-scoring.processor.js';
import { TriageProcessor } from './workers/triage.processor.js';
import { TriageService } from './services/triage.service.js';
import { NokiaMcpService } from './services/nokia-mcp.service.js';
import { AgenticIncidentProcessor } from './workers/agentic-incident.processor.js';
import {
  AGENTIC_INCIDENT_QUEUE,
  TRIAGE_QUEUE,
  VES_SCORING_QUEUE,
} from '../../common/types/constant.js';
import { CamaraModule } from '../camara/camara.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Incident.name, schema: IncidentSchema },
    ]),
    BullModule.registerQueue({ name: VES_SCORING_QUEUE }),
    BullModule.registerQueue({ name: TRIAGE_QUEUE }),
    BullModule.registerQueue({ name: AGENTIC_INCIDENT_QUEUE }),
    CamaraModule,
  ],
  controllers: [IncidentsController],
  providers: [
    IncidentRepository,
    IncidentsService,
    VesScoringProcessor,
    TriageService,
    TriageProcessor,
    NokiaMcpService,
    AgenticIncidentProcessor,
  ],
  exports: [IncidentRepository],
})
export class IncidentsModule {}

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
} from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  IncidentType,
  SIGNAL_INGESTION_QUEUE,
  SignalSource,
  SignalType,
  SimulationScenario,
} from '../../common/types/constant.js';
import type { SignalJobData } from '../signals/signals.dto.js';

class SimulateBodyDto {
  @IsOptional()
  @IsIn(['v1', 'v2'])
  version?: 'v1' | 'v2';
}

const SCENARIO_PAYLOADS: Record<SimulationScenario, SignalJobData> = {
  [SimulationScenario.ROAD_ACCIDENT]: {
    source: SignalSource.GEOFENCE,
    type: SignalType.NETWORK_PASSIVE,
    phoneNumber: '+99999991001',
    coordinates: { lat: 6.455, lng: 3.3841 },
    incidentType: IncidentType.ROAD_ACCIDENT,
    rawPayload: { scenario: SimulationScenario.ROAD_ACCIDENT },
  },
  [SimulationScenario.FLOOD]: {
    source: SignalSource.CONGESTION,
    type: SignalType.NETWORK_PASSIVE,
    phoneNumber: '+99999991001',
    coordinates: { lat: 6.4698, lng: 3.5852 },
    incidentType: IncidentType.FLOOD,
    rawPayload: { scenario: SimulationScenario.FLOOD },
  },
  [SimulationScenario.STAMPEDE]: {
    source: SignalSource.GEOFENCE,
    type: SignalType.NETWORK_PASSIVE,
    phoneNumber: '+99999991001',
    coordinates: { lat: 6.5244, lng: 3.3792 },
    incidentType: IncidentType.CROWD_CRUSH,
    rawPayload: { scenario: SimulationScenario.STAMPEDE },
  },
  [SimulationScenario.FRAUD_FALSE_ALARM]: {
    source: SignalSource.USSD,
    type: SignalType.HUMAN,
    phoneNumber: '+99999991000',
    incidentType: IncidentType.UNKNOWN,
    rawPayload: { scenario: SimulationScenario.FRAUD_FALSE_ALARM },
  },
  [SimulationScenario.USSD_TRIGGER]: {
    source: SignalSource.USSD,
    type: SignalType.HUMAN,
    phoneNumber: '+99999991001',
    incidentType: IncidentType.MEDICAL,
    rawPayload: { scenario: SimulationScenario.USSD_TRIGGER },
  },
};

@ApiTags('simulation')
@Controller('simulate')
export class SimulationController {
  constructor(
    @InjectQueue(SIGNAL_INGESTION_QUEUE) private readonly ingestionQueue: Queue,
  ) {}

  @Post(':scenario')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Inject a demo scenario into the real pipeline',
    description:
      'Adds a pre-configured signal to the ingestion queue. Pass {"version":"v2"} in the body to route through the agentic Claude pipeline.',
  })
  @ApiParam({
    name: 'scenario',
    enum: SimulationScenario,
    description: 'One of: road-accident | flood | stampede | fraud-false-alarm | ussd-trigger',
  })
  @ApiResponse({ status: 202, description: 'Scenario accepted, pipeline starting' })
  async simulate(
    @Param('scenario', new ParseEnumPipe(SimulationScenario)) scenario: SimulationScenario,
    @Body() body: SimulateBodyDto,
  ) {
    const payload: SignalJobData = {
      ...SCENARIO_PAYLOADS[scenario],
      pipelineVersionOverride: body.version,
    };
    const job = await this.ingestionQueue.add(`simulate-${scenario}`, payload);
    return { accepted: true, scenario, jobId: job.id, pipelineVersion: body.version ?? 'v1' };
  }
}

import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { CamaraService } from '../camara.service.js';
import { RequestContextService } from '../../../common/services/request-context.service.js';
import {
  SIGNAL_INGESTION_QUEUE,
  SignalSource,
  SignalType,
} from '../../../common/types/constant.js';

export const CONGESTION_QUEUE = 'camara-congestion';

@Processor(CONGESTION_QUEUE)
export class CongestionPollingProcessor
  extends WorkerHost
  implements OnModuleInit
{
  constructor(
    @InjectQueue(CONGESTION_QUEUE) private readonly queue: Queue,
    @InjectQueue(SIGNAL_INGESTION_QUEUE) private readonly ingestionQueue: Queue,
    private readonly camaraService: CamaraService,
    private readonly requestContextService: RequestContextService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(CongestionPollingProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const intervalMs = this.configService.get<number>(
      'congestion.pollIntervalMs',
    )!;
    // upsertJobScheduler is idempotent — safe to call on every restart (BullMQ v5.16+)
    await this.queue.upsertJobScheduler(
      'poll-congestion',
      { every: intervalMs },
      { name: 'poll-congestion', data: {} },
    );
    this.logger.info({ intervalMs }, 'Congestion polling scheduler registered');
  }

  async process(job: Job): Promise<void> {
    const traceId = randomUUID();
    await this.requestContextService.run(
      { traceId, requestId: job.id ?? traceId },
      async () => {
        const phoneNumber = this.configService.get<string>(
          'congestion.testPhoneNumber',
        )!;
        if (!phoneNumber) {
          this.logger.debug(
            'No CAMARA_TEST_PHONE configured, skipping congestion poll',
          );
          return;
        }

        const results = await this.camaraService.getCongestion(phoneNumber);

        if (!results || results.length === 0) {
          this.logger.debug(
            { phoneNumber },
            'Congestion poll returned no data',
          );
          return;
        }

        const latest = results[results.length - 1];
        this.logger.info(
          { phoneNumber, level: latest.level, confidence: latest.confidence },
          'Congestion poll complete',
        );

        if (latest.level === 'High' || latest.level === 'Medium') {
          await this.ingestionQueue.add('congestion-signal', {
            source: SignalSource.CONGESTION,
            type: SignalType.NETWORK_PASSIVE,
            phoneNumber,
            rawPayload: {
              congestionLevel: latest.level,
              confidence: latest.confidence,
            },
          });
          this.logger.info(
            { phoneNumber, level: latest.level },
            'Congestion signal injected into ingestion queue',
          );
        }
      },
    );
  }
}

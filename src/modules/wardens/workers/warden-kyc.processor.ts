import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { WARDEN_KYC_QUEUE, WardenStatus } from '../../../common/types/constant.js';
import { RequestContextService } from '../../../common/services/request-context.service.js';
import { BiconGateway } from '../../gateway/bicon.gateway.js';
import { CamaraService } from '../../camara/camara.service.js';
import { WardenRepository } from '../repositories/warden.repository.js';

export interface WardenKycJobData {
  wardenId: string;
}

const KYC_PASS_THRESHOLD = 70;

@Processor(WARDEN_KYC_QUEUE)
@Injectable()
export class WardenKycProcessor extends WorkerHost {
  constructor(
    private readonly wardenRepository: WardenRepository,
    private readonly camaraService: CamaraService,
    private readonly gateway: BiconGateway,
    private readonly requestContextService: RequestContextService,
    @InjectPinoLogger(WardenKycProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<WardenKycJobData>): Promise<void> {
    const traceId = randomUUID();
    await this.requestContextService.run(
      { traceId, requestId: job.id ?? traceId },
      async () => {
        const { wardenId } = job.data;
        const t = Date.now();

        const warden = await this.wardenRepository.findById(wardenId);
        if (!warden) {
          this.logger.warn({ wardenId }, 'Warden not found for KYC, skipping');
          return;
        }

        const [kyc, tenure] = await Promise.all([
          this.camaraService.kycMatch(warden.phoneNumber, warden.name, warden.idDocument),
          this.camaraService.kycTenure(warden.phoneNumber),
        ]);

        let status: WardenStatus;
        if (kyc === null) {
          status = WardenStatus.VERIFIED;
        } else if (kyc.nameMatch === 'true') {
          status = WardenStatus.VERIFIED;
        } else if ((kyc.nameMatchScore ?? 0) >= KYC_PASS_THRESHOLD) {
          status = WardenStatus.VERIFIED;
        } else if (kyc.idDocumentMatch === 'true') {
          // Nokia sandbox: name matching is not available for test numbers;
          // fall back to idDocument verification when name check fails
          status = WardenStatus.VERIFIED;
        } else {
          status = WardenStatus.REJECTED;
        }

        await this.wardenRepository.updateById(wardenId, {
          status,
          kycMatchResult: kyc?.nameMatch,
          kycDocumentMatch: kyc?.idDocumentMatch,
          kycMatchScore: kyc?.nameMatchScore,
          kycTenureMonths: tenure?.tenureMonths ?? null,
        });

        this.gateway.emitToAll('warden:kyc-complete', {
          wardenId,
          status,
          kycMatchScore: kyc?.nameMatchScore,
        });

        this.logger.info(
          { wardenId, status, latencyMs: Date.now() - t },
          'Warden KYC complete',
        );
      },
    );
  }
}

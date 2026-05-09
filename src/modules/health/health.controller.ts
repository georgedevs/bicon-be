import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '../../common/decorators/public.decorator.js';
import { RedisService } from '../../common/services/redis.service.js';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check infrastructure connectivity' })
  @ApiResponse({ status: 200, description: 'All systems operational' })
  @ApiResponse({ status: 503, description: 'One or more systems are down' })
  async check() {
    const mongoState = this.mongoConnection.readyState;
    const mongo = mongoState === 1 ? 'connected' : 'disconnected';

    const redisOk = await this.redisService.ping();
    const redis = redisOk ? 'connected' : 'disconnected';

    if (mongo !== 'connected' || redis !== 'connected') {
      throw new ServiceUnavailableException({ status: 'error', mongo, redis });
    }

    return { status: 'ok', mongo, redis };
  }
}

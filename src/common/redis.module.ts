import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service.js';
import { RequestContextService } from './services/request-context.service.js';

@Global()
@Module({
  providers: [RedisService, RequestContextService],
  exports: [RedisService, RequestContextService],
})
export class RedisModule {}

import { Global, Module } from '@nestjs/common';
import { BiconGateway } from './bicon.gateway.js';

@Global()
@Module({
  providers: [BiconGateway],
  exports: [BiconGateway],
})
export class GatewayModule {}

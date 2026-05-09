import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import Redis from 'ioredis';

import configuration from './config/configuration.js';
import { configValidationSchema } from './config/config.validation.js';
import { getPinoConfig } from './config/logger.config.js';
import { RedisModule } from './common/redis.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { LogEndpointInterceptor } from './common/interceptors/log-endpoint.interceptor.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { CamaraModule } from './modules/camara/camara.module.js';
import { GatewayModule } from './modules/gateway/gateway.module.js';
import { SignalsModule } from './modules/signals/signals.module.js';
import { IncidentsModule } from './modules/incidents/incidents.module.js';
import { ZonesModule } from './modules/zones/zones.module.js';
import { WardensModule } from './modules/wardens/wardens.module.js';
import { SimulationModule } from './modules/simulation/simulation.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      validationSchema: configValidationSchema,
      isGlobal: true,
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: configService.get<number>('throttle.ttl')!,
          limit: configService.get<number>('throttle.limit')!,
        },
      ],
    }),

    EventEmitterModule.forRoot(),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: new Redis(configService.get<string>('redis.url')!, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        }),
      }),
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getPinoConfig,
    }),

    RedisModule,
    GatewayModule,
    AuthModule,
    HealthModule,
    CamaraModule,
    SignalsModule,
    IncidentsModule,
    ZonesModule,
    WardensModule,
    SimulationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LogEndpointInterceptor },
  ],
})
export class AppModule {}

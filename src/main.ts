import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module.js';
import { RequestContextService } from './common/services/request-context.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port')!;
  const apiPrefix = configService.get<string>('apiPrefix')!;

  // Socket.io adapter — must be set before any middleware
  app.useWebSocketAdapter(new IoAdapter(app));

  // 1. Security headers
  app.use(helmet());

  // 2a. Request context — registered via app.use() to avoid NestJS wildcard route
  //     warnings from path-to-regexp v8 (NestJS 11 known issue with forRoutes('*'))
  const requestContextService = app.get(RequestContextService);
  app.use((req: { headers: Record<string, string>; id?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const traceId =
      req.headers['x-correlation-id'] ||
      req.headers['x-request-id'] ||
      req.id ||
      randomUUID();
    requestContextService.setContext({ traceId, requestId: traceId });
    res.setHeader('x-trace-id', traceId);
    next();
  });

  // 2. CORS
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // 3. Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 4. Global prefix — health excluded via RequestMethod (avoids /api/* wildcard warning)
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // 5. Swagger at /api
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bicon Emergency Intelligence API')
    .setDescription(
      'Real-time emergency intelligence platform for Sub-Saharan Africa',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication')
    .addTag('health', 'Infrastructure health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`Bicon API running on port ${port}`, 'Bootstrap');
  logger.log(`Swagger  → http://localhost:${port}/docs`, 'Bootstrap');
  logger.log(`Health   → http://localhost:${port}/health`, 'Bootstrap');
}

bootstrap();

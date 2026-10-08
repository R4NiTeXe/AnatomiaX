import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { applyCors } from './config/cors-origins';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateProductionEnv } from './config/validate-env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  validateProductionEnv(configService);

  app.enableShutdownHooks();

  try {
    const server = app.getHttpAdapter().getInstance();
    if (server && typeof server.set === 'function') {
      server.set('trust proxy', 1);
    }
  } catch {
    // best-effort: trust-proxy setting is non-critical
  }

  app.setGlobalPrefix('api');

  applyCors(app, configService, logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.use(helmet());
  app.use(cookieParser());

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({ status: 'ok' });
  });

  const rawPort = configService.get<string>('PORT') ?? process.env.PORT ?? '3000';
  const port = Number.parseInt(rawPort, 10) || 3000;

  const host =
    (configService.get<string>('HOST') ?? process.env.HOST ?? '0.0.0.0').trim() || '0.0.0.0';

  await app.listen(port, host);
  logger.log(
    `AnatomiaX API listening on http://${host}:${port} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`
  );
}
void bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateProductionEnv } from './config/validate-env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 8.19.23: fail fast on unsafe production secrets/config.
  validateProductionEnv(configService);

  app.setGlobalPrefix('api');

  const corsOrigin = configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.use(helmet());
  app.use(cookieParser());

  // Convenience non-prefixed health check — same deterministic payload as GET /api/health
  // Avoids duplicating controller logic; keeps both GET /health and GET /api/health available.
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({ status: 'ok' });
  });

  const rawPort = configService.get<string>('PORT') ?? process.env.PORT ?? '3000';
  const port = Number.parseInt(rawPort, 10) || 3000;

  await app.listen(port);
}
void bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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

  // 8.19.23: fail fast on unsafe production secrets/config.
  validateProductionEnv(configService);

  // 8.20.16: clean NestJS shutdown lifecycle — stop accepting new traffic,
  // let active work finish where practical, disconnect Prisma via
  // PrismaService.onModuleDestroy, close the HTTP server. No custom process
  // manager; relies on the platform (systemd/container) to SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // 8.20.16: trust a single proxy hop so Secure cookies + x-forwarded-*
  // behave behind a provider-neutral reverse proxy (nginx/Caddy/cloud LB).
  // Single hop is the common safe default; direct-connect deployments are
  // unaffected. No cloud-specific code.
  try {
    const server = app.getHttpAdapter().getInstance();
    if (server && typeof server.set === 'function') {
      server.set('trust proxy', 1);
    }
  } catch {
    // Trust-proxy is best-effort; boot must never fail because of it.
  }

  app.setGlobalPrefix('api');

  const corsRaw = configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
  // 8.20.16: allow a comma-separated allow-list (e.g. web + admin origins)
  // while preserving the single-origin default. No wildcard; validated in
  // production by validateProductionEnv.
  const corsOrigins = corsRaw
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length <= 1 ? (corsOrigins[0] ?? corsRaw) : corsOrigins,
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

  // 8.20.16: explicit host binding. HOST is optional; defaults to 0.0.0.0 so
  // container/proxy deployments are reachable, while local dev may set
  // HOST=127.0.0.1. Documented in docs/deployment/README.md.
  const host =
    (configService.get<string>('HOST') ?? process.env.HOST ?? '0.0.0.0').trim() || '0.0.0.0';

  await app.listen(port, host);
  logger.log(
    `AnatomiaX API listening on http://${host}:${port} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`
  );
}
void bootstrap();

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { applyCors } from '../../config/cors-origins';
import { PrismaService } from '../../prisma/prisma.service';

// Production-shaped allow-list (comma-separated, mixed case + slashes to
// prove normalization), set before module init like other e2e env fixtures.
// Per-file jest worker isolation keeps this out of other suites.
process.env.JWT_SECRET = 'e2e-test-secret-that-is-long-enough-for-hs256';
process.env.CORS_ORIGIN = 'https://AnatomiaX.vercel.app/, https://admin.example.com ';

/**
 * CORS preflight/response contract against the real bootstrap wiring
 * (applyCors — the same function main.ts calls): allowed origins get
 * exact ACAO + credentials on preflights, plain responses, AND guard
 * rejections (guards must never strip CORS); disallowed origins get
 * nothing. Regression cover for production "No ACAO header" incidents.
 */
describe('CORS (e2e, production-shaped allow-list)', () => {
  let app: INestApplication;
  const WEB = 'https://anatomiax.vercel.app';
  const EVIL = 'https://evil.example';

  const preflight = (origin: string) =>
    request(app.getHttpServer())
      .options('/api/v1/progress/snapshot')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    applyCors(app, app.get(ConfigService));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers preflight from the production origin with exact ACAO + credentials', async () => {
    const res = await preflight(WEB);
    expect(res.headers['access-control-allow-origin']).toBe(WEB);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sends no ACAO for unauthorized origins (fail closed, no wildcard)', async () => {
    const res = await preflight(EVIL);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('attaches CORS to plain responses from allowed origins', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').set('Origin', WEB);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(WEB);
  });

  it('keeps CORS headers on guard rejections (401 carries ACAO)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Origin', WEB);
    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe(WEB);
  });
});

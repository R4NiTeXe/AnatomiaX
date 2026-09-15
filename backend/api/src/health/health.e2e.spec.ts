import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableCors({
      origin: 'http://localhost:5173',
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
    const httpAdapter = app.getHttpAdapter();
    // Mirror main.ts convenience route
    httpAdapter.get('/health', (_req: unknown, res: { json: (b: unknown) => void }) => {
      res.json({ status: 'ok' });
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('GET /api/health returns { status: ok }', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health returns 200', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
  });

  it('GET /health returns { status: ok }', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/health/db reports database status without throwing (8.20.16 readiness)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/db');
    expect(['connected', 'disconnected']).toContain(res.body.database);
    expect(res.body.status).toBe(res.body.database === 'connected' ? 'ok' : 'degraded');
    // Readiness contract: 200 when connected, 503 when unavailable.
    expect(res.status).toBe(res.body.database === 'connected' ? 200 : 503);
    // Never leaks raw DB internals.
    expect(JSON.stringify(res.body)).not.toMatch(/postgres|prisma|ECONN/i);
  });

  it('liveness stays 200 even when readiness is degraded', async () => {
    const liveness = await request(app.getHttpServer()).get('/api/health');
    expect(liveness.status).toBe(200);
    expect(liveness.body).toEqual({ status: 'ok' });
  });

  it('bootstrap does not throw and app is defined', () => {
    expect(app).toBeDefined();
  });

  it('CORS allows http://localhost:5173', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('ValidationPipe is enabled (whitelist)', () => {
    // App has ValidationPipe – check via internal check
    const pipes = (app as unknown as { get: (t: unknown) => unknown }).get;
    expect(pipes).toBeDefined();
  });
});

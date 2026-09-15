import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = { ping: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /health returns { status: ok }', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });

  it('response is deterministic', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
    expect(controller.check()).toEqual({ status: 'ok' });
  });

  it('GET /health/db returns ok when database is connected', async () => {
    prisma.ping.mockResolvedValueOnce(true);
    await expect(controller.database()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
  });

  it('GET /health/db degrades gracefully when database is unavailable', async () => {
    prisma.ping.mockResolvedValueOnce(false);
    await expect(controller.database()).resolves.toEqual({
      status: 'degraded',
      database: 'disconnected',
    });
  });

  it('8.20.16 readiness sets 200 when connected and 503 when disconnected', async () => {
    prisma.ping.mockResolvedValueOnce(true);
    const okRes = { status: jest.fn() };
    await expect(controller.database(okRes)).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
    expect(okRes.status).toHaveBeenCalledWith(200);

    prisma.ping.mockResolvedValueOnce(false);
    const degradedRes = { status: jest.fn() };
    const body = await controller.database(degradedRes);
    expect(body).toEqual({ status: 'degraded', database: 'disconnected' });
    expect(degradedRes.status).toHaveBeenCalledWith(503);
    // Payload never carries raw DB errors.
    expect(JSON.stringify(body)).not.toMatch(/postgres|prisma|Error/i);
  });
});

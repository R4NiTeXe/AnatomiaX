import { Controller, Get, HttpCode, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseHealthResponse, HealthService } from './health.service';

interface StatusSetter {
  status(code: number): unknown;
}

@Controller('health')
// Liveness stays cheap, but /db pings PostgreSQL — bound it with the shared
// throttler storage (100/min default). Probes typically poll far below that.
@UseGuards(ThrottlerGuard)
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Liveness: confirms the process is running. No PostgreSQL I/O, always 200.
   * Lightweight by design; skipped by LoggingInterceptor to avoid noise.
   */
  @Get()
  @HttpCode(200)
  check() {
    return this.healthService.check();
  }

  /**
   * Readiness: checks real PostgreSQL availability via a lightweight
   * `SELECT 1` probe. Returns 200 `{ status: ok, database: connected }` when
   * reachable, 503 `{ status: degraded, database: disconnected }` otherwise.
   * Never exposes raw database errors or secrets — PrismaService.ping()
   * already swallows internals into a boolean.
   */
  @Get('db')
  async database(@Res({ passthrough: true }) res?: StatusSetter): Promise<DatabaseHealthResponse> {
    const connected = await this.prisma.ping();
    if (res) {
      res.status(this.healthService.readinessHttpStatus(connected));
    }
    return this.healthService.databaseStatus(connected);
  }
}

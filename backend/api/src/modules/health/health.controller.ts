import { Controller, Get, HttpCode, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { DatabaseHealthResponse, HealthService } from './health.service';

interface StatusSetter {
  status(code: number): unknown;
}

@Controller('health')
@UseGuards(ThrottlerGuard)
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  @HttpCode(200)
  check() {
    return this.healthService.check();
  }

  @Get('db')
  async database(@Res({ passthrough: true }) res?: StatusSetter): Promise<DatabaseHealthResponse> {
    const connected = await this.prisma.ping();
    if (res) {
      res.status(this.healthService.readinessHttpStatus(connected));
    }
    return this.healthService.databaseStatus(connected);
  }
}

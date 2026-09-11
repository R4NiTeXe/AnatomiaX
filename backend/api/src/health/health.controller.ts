import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseHealthResponse, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  check() {
    return this.healthService.check();
  }

  @Get('db')
  async database(): Promise<DatabaseHealthResponse> {
    return this.healthService.databaseStatus(await this.prisma.ping());
  }
}

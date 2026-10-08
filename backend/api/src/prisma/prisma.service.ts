import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    return undefined;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect().catch(() => undefined);
  }

  async ping(): Promise<boolean> {
    try {
      // Bound the probe so /health/db degrades fast when no DB is configured
      // (e.g. CI/e2e without DATABASE_URL) instead of hanging past test timeouts.
      const probe = this.$queryRaw`SELECT 1`.then(
        () => true,
        () => false
      );
      const timeout = new Promise<boolean>(resolve => {
        setTimeout(() => resolve(false), 1500);
      });
      return await Promise.race([probe, timeout]);
    } catch {
      return false;
    }
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Intentionally lazy: no $connect() here so the API boots and the test
  // suite runs in environments without a database. Prisma Client connects
  // on demand at the first query instead.
  async onModuleInit(): Promise<void> {
    return undefined;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect().catch(() => undefined);
  }

  /** Non-throwing connectivity probe for health checks. */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

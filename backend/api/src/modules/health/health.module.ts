import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  // AuthModule for the re-exported ThrottlerModule (rate-limit guard on
  // /db, which pings the database). No auth guards applied here — health
  // stays public by design.
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}

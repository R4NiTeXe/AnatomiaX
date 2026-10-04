import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CohortsController } from './cohorts.controller';
import { CohortsService } from './cohorts.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [CohortsController],
  providers: [CohortsService],
  exports: [CohortsService],
})
export class CohortsModule {}

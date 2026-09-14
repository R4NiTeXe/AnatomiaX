import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CohortsModule } from './cohorts/cohorts.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { LoggingInterceptor } from './common/logging.interceptor';
import { RequestIdInterceptor } from './common/request-id.interceptor';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CohortsModule,
    ProgressModule,
    NotificationsModule,
    HealthModule,
    AdminModule,
  ],
  providers: [
    // 8.19.25 canonical contract: request ids on every response, normalized
    // error bodies on every non-health API error. Registered here so the
    // real app and every e2e module using AppModule behave identically.
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}

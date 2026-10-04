import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { FcmNotificationSender } from './fcm-notification.sender';
import { NotificationSender } from './notification-sender';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    FcmNotificationSender,
    { provide: NotificationSender, useExisting: FcmNotificationSender },
  ],
  exports: [NotificationsService, NotificationSender],
})
export class NotificationsModule {}

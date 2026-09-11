import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { SafeUser } from '../users/users.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterSubscriptionDto } from './dto/register-subscription.dto';
import { NotificationsService } from './notifications.service';

/**
 * 8.19.24 push-subscription endpoints. All routes require a live user and
 * operate strictly on `req.user.id`. No route triggers sending — delivery
 * stays behind the NotificationSender abstraction for future use.
 */
@Controller('v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('subscriptions')
  @HttpCode(200)
  register(@CurrentUser() user: SafeUser, @Body() dto: RegisterSubscriptionDto) {
    return this.notifications.register(user, dto);
  }

  @Get('subscriptions')
  list(@CurrentUser() user: SafeUser) {
    return this.notifications.list(user);
  }

  @Delete('subscriptions/:id')
  remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.notifications.remove(user, id).then(() => ({ status: 'ok' as const }));
  }
}

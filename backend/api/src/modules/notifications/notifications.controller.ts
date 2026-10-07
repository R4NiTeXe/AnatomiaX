import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { SafeUser } from '../users/users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterSubscriptionDto } from './dto/register-subscription.dto';
import { NotificationsService } from './notifications.service';

@Controller('v1/notifications')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
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

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PushSubscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SafeUser } from '../users/users.service';
import type { PushKeysDto, RegisterSubscriptionDto } from './dto/register-subscription.dto';

export interface SubscriptionView {
  id: string;
  endpoint: string;
  keys: Record<string, unknown>;
  createdAt: Date;
}

function toView(sub: PushSubscription): SubscriptionView {
  return {
    id: sub.id,
    endpoint: sub.endpoint,
    keys: (sub.keys ?? {}) as Record<string, unknown>,
    createdAt: sub.createdAt,
  };
}

/** Stores only the allowlisted minimum inside the existing keys Json column. */
function cleanKeys(dto: RegisterSubscriptionDto): Prisma.InputJsonValue {
  const keys: PushKeysDto = dto.keys ?? {};
  const out: Record<string, string | number> = {};
  if (typeof keys.p256dh === 'string') out.p256dh = keys.p256dh;
  if (typeof keys.auth === 'string') out.auth = keys.auth;
  if (typeof keys.expirationTime === 'number') out.expirationTime = keys.expirationTime;
  return out as Prisma.InputJsonValue;
}

/**
 * 8.19.24 push subscriptions on the existing PushSubscription model.
 * Every operation is strictly scoped to the authenticated user id —
 * there is no admin override and no cross-user access path.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent register: same user + same endpoint returns the existing row
   * (keys refreshed); an endpoint owned by another user is a 409 so one
   * user can never adopt or observe another's subscription.
   */
  async register(user: SafeUser, dto: RegisterSubscriptionDto): Promise<SubscriptionView> {
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: dto.endpoint },
    });
    if (existing) {
      if (existing.userId !== user.id) {
        throw new ConflictException('Subscription already registered');
      }
      const updated = await this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { keys: cleanKeys(dto) },
      });
      return toView(updated);
    }
    const created = await this.prisma.pushSubscription.create({
      data: { userId: user.id, endpoint: dto.endpoint, keys: cleanKeys(dto) },
    });
    return toView(created);
  }

  async list(user: SafeUser): Promise<SubscriptionView[]> {
    const rows = await this.prisma.pushSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toView);
  }

  /**
   * Removes only the caller's own subscription. Unknown ids and other users'
   * ids both yield 404 (no existence oracle — same convention as cohorts).
   */
  async remove(user: SafeUser, id: string): Promise<void> {
    const existing = await this.prisma.pushSubscription.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      throw new NotFoundException('Subscription not found');
    }
    await this.prisma.pushSubscription.delete({ where: { id } });
  }
}

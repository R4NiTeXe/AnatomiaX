import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PushSubscription } from '@prisma/client';
import { prismaCodeFrom } from '../../common/exceptions/api-error';
import { PrismaService } from '../../prisma/prisma.service';
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

function cleanKeys(dto: RegisterSubscriptionDto): Prisma.InputJsonValue {
  const keys: PushKeysDto = dto.keys ?? {};
  const out: Record<string, string | number> = {};
  if (typeof keys.p256dh === 'string') out.p256dh = keys.p256dh;
  if (typeof keys.auth === 'string') out.auth = keys.auth;
  if (typeof keys.expirationTime === 'number') out.expirationTime = keys.expirationTime;
  return out as Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    try {
      const created = await this.prisma.pushSubscription.create({
        data: { userId: user.id, endpoint: dto.endpoint, keys: cleanKeys(dto) },
      });
      return toView(created);
    } catch (error) {
      if (prismaCodeFrom(error) !== 'P2002') throw error;
      const winner = await this.prisma.pushSubscription.findUnique({
        where: { endpoint: dto.endpoint },
      });
      if (!winner || winner.userId !== user.id) {
        throw new ConflictException('Subscription already registered');
      }
      const updated = await this.prisma.pushSubscription.update({
        where: { id: winner.id },
        data: { keys: cleanKeys(dto) },
      });
      return toView(updated);
    }
  }

  async list(user: SafeUser): Promise<SubscriptionView[]> {
    const rows = await this.prisma.pushSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toView);
  }

  async remove(user: SafeUser, id: string): Promise<void> {
    const existing = await this.prisma.pushSubscription.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      throw new NotFoundException('Subscription not found');
    }
    await this.prisma.pushSubscription.delete({ where: { id } });
  }
}

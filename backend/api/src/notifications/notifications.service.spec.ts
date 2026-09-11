import { ConflictException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const userA = { id: 'user-a', role: 'STUDENT' } as never;
const userB = { id: 'user-b', role: 'STUDENT' } as never;

const dto = (endpoint = 'https://push.example.com/sub/abc123') => ({
  endpoint,
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
});

function makePrisma() {
  return {
    pushSubscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('NotificationsService (8.19.24)', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new NotificationsService(prisma as never);
  });

  it('registers a subscription storing only the minimum fields', async () => {
    prisma.pushSubscription.findUnique.mockResolvedValue(null);
    prisma.pushSubscription.create.mockImplementation(async ({ data }: never) => ({
      id: 'sub-1',
      createdAt: new Date(),
      ...(data as object),
    }));
    const out = await service.register(userA, dto());
    expect(prisma.pushSubscription.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-a',
        endpoint: 'https://push.example.com/sub/abc123',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      },
    });
    expect(out).toMatchObject({ id: 'sub-1', endpoint: 'https://push.example.com/sub/abc123' });
    expect(out).not.toHaveProperty('userId');
    expect(out).not.toHaveProperty('passwordHash');
  });

  it('re-registers the same endpoint for the same user idempotently', async () => {
    prisma.pushSubscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-a',
      endpoint: 'https://push.example.com/sub/abc123',
    });
    prisma.pushSubscription.update.mockImplementation(async ({ data }: never) => ({
      id: 'sub-1',
      endpoint: 'https://push.example.com/sub/abc123',
      createdAt: new Date(),
      ...(data as object),
    }));
    const out = await service.register(userA, dto());
    expect(prisma.pushSubscription.create).not.toHaveBeenCalled();
    expect(out.id).toBe('sub-1');
  });

  it('rejects an endpoint owned by another user (409, no takeover)', async () => {
    prisma.pushSubscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-b',
      endpoint: 'https://push.example.com/sub/abc123',
    });
    await expect(service.register(userA, dto())).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.pushSubscription.create).not.toHaveBeenCalled();
    expect(prisma.pushSubscription.update).not.toHaveBeenCalled();
  });

  it('lists only the caller’s subscriptions', async () => {
    await service.list(userA);
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-a' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('removes the caller’s own subscription', async () => {
    prisma.pushSubscription.findUnique.mockResolvedValue({ id: 'sub-1', userId: 'user-a' });
    await service.remove(userA, 'sub-1');
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 'sub-1' } });
  });

  it('denies cross-user delete with 404 (IDOR, no oracle)', async () => {
    prisma.pushSubscription.findUnique.mockResolvedValue({ id: 'sub-1', userId: 'user-b' });
    await expect(service.remove(userA, 'sub-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown subscription ids', async () => {
    prisma.pushSubscription.findUnique.mockResolvedValue(null);
    await expect(service.remove(userA, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accepts Expo-style token endpoints for future mobile compat', async () => {
    prisma.pushSubscription.findUnique.mockResolvedValue(null);
    prisma.pushSubscription.create.mockImplementation(async ({ data }: never) => ({
      id: 'sub-expo',
      createdAt: new Date(),
      ...(data as object),
    }));
    const out = await service.register(userB, {
      endpoint: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      keys: {},
    });
    expect(out.id).toBe('sub-expo');
  });
});

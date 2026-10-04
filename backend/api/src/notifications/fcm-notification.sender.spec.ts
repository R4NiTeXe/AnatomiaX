import { FcmNotificationSender } from './fcm-notification.sender';

const configFor = (values: Record<string, string | undefined>) => ({
  get: jest.fn((key: string) => values[key]),
});

const fcmSub = (endpoint: string) => ({
  id: 'sub-1',
  endpoint,
  keys: { p256dh: 'p', auth: 'a' },
  createdAt: new Date(),
  userId: 'user-1',
});

describe('FcmNotificationSender (Firebase Admin SDK / HTTP v1)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stubs safely without credentials: no messaging calls, skipped count, no secrets in result', async () => {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn(async () => [
          fcmSub('https://fcm.googleapis.com/fcm/send/token-1'),
          fcmSub('https://push.example.com/other'),
        ]),
      },
    };
    const sender = new FcmNotificationSender(prisma as never, configFor({}) as never);
    const out = await sender.dispatch('user-1', { title: 'Hi', body: 'Hello' });
    expect(out).toEqual({ delivered: 0, skipped: 2, reason: 'fcm-unconfigured' });
    expect(JSON.stringify(out)).not.toContain('FIREBASE');
  });

  it('treats malformed FIREBASE_SERVICE_ACCOUNT JSON as unconfigured (never throws)', async () => {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn(async () => [fcmSub('https://fcm.googleapis.com/fcm/send/t1')]),
      },
    };
    const sender = new FcmNotificationSender(
      prisma as never,
      configFor({ FIREBASE_SERVICE_ACCOUNT: 'not-json{{{ garbage' }) as never
    );
    await expect(sender.dispatch('user-1', { title: 'Hi', body: 'Hello' })).resolves.toEqual({
      delivered: 0,
      skipped: 1,
      reason: 'fcm-unconfigured',
    });
  });

  it('reports no-subscriptions without dispatching', async () => {
    const prisma = { pushSubscription: { findMany: jest.fn(async () => []) } };
    const sender = new FcmNotificationSender(prisma as never, configFor({}) as never);
    await expect(sender.dispatch('user-1', { title: 'Hi', body: 'Hello' })).resolves.toEqual({
      delivered: 0,
      skipped: 0,
      reason: 'no-subscriptions',
    });
  });

  it('sends only FCM-routed endpoints when configured, never leaking credentials', async () => {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn(async () => [
          fcmSub('https://fcm.googleapis.com/fcm/send/token-abc'),
          fcmSub('https://updates.push.services.mozilla.com/wpush/v2/xyz'),
        ]),
      },
    };
    const mockMessaging = {
      sendEachForMulticast: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };
    const sender = new FcmNotificationSender(
      prisma as never,
      configFor({ FIREBASE_PROJECT_ID: 'anatomiax-7d0a0' }) as never,
      mockMessaging as never
    );
    const out = await sender.dispatch('user-1', { title: 'Hi', body: 'Hello' });
    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['token-abc'],
      notification: { title: 'Hi', body: 'Hello' },
    });
    expect(out).toEqual({ delivered: 1, skipped: 1, reason: undefined });
  });

  it('counts failures as skipped instead of throwing', async () => {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn(async () => [fcmSub('https://fcm.googleapis.com/fcm/send/t1')]),
      },
    };
    const mockMessaging = {
      sendEachForMulticast: jest.fn(async () => {
        throw new Error('network down');
      }),
    };
    const sender = new FcmNotificationSender(
      prisma as never,
      configFor({ FIREBASE_PROJECT_ID: 'anatomiax-7d0a0' }) as never,
      mockMessaging as never
    );
    await expect(sender.dispatch('user-1', { title: 'Hi', body: 'Hello' })).resolves.toEqual({
      delivered: 0,
      skipped: 1,
      reason: 'fcm-delivery-failed',
    });
  });

  it('handles partial multicast delivery results correctly', async () => {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn(async () => [
          fcmSub('https://fcm.googleapis.com/fcm/send/token-1'),
          fcmSub('https://fcm.googleapis.com/fcm/send/token-2'),
        ]),
      },
    };
    const mockMessaging = {
      sendEachForMulticast: jest.fn(async () => ({
        successCount: 1,
        failureCount: 1,
        responses: [{ success: true }, { success: false, error: new Error('token expired') }],
      })),
    };
    const sender = new FcmNotificationSender(
      prisma as never,
      configFor({ FIREBASE_PROJECT_ID: 'anatomiax-7d0a0' }) as never,
      mockMessaging as never
    );
    const out = await sender.dispatch('user-1', { title: 'Hi', body: 'Hello' });
    expect(out).toEqual({ delivered: 1, skipped: 1, reason: undefined });
  });
});

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

describe('FcmNotificationSender (8.19.24)', () => {
  const OLD_FETCH = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = OLD_FETCH;
    jest.restoreAllMocks();
  });

  it('stubs safely without credentials: no network, skipped count, no secrets in result', async () => {
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
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out).toEqual({ delivered: 0, skipped: 2, reason: 'fcm-unconfigured' });
    expect(JSON.stringify(out)).not.toContain('FCM');
  });

  it('reports no-subscriptions without touching the network', async () => {
    const prisma = { pushSubscription: { findMany: jest.fn(async () => []) } };
    const sender = new FcmNotificationSender(prisma as never, configFor({}) as never);
    await expect(sender.dispatch('user-1', { title: 'Hi', body: 'Hello' })).resolves.toEqual({
      delivered: 0,
      skipped: 0,
      reason: 'no-subscriptions',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends only FCM-routed endpoints when configured, never leaking the key', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const prisma = {
      pushSubscription: {
        findMany: jest.fn(async () => [
          fcmSub('https://fcm.googleapis.com/fcm/send/token-abc'),
          fcmSub('https://updates.push.services.mozilla.com/wpush/v2/xyz'),
        ]),
      },
    };
    const sender = new FcmNotificationSender(
      prisma as never,
      configFor({ FCM_SERVER_KEY: 'secret-server-key' }) as never
    );
    const out = await sender.dispatch('user-1', { title: 'Hi', body: 'Hello' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(init.headers).toMatchObject({ Authorization: 'key=secret-server-key' });
    expect(out).toEqual({ delivered: 1, skipped: 1, reason: undefined });
    expect(JSON.stringify(out)).not.toContain('secret-server-key');
  });

  it('counts failures as skipped instead of throwing', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const prisma = {
      pushSubscription: {
        findMany: jest.fn(async () => [fcmSub('https://fcm.googleapis.com/fcm/send/t1')]),
      },
    };
    const sender = new FcmNotificationSender(
      prisma as never,
      configFor({ FCM_SERVER_KEY: 'k' }) as never
    );
    await expect(sender.dispatch('user-1', { title: 'Hi', body: 'Hello' })).resolves.toMatchObject({
      delivered: 0,
      skipped: 1,
    });
  });
});

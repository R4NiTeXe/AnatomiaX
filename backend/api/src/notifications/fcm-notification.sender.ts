import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchResult, NotificationPayload, NotificationSender } from './notification-sender';

const FCM_SEND_URL = 'https://fcm.googleapis.com/fcm/send';
const FCM_ENDPOINT_PREFIX = 'https://fcm.googleapis.com/fcm/send/';

/**
 * 8.19.24 development-safe FCM sender (free FCM legacy HTTP path, no new deps).
 *
 * - No Firebase credentials required: without FCM_SERVER_KEY nothing is sent
 *   and dispatch resolves `{ delivered: 0, skipped, reason: 'fcm-unconfigured' }`.
 * - Only browser subscriptions routed through FCM (`…/fcm/send/<token>`) are
 *   ever attempted; other endpoints (Mozilla/Apple/Expo) are skipped.
 * - Never throws on delivery failure (counts `skipped` instead) and never
 *   logs secrets, endpoints, or key material — counts only.
 */
@Injectable()
export class FcmNotificationSender extends NotificationSender {
  private readonly logger = new Logger(FcmNotificationSender.name);
  private readonly serverKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    super();
    this.serverKey = this.config.get<string>('FCM_SERVER_KEY') ?? '';
  }

  async dispatch(userId: string, payload: NotificationPayload): Promise<DispatchResult> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) {
      return { delivered: 0, skipped: 0, reason: 'no-subscriptions' };
    }
    if (!this.serverKey) {
      this.logger.debug(
        `FCM stub: ${subscriptions.length} subscription(s) skipped (FCM_SERVER_KEY not configured)`
      );
      return { delivered: 0, skipped: subscriptions.length, reason: 'fcm-unconfigured' };
    }
    let delivered = 0;
    let skipped = 0;
    for (const sub of subscriptions) {
      const token = this.fcmTokenFromEndpoint(sub.endpoint);
      if (!token) {
        skipped += 1;
        continue;
      }
      try {
        const res = await fetch(FCM_SEND_URL, {
          method: 'POST',
          headers: {
            Authorization: `key=${this.serverKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: token,
            notification: { title: payload.title, body: payload.body },
            ...(payload.data ? { data: payload.data } : {}),
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) delivered += 1;
        else skipped += 1;
      } catch {
        skipped += 1;
      }
    }
    return {
      delivered,
      skipped,
      reason: delivered === 0 ? 'fcm-delivery-failed' : undefined,
    };
  }

  private fcmTokenFromEndpoint(endpoint: string): string | null {
    if (typeof endpoint !== 'string' || !endpoint.startsWith(FCM_ENDPOINT_PREFIX)) return null;
    const token = endpoint.slice(FCM_ENDPOINT_PREFIX.length).trim();
    return token.length > 0 ? token : null;
  }
}

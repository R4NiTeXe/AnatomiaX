import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../prisma/prisma.service';
import { DispatchResult, NotificationPayload, NotificationSender } from './notification-sender';

const FCM_ENDPOINT_PREFIX = 'https://fcm.googleapis.com/fcm/send/';

/**
 * Firebase Admin SDK FCM sender (HTTP v1).
 *
 * - Stubs safely without credentials: if Firebase credentials are not configured,
 *   dispatch resolves `{ delivered: 0, skipped: subscriptions.length, reason: 'fcm-unconfigured' }`.
 * - Compatible with both local development (via GOOGLE_APPLICATION_CREDENTIALS or env vars)
 *   and production hosting like Render (via FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).
 * - Only browser subscriptions routed through FCM or direct FCM tokens are attempted;
 *   other push endpoints (Mozilla/Apple/Expo) are skipped.
 * - Never throws on delivery failure (counts `skipped` instead) and never
 *   logs secrets, endpoints, or key material — counts only.
 */
@Injectable()
export class FcmNotificationSender extends NotificationSender {
  private readonly logger = new Logger(FcmNotificationSender.name);
  private readonly messaging: Messaging | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() customMessaging?: Messaging | null
  ) {
    super();
    this.messaging = customMessaging ?? this.initFirebase();
  }

  private initFirebase(): Messaging | null {
    try {
      const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKeyRaw = this.config.get<string>('FIREBASE_PRIVATE_KEY');
      const googleAppCreds = this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');

      let credential = null;

      if (serviceAccountJson) {
        try {
          const parsed = JSON.parse(serviceAccountJson);
          credential = cert(parsed);
        } catch {
          this.logger.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON');
          return null;
        }
      } else if (projectId && clientEmail && privateKeyRaw) {
        const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
        credential = cert({
          projectId,
          clientEmail,
          privateKey,
        });
      } else if (googleAppCreds) {
        credential = cert(googleAppCreds);
      }

      if (!credential) {
        return null;
      }

      const appName = 'anatomiax-firebase';
      const existingApp = getApps().find(a => a?.name === appName);
      const app =
        existingApp ?? initializeApp({ credential, projectId: projectId || undefined }, appName);

      return getMessaging(app);
    } catch (err) {
      this.logger.warn(
        `Firebase Admin initialization skipped or failed: ${(err as Error).message}`
      );
      return null;
    }
  }

  async dispatch(userId: string, payload: NotificationPayload): Promise<DispatchResult> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) {
      return { delivered: 0, skipped: 0, reason: 'no-subscriptions' };
    }
    if (!this.messaging) {
      this.logger.debug(
        `FCM stub: ${subscriptions.length} subscription(s) skipped (Firebase Admin not configured)`
      );
      return { delivered: 0, skipped: subscriptions.length, reason: 'fcm-unconfigured' };
    }

    let delivered = 0;
    let skipped = 0;
    const validTokens: string[] = [];

    for (const sub of subscriptions) {
      const token = this.fcmTokenFromEndpoint(sub.endpoint);
      if (!token) {
        skipped += 1;
      } else {
        validTokens.push(token);
      }
    }

    if (validTokens.length === 0) {
      return {
        delivered: 0,
        skipped,
        reason: 'fcm-delivery-failed',
      };
    }

    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens: validTokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        ...(payload.data ? { data: payload.data } : {}),
      });

      delivered += response.successCount;
      skipped += response.failureCount;
    } catch {
      skipped += validTokens.length;
    }

    return {
      delivered,
      skipped,
      reason: delivered === 0 ? 'fcm-delivery-failed' : undefined,
    };
  }

  private fcmTokenFromEndpoint(endpoint: string): string | null {
    if (typeof endpoint !== 'string') return null;
    if (endpoint.startsWith(FCM_ENDPOINT_PREFIX)) {
      const token = endpoint.slice(FCM_ENDPOINT_PREFIX.length).trim();
      return token.length > 0 ? token : null;
    }
    // Direct device registration tokens (not standard web-push HTTP URLs)
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      const token = endpoint.trim();
      return token.length > 0 ? token : null;
    }
    return null;
  }
}

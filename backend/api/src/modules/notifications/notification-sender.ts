/**
 * 8.19.24 notification-sender abstraction.
 *
 * Delivery providers (FCM today, APNs/another later) implement this
 * interface. Nothing in this step sends automatically — the sender is only
 * invoked explicitly by future features. Keeping Firebase-specific code
 * behind this token lets us swap providers without touching endpoints.
 */
export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface DispatchResult {
  delivered: number;
  skipped: number;
  /** Machine-readable reason when nothing was delivered (e.g. 'fcm-unconfigured'). */
  reason?: string;
}

export abstract class NotificationSender {
  abstract dispatch(userId: string, payload: NotificationPayload): Promise<DispatchResult>;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface DispatchResult {
  delivered: number;
  skipped: number;
  reason?: string;
}

export abstract class NotificationSender {
  abstract dispatch(userId: string, payload: NotificationPayload): Promise<DispatchResult>;
}

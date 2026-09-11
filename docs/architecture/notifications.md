# Notifications (8.19.24)

Minimum push-notification infrastructure. No queues, workers, cron, Redis,
paid services, or automatic campaigns.

## Endpoints (all `Authorization: Bearer <accessToken>`)

- `POST /api/v1/notifications/subscriptions` → `200` — idempotent register.
  Same user + same endpoint returns the existing row (keys refreshed).
  An endpoint owned by another user is `409` (no takeover, no owner oracle).
- `GET /api/v1/notifications/subscriptions` → `200` — caller's rows only,
  oldest first: `{ id, endpoint, keys, createdAt }`. No `userId`, no secrets.
- `DELETE /api/v1/notifications/subscriptions/:id` → `200 { status: 'ok' }`.
  Unknown ids and other users' ids both yield `404` (same convention as
  cohorts — no existence oracle).

Unauthenticated requests get `401` from `JwtAuthGuard` (deleted users lose
access immediately, like every other protected route).

## Subscription contract (web + future Expo/mobile)

Request body:

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/<token>",
  "keys": { "p256dh": "<base64url>", "auth": "<base64url>", "expirationTime": null }
}
```

- `endpoint` is a plain string (not URL-validated): web sends the
  `PushSubscription.endpoint` https URL; future Expo/mobile clients send the
  device token (e.g. `ExponentPushToken[…]`) in the same field.
- `keys` accepts `p256dh` / `auth` / `expirationTime` only; the service
  persists just these into the existing `PushSubscription.keys` Json column.
- Web clients may forward `PushSubscription.toJSON()` verbatim
  (`expirationTime: null` is accepted and stored).

## Storage

Existing `PushSubscription` model only — no new tables. `endpoint` stays
globally unique; `userId` scopes ownership; user deletion cascades (existing
purge policy). Nothing here touches cohorts, progress, anatomy, or auth.

## Sending (not wired to any trigger yet)

`NotificationSender` (abstract) → `FcmNotificationSender` (free FCM legacy
HTTP path, zero new dependencies):

- No `FCM_SERVER_KEY` → resolves `{ delivered: 0, skipped, reason:
  'fcm-unconfigured' }`; nothing is sent, nothing throws.
- With a key → attempts only FCM-routed endpoints
  (`https://fcm.googleapis.com/fcm/send/<token>`), per-subscription
  try/catch with 5s timeout; failures count as `skipped`.
- Never logs the server key, endpoints, or key material (counts only).

## Configuration (no committed secrets)

- `FCM_SERVER_KEY` — Firebase console → Project settings → Cloud Messaging.
  Empty by default; sender stays stubbed.
- `FIREBASE_PROJECT_ID` — optional id; production validation rejects a
  project id without a server key (misconfiguration), but FCM remains
  optional to boot.

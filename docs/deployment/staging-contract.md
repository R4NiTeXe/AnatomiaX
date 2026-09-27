# Staging Environment Contract (8.61)

Placeholder domains below (`staging.<domain>`) are operator-replaced values,
not real infrastructure. Statuses: **[L]** verified locally · **[S]** requires
staging · **[N]** not tested / no staging environment exists.

## Origin matrix (all HTTPS in staging — no localhost)

| Role  | Variable                      | Staging value pattern                                          |
| ----- | ----------------------------- | -------------------------------------------------------------- |
| WEB   | `VITE_API_BASE_URL`           | `https://staging-api.<domain>`                                 |
| WEB   | `VITE_ANATOMY_ASSET_BASE_URL` | `https://staging-assets.<domain>/anatomy/v1/`                  |
| ADMIN | `NEXT_PUBLIC_API_BASE_URL`    | `https://staging-api.<domain>`                                 |
| API   | `CORS_ORIGIN`                 | `https://staging-web.<domain>, https://staging-admin.<domain>` |
| API   | `GOOGLE_CALLBACK_URL`         | `https://staging-api.<domain>/api/v1/auth/google/callback`     |

Rules (enforced by `validateProductionEnv` + boot behavior — **[L]**):
first CORS entry is the web app (OAuth callback target); no wildcard; no
localhost; ID+secret set together; callback non-localhost when OAuth enabled.

## Backend staging values (private — operator host only, never committed)

`NODE_ENV=production`, `PORT`, `HOST`, `DATABASE_URL` (staging PostgreSQL),
`JWT_SECRET` (≥32 random), `JWT_ACCESS_TTL`, `REFRESH_TTL_DAYS` (1–90),
`PASSWORD_RESET_TTL_MINUTES` (1–1440), `COOKIE_SECURE=true`,
`COOKIE_SAMESITE=lax|strict`, Google pair + callback as above, SMTP set
(`SMTP_HOST` + `SMTP_FROM` + paired user/pass, valid port) or fully empty
(stub applies), FCM pair together or empty.

## Rehearsal log

- **[L]** Production-style boot against unreachable DB: boots, liveness 200,
  readiness 503, shutdown clean (see 8.61 report).
- **[L]** CORS allow-list reflection + cookie flags inspected live.
- **[L]** Staging builds embed placeholder origins; bundles scanned clean.
- **[S]** Real PostgreSQL, HTTPS origins, OAuth provider, SMTP delivery,
  CDN edge, backup execution/restore, live-DB load — all staging-required.
- **[N]** No staging environment exists in this milestone; nothing above is
  claimed as externally tested.

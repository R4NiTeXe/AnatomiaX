# ADR-006: Production SameSite=None Default for the Refresh Cookie

Status: accepted.

## Context

Production Google OAuth logins completed server-side (session minted,
`Set-Cookie` on the 302 to `/auth/callback`) yet the SPA reported "No
Google session found" with `/refresh` + `/me` 401ing. The cookie default
was `SameSite=Lax`: browsers store a Lax cookie set on a top-level
navigation response but never send it on cross-site fetch — so the cookie
existed in the jar and was absent on every refresh POST. Email/password
logins masked this because their tokens arrive in the login response body
(memory session works until the first full-page reload).

## Decision

- `AuthController.cookieOptions()` defaults `sameSite` to `'none'` when
  `NODE_ENV=production`, `'lax'` otherwise. Explicit `COOKIE_SAMESITE`
  still wins for operator intent.
- `validateProductionEnv` rejects explicit `lax`/`strict` in production:
  an unset value heals via the default, a set wrong value fails fast at
  boot instead of failing silently in browsers.
- `Secure` was already forced in production, satisfying the
  SameSite=None-requires-Secure pairing.

## Why not weaker alternatives

- This is not a CORS relaxation: CORS and credentials config are
  untouched. The cookie _must_ travel cross-site for refresh to function
  at all in this split-origin architecture; the CSRF residual of
  cross-site cookie sending is covered by `OriginCheckGuard` on the two
  cookie-credentialed routes (ADR-001), plus rotation and reuse-detection.
- SameSite=None does not bypass third-party-cookie _blocking_ (browser
  setting/Incognito): blocked is blocked regardless of attributes. If the
  jar stays empty with correct attributes, the durable fix is a same-site
  API domain (e.g. `api.anatomiax.com`), which is infra work, not code.

## Consequences

- Redeploy with no env changes heals fresh/misconfigured deployments;
  operators who explicitly set `lax`/`strict` get a boot error naming the
  variable instead of a silent auth outage.
- Local dev behavior unchanged (`lax`, non-secure), pinned by e2e.

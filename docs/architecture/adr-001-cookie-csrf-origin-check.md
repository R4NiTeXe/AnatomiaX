# ADR-001: Cookie-CSRF Origin Check on Cookie-Credentialed Mutations

Status: accepted.

## Context

`POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout` accept the
credential from an HttpOnly `SameSite=None; Secure` cookie so silent refresh
survives cross-site top-level navigation. CORS alone does not stop CSRF:
simple cross-site POSTs (form navigation) carry cookies regardless of CORS,
and the browser never exposes the response to the attacker — but the
mutation (rotation / revocation) still executes. The endpoints had no
Origin/Referer verification.

## Decision

- New `OriginCheckGuard` (`backend/api/src/auth/origin-check.guard.ts`),
  applied to `refresh` and `logout` only (the cookie-credentialed routes;
  Bearer routes cannot be forged cross-site, the OAuth callback leg is a
  GET navigation protected by the `state` nonce).
- Browsers send `Origin` on fetch POSTs; `Referer` is the fallback when
  `Origin` is absent. Clients sending neither (native apps, curl, SSR)
  pass through — CSRF is a browser-only threat.
- Exact-match against the `CORS_ORIGIN` allow-list (normalized
  scheme://host[:port]); generic 403 with no oracle detail; fail-closed
  when no allow-list is configured.
- Guard runs before rotation, so a rejected request never burns the token
  (pinned by e2e: forged Origin → 403 → same cookie still refreshes).

## Consequences

- Legitimate browser callers must send a listed Origin (already true for
  the Vercel frontend). Non-browser clients are unaffected.
- `CORS_ORIGIN` is now security load-bearing for these routes, not just a
  CORS convenience — misconfiguration fails closed (403), never open.

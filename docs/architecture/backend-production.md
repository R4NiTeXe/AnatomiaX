# Backend Production Notes (8.57)

Modular NestJS monolith → PostgreSQL. No cache, queue, gateway, or
microservices. Public GLBs bypass the API entirely (see `asset-hosting.md`).

## Authentication model

- Short-lived JWT access tokens (Bearer header; `JwtAuthGuard` revalidates
  the user row per request, so deleted users lose access immediately).
- Rotating PostgreSQL-backed refresh-token families: SHA-256 hashed at rest,
  single-flight rotation is atomic (`updateMany` claim — concurrent refresh
  of one token yields exactly one session); reuse of a revoked token burns
  the whole family. Delivered via httpOnly, Secure-aware, SameSite-lax
  cookie scoped to `/api/v1/auth` (also accepted as JSON body for mobile).
- Passwords: Argon2id. Resets: single-use, expiring, hashed-at-rest,
  email-bound tokens; generic responses (no enumeration); sessions revoked
  on change/confirm; tokens never logged or returned.
- Google OAuth: verified-email linking only; Google tokens never persisted.
  Login CSRF is prevented with a one-time `state` nonce bound to a
  short-lived httpOnly cookie (constant-time verified before any code
  exchange; no session store required).

## RBAC

`JwtAuthGuard` then `RolesGuard` (`STUDENT`/`TEACHER`/`ADMIN`); service-level
`requireViewer`/`requireManager` enforce ownership/membership per resource.
Outsiders get 404 (no existence oracle); archived cohorts are read-frozen
(reads allowed, writes 403). Owners/admins only for member progress.

## Rate limiting, payloads, CORS

- Auth controller: 30/min default; login/register 30, password change/confirm
  20, reset request 10. Throttled responses use the canonical error contract
  (`RATE_LIMITED`, no internals). No global throttle elsewhere by design.
- Body: Express default JSON limit (~100 KB); largest legitimate payloads
  (studied-key merges) are single-digit KB. DTOs cap arrays/lengths
  server-side; admin lists cap at 50–100 with allowlisted enums; sort order
  is server-fixed (no client sort injection).
- CORS: explicit operator allow-list, credentials on, no wildcard (production
  validated at boot); Helmet defaults on.

## Errors, health, lifecycle

- Canonical error body `{ code, message, details?, requestId }` (see
  `api-contract.md`); `x-request-id` on every response; 5xx never leak.
- Health: `GET /health` liveness (no DB); `GET /api/health/db` readiness via
  `SELECT 1` (200/503, no internals). Both public and minimal by design.
- Prisma connects lazily, disconnects on module destroy; shutdown hooks stop
  traffic first. Boot fails fast on unsafe production config
  (`validate-env.ts`: JWT secret, DATABASE_URL, CORS, TTLs, cookies, SMTP).

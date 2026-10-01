# AnatomiaX Security Policy

## Classification

- `VITE_*` / `NEXT_PUBLIC_*` values are **public build-time** (baked into
  browser bundles). Never put secrets there — enforced by
  `scripts/security-grep.js` and by review of every `.env.example` change.
- Backend env (`JWT_SECRET`, `DATABASE_URL`, OAuth/SMTP/FCM credentials)
  is **server-only**. Never log values; name variables only in errors.

## Reporting vulnerabilities

Do not open public issues for suspected vulnerabilities. Contact the
maintainers privately with: affected version/commit, impact, and a minimal
reproduction. Allow reasonable time for a fix before any disclosure.

## What is enforced (and where)

| Control              | Enforcement                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| No committed secrets | `scripts/security-grep.js` (CI gate, fail-closed) + `.gitignore` (`.env`, keys)                                                                  |
| Dependency risk      | `npm audit --audit-level=critical` (CI gate, fail-closed); full `npm audit` runs informationally; Dependabot weekly for `npm` + `github-actions` |
| AuthN/Z, IDOR, RBAC  | `JwtAuthGuard` + `RolesGuard` + service ownership checks; covered by `auth.e2e.spec.ts`, `api-security.e2e.spec.ts`, `guards.spec.ts`            |
| Input validation     | Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) + DTO constraints                                                     |
| Passwords            | Argon2id only; `MinLength(8)` + `MaxLength(128)` DTO bounds                                                                                      |
| Sessions             | Opaque refresh tokens hashed at rest (SHA-256), rotation with reuse-revokes-family, `HttpOnly` + `Secure` (prod) + `SameSite` cookies            |
| Rate limiting        | `ThrottlerGuard` on all controllers (auth 10–30/min, rest 100/min default, in-memory single-instance storage)                                    |
| Error hygiene        | Canonical `{code, message, details?, requestId}` contract; 5xx generic; stacks server-side only (`ApiExceptionFilter`)                           |
| CORS                 | Explicit allow-list + `credentials: true`; wildcard/localhost rejected in production (`validateProductionEnv`)                                   |
| Production config    | `validateProductionEnv` fails fast on weak secrets, bad URLs, or insecure cookie flags                                                           |

## Known supply-chain posture (audited)

`npm audit` (full tree): 0 critical, 15 high, 18 moderate, 4 low. The highs
are transitive toolchain items (NestJS platform pieces, Prisma CLI support,
build-time CSS/glob helpers) with no reachable exploit in this threat model
(no file uploads; JSON bodies size-limited by the framework default with
413 handling in `ApiExceptionFilter`). They are tracked via Dependabot, not
fixed by breaking upgrades, per the frozen-stack policy. Any **critical**
fails CI immediately.

## Out of scope / accepted notes

- `SameSite=None` is required for the cross-site web→API cookie flow; CSRF
  exposure is limited to session disruption (no data theft path — rotated
  tokens are unreadable cross-origin). See `docs/architecture/` ADRs.
- E2E tests mock API routes (hermetic); real cookie transmission is verified
  manually per release (see `docs/deployment/release-checklist.md`).

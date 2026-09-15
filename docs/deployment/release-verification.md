# AnatomiaX Release Verification (STEP 8.20.17)

Final engineering readiness pass before real deployment. This step does not
deploy, does not connect to production, and adds no paid or
cloud-provider-specific infrastructure. It supplements (never duplicates)
`docs/deployment/README.md` with the 8.20.17 findings.

## 1. Current test baseline (8.20.17, post `npm audit fix`)

- Web Jest: 346/346 (35 suites)
- Admin Jest: 6/6
- Anatomy-core Jest: 26/26 (7 suites)
- API Jest: 182/182 (18 suites, incl. 8.20.16 readiness tests)
- Playwright: 11/11 (chromium + mobile-chrome, incl. `/human?focus=` deep-link)
- Workspace typecheck: PASS (web, admin, anatomy-core, shared-types, api, backend-shared)
- Builds: web (`tsc && vite build → dist/`) PASS, admin (`next build`) PASS,
  api (`nest build → dist/`) PASS, marketing (`eleventy + css + js → _site/`) PASS
- Readiness: `check-production-readiness.js --check-builds` PASS
  (HTTPS fixtures PASS, localhost `--production` correctly FAILs)
- Assets: `check-anatomy-assets.js --base /models-dev/` exit 0
  (13 verified dev-subset files + 5 expected fresh-clone misses)
- Perf budget: `check-performance-budget.js` PASS (all chunks within budget)
- `/human` regression: none (viewer code untouched; deep-link E2E green)

## 2. Security audit expectations

Reviewed 8.20.17 against the live code (no new mechanisms invented):

- Passwords: Argon2id (`argon2.hash`/`verify`), generic `Invalid credentials`
  on all login/refresh paths, no enumeration via register conflict is a
  deliberate documented trade-off.
- Refresh: opaque `randomBytes(32)` base64url, SHA-256 hashed at rest,
  rotation revokes the presented token in-transaction, reuse/expired/revoked
  revokes the whole family (theft detection), logout revokes presented token.
- Cookies: `httpOnly`, `Secure` forced in production, `SameSite` configurable
  (`none` requires `Secure=true` enforced by `validateProductionEnv`), scoped
  to `/api/v1/auth`.
- CORS: allow-list (comma-separated web+admin), credentials true, no `*`,
  localhost rejected in production by validation.
- JWT: `JWT_SECRET >= 32` chars enforced in prod (boot fails fast), access TTL
  default `15m`, refresh 1–90 days, reset 1–1440 min.
- Reset: single-use expiring hashed-at-rest tokens, email+token must match the
  same live account, generic `Invalid or expired reset token`, all sessions
  revoked on confirm/change.
- Google OAuth: verified-email required, Google tokens never persisted, pair
  must be set together, localhost callback rejected in prod when enabled.
- Rate limits: global 100/min + auth register/login 30/min, password change/
  reset-confirm 20/min, reset-request 10/min; 429 normalized to `RATE_LIMITED`.
- Validation: global `ValidationPipe` (whitelist + forbidNonWhitelisted +
  transform); errors shaped as `VALIDATION_ERROR` with details only.
- Errors: canonical `{code, message, details?, requestId}`, 5xx always generic
  `Internal server error`, Prisma `P2002→409`/`P2025→404`/else generic, no
  stacks/SQL/tokens/hashes/secrets leave the server.
- RBAC: `JwtAuthGuard` + `RolesGuard`, admin routes `@Roles('ADMIN')`
  backend-enforced (frontend 403 is display-only); teacher/student boundaries
  enforced in cohorts/progress services with user-scoped queries (no IDOR —
  all mutations scope by caller id).
- Account: export returns only own account/cohorts/quiz/snapshot (never
  hashes/tokens); deletion hard-deletes user with cascade + prior session
  revocation; cohorts survive via `SetNull`.
- Logging: `requestId` on every response + error body, 4xx warn / 5xx error
  with stack server-side only, health paths bypass normalization and logging,
  slow (>1000 ms) successes warn for diagnosis, never logs auth/cookie/secrets.

No token/password logging, no auth bypass, no wildcard prod CORS, no insecure
prod cookies, no unsafe leakage found. No new tests needed — existing
`auth.e2e`, `admin.e2e`, `cohorts.e2e`, `api-contract.e2e`, `guards.spec`,
`api-exception.filter.spec` already pin this behavior.

## 3. Dependency audit process

Safe process used (no majors, no new deps):

```bash
npm audit --audit-level=moderate
npm audit fix --dry-run   # review semver-compatible scope first
npm audit fix             # apply smallest compatible updates only
npm audit                 # confirm remainder requires --force (breaking)
```

Result 8.20.17: 39 → 34 findings. Fixed without breaking (lockfile-only,
no `package.json` range changes):

- next 15.5.23 → 15.5.25 (critical RCE fixed) — A, patched.
- sharp 0.34.5 → 0.35.4 (libvips/libheif) — C (asset-pipeline dev-only), patched.
- js-yaml 3.15.1→3.15.2 / 4.3.1→4.3.2 (merge-key CPU) — C (build-time), patched.
- @react-three/drei 9.118.0 → 9.122.0 (transitive uuid bounds) — C, patched.
- postcss direct 8.4.49 → 8.5.28 + @nestjs/config 3.2.3 → 3.3.0 +
  gltf-transform 4.4.2 → 4.5.0 (semver-compatible companions) — patched.

Remaining 34 require `--force` majors (Nest 12, Eleventy 3, react-router 7,
vite 8, prisma 8, webpack 12) and are deliberately NOT upgraded:

- B (prod-relevant, mitigated, non-blocking): `qs` (Express query parser;
  app uses validated DTOs, no comma-format `stringify` path), `file-type`
  (via @nestjs/common; no file-upload routes in the API), `body-parser`
  limit-DoS (default limits untouched, no custom limit parsing),
  `react-router` redirect/SSR-hydration (web is CSR-only, no SSR
  `deserializeErrors`, internal links only), `multer` (no multipart upload
  endpoints), `@nestjs/core` injection (no dynamic module/output paths),
  `postcss` nested 8.4.31 under next/tailwind (build-time CSS only; direct
  copies patched; full fix rides the next major).
- C (dev/build-only, acceptable): `esbuild` dev-server, `glob`/`tmp`/
  `webpack`/`ajv`/`picomatch` (nest-cli scaffolding), `linkify-it`
  (eleventy markdown build), `lodash` (nest-config internals, no `_.template`
  user input), `deepmerge-ts` (prisma config internals).
- D (not applicable): none currently misclassified; re-run `npm audit` at
  release time and before every minor-upgrade window.

Re-run `npm audit` before each release; upgrade majors only in a dedicated
milestone with full retest, never bundled with a release.

## 4. Performance budget / measurement

Existing 8.20.9 `manualChunks` kept (react/query/ui vendors + lazy
three-core/three-r3f/HumanPage). No frameloop/loader/manifest changes.
Measured 8.20.17 from `vite build` output + `scripts/check-performance-budget.js`:

| Chunk (web `dist/assets`) | Raw      | Gzip (vite) | Budget (raw warn) | Lazy                |
| ------------------------- | -------- | ----------- | ----------------- | ------------------- |
| three-core                | 819.5 kB | 214.5 kB    | 950 kB            | yes (`/human` only) |
| react-vendor              | 169.7 kB | 55.4 kB     | 200 kB            | no (shared)         |
| three-r3f                 | 140.3 kB | 46.3 kB     | 170 kB            | yes (`/human` only) |
| HumanPage route           | 78.6 kB  | 20.3 kB     | 100 kB            | yes (route)         |
| ui-vendor                 | 73.5 kB  | 24.0 kB     | info              | no                  |
| query-vendor              | 40.7 kB  | 12.1 kB     | info              | no                  |
| index entry               | 20.7 kB  | 6.6 kB      | 30 kB             | no                  |
| Total JS (35 files)       | ~1463 kB | ~420 kB     | 1700 kB           | —                   |

Initial (non-3D) entry ≈ index + react + query + ui ≈ 300 kB raw
(~100 kB gzip) — acceptable. Largest chunk is the lazy 3D core, never on the
critical path. Admin `next build` (6 routes, shared ~103 kB First Load) and
marketing `_site` (12 pages + minified CSS/JS) verified green.

```bash
node scripts/check-performance-budget.js          # informational PASS
node scripts/check-performance-budget.js --strict # warnings fail (CI opt-in)
node scripts/check-performance-budget.js --json   # machine-readable
```

No preload/prefetch added (no measured benefit); no optimization retained
beyond the existing chunking because none was needed.

## 5. Release gate (CI must stop on any critical failure)

Order enforced in `.github/workflows/ci.yml` (sequential, fail-fast):

`format → typecheck → tests+coverage → build → production-readiness
(--check-builds) → asset contract (/models-dev/) → playwright (chromium) →
artifacts (coverage always, playwright-report on failure)`

`npm ci` + Node 20 + npm cache pinned. No deployment automation, no secrets
in CI. Generated outputs excluded via `.gitignore` (dist, `.next`, `_site`,
coverage, playwright-report, `*.tsbuildinfo`, GLBs).

## 6. Final smoke matrix (map to existing coverage — no redundant tests)

- PUBLIC: marketing home → build emits `_site/index.html`; sitemap/robots →
  `_site/sitemap.xml` + `_site/robots.txt` (marketing build); web home →
  `e2e/web.spec.ts` public home.
- AUTH: login/register/validation → `e2e/web.spec.ts` login + `auth-pages.test`
  - `api auth.e2e`; forgot/reset → web auth pages + `api auth.e2e` reset flow;
    Google entry → `google.strategy.spec` + `AuthCallbackPage` tests; session
    expiry → `AuthProvider`/`RequireAuth` tests + refresh e2e.
- STUDENT: dashboard/learn/progress/quiz → `student-home`, `progress-hub`,
  `anatomyQuiz*` suites + `progress.e2e`; `/human` deep-link →
  `e2e/web.spec.ts` deep-link + `humanDeepLink.test`.
- TEACHER: cohorts + dashboard + boundaries → `e2e/web.spec.ts` teacher,
  `cohorts.test`, `cohortDashboard.test`, `api cohorts.e2e` (403/IDOR).
- ADMIN: overview/users/cohorts + RBAC → `admin.test.tsx` (6/6) +
  `api admin.e2e` (student 403, limit caps, safe DTOs) + `e2e/a11y` admin shell.
- BACKEND: liveness → `health.e2e` (`/api/health` + `/health` 200);
  readiness → `health.e2e` (200/503 by DB state, no leak); auth/RBAC →
  `api-contract.e2e` + `auth.e2e` + `admin.e2e`.
- STATIC: asset URL contract → `assetManifest.test` (18 + hashes) +
  `check-anatomy-assets.js` + `check-production-readiness.js` (no localhost prod).

No gaps found requiring new tests in this step.

## 7. Remaining blockers

None release-blocking. Non-blocking notes (do not gate release):

1. 34 `npm audit` findings remain, all requiring breaking majors (see §3) —
   documented with mitigations; revisit in a dedicated upgrade milestone.
2. Root `prettier --check` warns on untouched `e2e/*`/`jest.config.cjs`
   CRLF on Windows; all 8.20.17-touched files pass; Linux CI (LF) unaffected.
   Left untouched per minimal-change rules.
3. Dev `public/models-dev/` holds the 13-file subset (5 female files absent) —
   expected fresh-clone state; production uses the 18-file static host, not dev copies.

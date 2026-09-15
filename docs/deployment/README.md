# AnatomiaX Deployment Guide (STEP 8.20.16)

Provider-neutral release contract for development → test → staging → production.
This milestone does not deploy anything; it defines the configuration, startup,
database-release, health-check, asset-delivery, and rollback contract so any
ordinary host (VM, container, PaaS, static host) can run AnatomiaX safely.

No Kubernetes, service mesh, queue, paid monitoring, or cloud-specific
automation is required. No native mobile runtime exists (responsive web only).

Related contracts:

- 3D asset hosting: `docs/architecture/asset-hosting.md`
- API surface: `docs/architecture/api-contract.md`
- Readiness scripts: `scripts/check-anatomy-assets.js`, `scripts/check-production-readiness.js`

---

## 1. Architecture overview

- `frontend/web` — React 18 + Vite + TypeScript + Tailwind + Three.js / R3F / Drei.
  Serves the marketing-adjacent app, auth, dashboards, cohorts, and `/human` 3D viewer.
  Static build output in `frontend/web/dist/`.
- `frontend/admin` — Next.js + TypeScript. Operational workspace (AdminShell,
  Overview, Users, Cohorts, Cohort detail). `npm run build` then `npm run start`.
- `frontend/marketing` — 11ty static site. Output in `frontend/marketing/_site/`
  (`/sitemap.xml`, `/robots.txt`, OG/canonical via `SITE_URL`).
- `backend/api` — NestJS 10 + Express + Prisma + PostgreSQL. Modular monolith.
  Global prefix `/api`. Health: `/health` + `/api/health` (liveness),
  `/api/health/db` (readiness). Auth: JWT access + rotating opaque refresh
  (httpOnly cookie), Google OAuth optional, Argon2id hashing.
- `frontend/packages/shared-types`, `frontend/packages/anatomy-core` —
  shared types + canonical 18-entry GLB manifest (`assetManifest.ts`).
- `3d-assets/` — source/optimized GLBs (gitignored optimized bytes; manifest is
  the contract). GLBs are served by a static HTTPS host, never PostgreSQL/API.
- `backend/api/prisma/` — schema + migrations (`migration_lock.toml`,
  `20260911000000_init/`, `20260911000001_quiz_attempt_started_at/`,
  `20260911133233_password_reset_tokens/`).

---

## 2. Required runtimes/tools

- Node.js `>=18.0.0`, npm `>=9.0.0` (see root `package.json` engines).
- PostgreSQL (any recent 14/15/16) for backend/api beyond health liveness.
- No Docker required by this repo (do not add Docker solely for this milestone).
- Playwright chromium for E2E (`npx playwright install --with-deps chromium`).
- Provider-neutral static HTTPS host for the 18 GLBs (S3+CloudFront, GCS,
  Azure, R2, Netlify, Vercel static, nginx, Apache, Caddy — any works).

Install (from repo root):

```bash
npm ci
```

---

## 3. Environment variables

One model covers development → test → staging → production. Only
`NODE_ENV=production` enforces the strict backend contract
(`src/config/validate-env.ts`); staging should set `NODE_ENV=production`
with staging values so the same checks gate staging before production.

### PUBLIC BUILD-TIME (baked into browser bundle — never secrets)

| Variable                      | Surface   | Local default               | Staging/production rule                                                                                           |
| ----------------------------- | --------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`           | web       | `http://localhost:3000`     | Explicit HTTPS API origin. Never localhost in prod.                                                               |
| `VITE_ANATOMY_ASSET_BASE_URL` | web       | `/models-dev/`              | Explicit HTTPS static base. Never localhost in prod.                                                              |
| `NEXT_PUBLIC_API_BASE_URL`    | admin     | `http://localhost:3000`     | Explicit HTTPS API origin. Never localhost in prod.                                                               |
| `SITE_URL` (or `URL`)         | marketing | `https://anatomiax.example` | Canonical HTTPS origin for canonical/sitemap/OG.                                                                  |
| `CONTACT_EMAIL`               | marketing | `contact@anatomiax.example` | Real contact address in production.                                                                               |
| `APP_URL`                     | marketing | _(empty)_                   | Deployed web-app origin; Login→`<app>/login`, Get Started→`<app>/register`. Empty keeps the `/contact/` fallback. |

### SERVER-ONLY (never via `VITE_*` / `NEXT_PUBLIC_*`)

| Variable                                    | Required in prod       | Notes                                                                                                 |
| ------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | yes                    | `postgresql://…` connection string. Never commit real value.                                          |
| `JWT_SECRET`                                | yes                    | `>=32` chars, not the placeholder. No secret in logs/errors.                                          |
| `CORS_ORIGIN`                               | yes                    | Comma-separated HTTPS origins (first = web app; OAuth redirects there). No `*`, no localhost in prod. |
| `PORT`                                      | no                     | Integer 1–65535. Default `3000`.                                                                      |
| `HOST`                                      | no                     | Default `0.0.0.0`. Local dev may use `127.0.0.1`.                                                     |
| `JWT_ACCESS_TTL`                            | no                     | Default `15m`.                                                                                        |
| `REFRESH_TTL_DAYS`                          | no (1–90)              | Default `30`.                                                                                         |
| `PASSWORD_RESET_TTL_MINUTES`                | no (1–1440)            | Default `60`.                                                                                         |
| `COOKIE_SECURE`                             | no (`true/false`)      | Forced `true` in production. `none` requires `true`.                                                  |
| `COOKIE_SAMESITE`                           | no (`lax/strict/none`) | Default `lax`.                                                                                        |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | optional pair          | Set together or leave both empty. Callback must not be localhost in prod when enabled.                |
| `GOOGLE_CALLBACK_URL`                       | only if Google enabled | e.g. `https://api.<domain>/api/v1/auth/google/callback`.                                              |
| `FCM_SERVER_KEY`                            | optional               | Empty = push sender stays stubbed, nothing sent.                                                      |
| `FIREBASE_PROJECT_ID`                       | optional               | Requires `FCM_SERVER_KEY` when set.                                                                   |

Verified: no `JWT_SECRET`, `DATABASE_URL`, OAuth secret, refresh secret, or
FCM private key is read through `VITE_*` or `NEXT_PUBLIC_*` anywhere in the
repo (see `scripts/check-production-readiness.js --strict-env`).

Examples: `backend/api/.env.example`, `frontend/web/.env.example`,
`frontend/admin/.env.example`, `frontend/marketing/.env.example`.

---

## 4. Local development setup

```bash
npm ci
# backend (terminal 1) — needs DATABASE_URL in backend/api/.env
npm run dev -w @anatomiax/api
# web (terminal 2)
npm run dev -w @anatomiax/web
# admin (terminal 3)
npm run dev -w @anatomiax/admin
# marketing (terminal 4)
npm run dev -w @anatomiax/marketing
```

- Web dev server: `http://localhost:5173` (see `frontend/web/vite.config.ts`).
- API dev: `http://localhost:3000` (`PORT`/`HOST` in `backend/api/.env`).
- Dev 3D assets: omit `VITE_ANATOMY_ASSET_BASE_URL` or keep `/models-dev/`.
  Fresh clone works without GLBs (viewer shows boundaries). To populate the
  flat dev subset (gitignored):

```bash
cp 3d-assets/male/working/optimized/*.glb frontend/web/public/models-dev/
# female copies use the female- prefix (see docs/architecture/asset-hosting.md)
```

- Dev auth cookies: `COOKIE_SECURE=false`, `COOKIE_SAMESITE=lax` works on
  `http://localhost`. Production forces `Secure` regardless.

---

## 5. Test setup

```bash
# workspace unit tests (Jest)
npm run test --workspaces --if-present
# with coverage (as CI does)
npm run test --workspaces --if-present -- --coverage --coverageReporters=text --coverageReporters=lcov
# typecheck + format
npm run typecheck --workspaces --if-present
npm run format:check
# browser E2E (needs web dev server; config auto-starts it)
npx playwright install --with-deps chromium
npx playwright test --reporter=list
```

Current baselines (8.20.15, preserved by 8.20.16):

- web Jest 346/346, admin Jest 6/6, anatomy-core 26/26, API 174/174 (+ new
  deployment-readiness tests), Playwright 11/11.

Backend tests use isolated fake-DB modules; no real PostgreSQL is required
for unit tests. `PrismaService` is intentionally lazy (`onModuleInit` does
not `$connect`) so boot/tests work without a database; readiness reports
`disconnected` until a DB is reachable.

---

## 6. Staging setup

Treat staging as production-config with staging values:

1. Set `NODE_ENV=production` on the API with staging secrets/URLs so
   `validateProductionEnv` gates staging exactly like production.
2. `CORS_ORIGIN=https://staging-web.<domain>, https://staging-admin.<domain>`
   (no wildcard, no localhost). Convention: the FIRST entry is the web app —
   Google OAuth success redirects to `<first-entry>/auth/callback`.
3. Web build with staging values baked at build time:

```bash
VITE_API_BASE_URL=https://staging-api.<domain> VITE_ANATOMY_ASSET_BASE_URL=https://staging-assets.<domain>/anatomy/ npm run build -w @anatomiax/web
```

4. Admin build with staging API origin:

```bash
NEXT_PUBLIC_API_BASE_URL=https://staging-api.<domain> npm run build -w @anatomiax/admin
```

5. Marketing build with staging canonical URL:

```bash
SITE_URL=https://staging.<domain> CONTACT_EMAIL=contact@staging.<domain> APP_URL=https://staging-app.<domain> npm run build -w @anatomiax/marketing
```

6. Apply migrations with `npx prisma migrate deploy` (see §12), start the API
   with `npm run start:prod -w @anatomiax/api`, then verify §14–§15.

---

## 7. Production environment setup

On the API host, provide server-only variables (never in frontend builds):

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB
JWT_SECRET=<long-random->=32-chars>
CORS_ORIGIN=https://<web-origin>, https://<admin-origin>
REFRESH_TTL_DAYS=30
PASSWORD_RESET_TTL_MINUTES=60
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
# optional:
# GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… GOOGLE_CALLBACK_URL=https://<api>/api/v1/auth/google/callback
# FCM_SERVER_KEY=… FIREBASE_PROJECT_ID=…
```

Startup fails fast with `Invalid production configuration: …` (variable names
and rules only, never secret values) when required config is missing/unsafe.
Rules enforced: JWT strength, `postgresql://` scheme, CORS allow-list hygiene
(no `*`, no localhost), TTL bounds, SameSite/Secure compatibility, Google
pair + non-localhost callback when enabled, FCM project-requires-key,
`PORT`/`HOST` shape.

Frontend builds bake public values at build time — rebuild/redeploy the
static output when rotating a public base URL (no server restart reads them).

---

## 8. Frontend web build

Actual commands (`frontend/web/package.json`):

```bash
npm run typecheck -w @anatomiax/web
npm run build -w @anatomiax/web      # tsc && vite build → frontend/web/dist/
npm run preview -w @anatomiax/web    # local preview of dist/
```

- `VITE_API_BASE_URL` and `VITE_ANATOMY_ASSET_BASE_URL` are read at build
  time (Vite `import.meta.env` + `vite.config.ts` define fallback).
- Localhost fallback (`http://localhost:3000`, `/models-dev/`) is dev-only.
  Production builds must set explicit HTTPS values; the readiness script
  fails closed on localhost production bases:

```bash
node scripts/check-production-readiness.js --api-base https://<api> --asset-base https://<assets>/anatomy/
```

- Do not hardcode a future domain in source; pass it via env at build time.

---

## 9. Admin build/start

Actual commands (`frontend/admin/package.json`):

```bash
npm run typecheck -w @anatomiax/admin
npm run build -w @anatomiax/admin     # next build
npm run start -w @anatomiax/admin     # next start (production server)
```

- `NEXT_PUBLIC_API_BASE_URL` is the client API origin (must match server
  `CORS_ORIGIN`). No server secret may enter the client bundle — verified by
  the readiness script scanning `frontend/admin/.env.example` and source for
  `NEXT_PUBLIC_*` secret leakage.
- Production must not assume localhost: set `NEXT_PUBLIC_API_BASE_URL` to the
  HTTPS API origin at build time; `getApiBaseUrl()` localhost default is
  dev-only.

---

## 10. Marketing build

Actual commands (`frontend/marketing/package.json`):

```bash
npm run build -w @anatomiax/marketing            # eleventy + css + js → _site/
npm run build:eleventy -w @anatomiax/marketing   # eleventy only
npm run build:css -w @anatomiax/marketing
npm run build:js -w @anatomiax/marketing
```

- `SITE_URL` (or `URL`) is the canonical HTTPS origin for `<link rel=canonical>`,
  `sitemap.xml`, `robots.txt`, `og:url`, JSON-LD (`src/_data/site.js`).
- `CONTACT_EMAIL` is the public contact placeholder.
- `APP_URL` (optional, 8.20.19) is the deployed web-app origin for the
  marketing-to-app journey: navbar/footer/home Login CTAs resolve to
  `<APP_URL>/login` and Get Started CTAs to `<APP_URL>/register`. Empty
  (default) preserves the `/contact/` fallback. Example staging build:
  `APP_URL=https://staging-app.<domain> npm run build -w @anatomiax/marketing`.
- Local/example defaults (`https://anatomiax.example`,
  `contact@anatomiax.example`) are clearly non-production placeholders —
  override both in staging/production; never invent a real domain in source.

---

## 11. Backend build/start

Actual commands (`backend/api/package.json`):

```bash
npm run typecheck -w @anatomiax/api
npm run build -w @anatomiax/api        # nest build → backend/api/dist/
npm run start:prod -w @anatomiax/api   # node dist/main
# dev only:
npm run dev -w @anatomiax/api          # nest start --watch
npm run start -w @anatomiax/api        # nest start
```

Production lifecycle (`src/main.ts`):

- `validateProductionEnv` runs before listen (fail fast).
- `app.enableShutdownHooks()` — SIGTERM/SIGINT stops new traffic, finishes
  active work where practical, disconnects Prisma (`onModuleDestroy`),
  closes the HTTP server. No custom process manager.
- Explicit `HOST`/`PORT` binding (default `0.0.0.0:3000`); startup logs the
  bind address without secrets.
- `trust proxy = 1` (single hop, provider-neutral) so Secure cookies and
  `x-forwarded-*` behave behind nginx/Caddy/cloud LB.
- `helmet`, `ValidationPipe` (whitelist + forbidNonWhitelisted + transform),
  `cookie-parser`, CORS allow-list with credentials, `requestId` +
  structured error contract, `LoggingInterceptor` (health paths skipped).

---

## 12. Prisma production migration procedure

Schema: `backend/api/prisma/schema.prisma`. Migrations:
`backend/api/prisma/migrations/` (`migration_lock.toml` + three migrations).

### Local development

```bash
npx prisma generate -w @anatomiax/api 2>/dev/null || npx prisma generate --schema backend/api/prisma/schema.prisma
npx prisma migrate dev --schema backend/api/prisma/schema.prisma
```

(`postinstall` runs `prisma generate` automatically.)

### Test

Backend unit/E2E uses isolated fake-DB modules — no real migration needed.
Integration against a real DB should use a dedicated empty test database,
never the dev or staging data.

### Staging / production (non-destructive, ordered)

```bash
# 1. build the application
npm run build -w @anatomiax/api
# 2. apply committed migrations only (never db push / reset in staging/prod)
npx prisma migrate deploy --schema backend/api/prisma/schema.prisma
# 3. start the application
npm run start:prod -w @anatomiax/api
# 4. verify readiness + smoke checks (§14–§16)
```

Rules:

- Production uses `prisma migrate deploy` only.
- Never use `prisma db push` as the production migration procedure.
- Never use `prisma migrate reset` outside local throwaway databases.
- Never automatically destroy data; no destructive rollback procedure is
  provided (see §17).
- Release ordering is always: build → migrate → start → health/readiness →
  smoke checks. Keep application changes backward-compatible with the
  previous schema during rollout where possible.

Do not generate a migration unless the schema actually changed.

---

## 13. Anatomy asset deployment

Source of truth: `frontend/packages/anatomy-core/src/assetManifest.ts`
(18 entries, male+female × 9 systems, `file` + `bytes` + `sha256`).
URL builder: `buildAssetUrl` / `getManifestAssetUrl` / `getVersionedAssetUrl`.

- Development: `VITE_ANATOMY_ASSET_BASE_URL=/models-dev/` (or unset) → flat
  `frontend/web/public/models-dev/*.glb` with `female-` prefix (13-file
  subset, gitignored). Fresh clone works without GLBs.
- Production: host the 18 `3d-assets/<bodyModel>/working/optimized/*.glb`
  on any static HTTPS host under `<BASE>/<BODY_MODEL>/<FILE>`:

```text
<BASE>/male/skin-meshopt.glb … <BASE>/female/lymphatic-meshopt.glb (18 total)
```

Set the HTTPS base at web build time and verify:

```bash
VITE_ANATOMY_ASSET_BASE_URL=https://<assets-host>/anatomy/ npm run build -w @anatomiax/web
node scripts/check-anatomy-assets.js --base https://<assets-host>/anatomy/
node scripts/check-anatomy-assets.js --base https://<assets-host>/anatomy/ --verify  # GET+SHA-256
node scripts/check-anatomy-assets.js --base /models-dev/  # local flat layout
```

Full header/caching/CORS/versioning rules are in
`docs/architecture/asset-hosting.md` (Content-Type `model/gltf-binary`,
CORS, `Cache-Control: public, max-age=31536000, immutable`, ETag, Range,
`?v=<shortHash>` strategy). The backend API never serves GLBs; do not put
GLBs in PostgreSQL, duplicate assets, or add a paid CDN.

---

## 14. Health checks

| Route                | Kind      | DB I/O           | Success                               | Failure                                        |
| -------------------- | --------- | ---------------- | ------------------------------------- | ---------------------------------------------- |
| `GET /health`        | liveness  | none             | `200 {status:ok}`                     | never fails when process is up                 |
| `GET /api/health`    | liveness  | none             | `200 {status:ok}`                     | never fails when process is up                 |
| `GET /api/health/db` | readiness | `SELECT 1` probe | `200 {status:ok, database:connected}` | `503 {status:degraded, database:disconnected}` |

- Liveness confirms the process is running; use it for process supervision.
- Readiness checks real PostgreSQL availability; gate traffic/rollouts on it.
- Failure payloads never expose raw DB errors or secrets (`ping()` → boolean).
- Health paths keep legacy payloads, bypass error normalization
  (`isHealthPath`), and are skipped by `LoggingInterceptor` to avoid noise.
- No Kubernetes-specific infrastructure; any supervisor can poll these.

```bash
curl -i http://<api>/api/health
curl -i http://<api>/api/health/db
curl -i http://<api>/health
```

---

## 15. Smoke-test checklist

After build → migrate → start, in order:

1. `GET /api/health` → `200 {status:ok}`.
2. `GET /health` → `200 {status:ok}`.
3. `GET /api/health/db` → `200` connected (or `503` degraded only if the DB
   is intentionally down — investigate before proceeding).
4. `node scripts/check-production-readiness.js --api-base <https-api> --asset-base <https-assets>/`
   → exit 0 (no localhost prod bases, no frontend secret leakage, manifest intact).
5. `node scripts/check-anatomy-assets.js --base <https-assets>/` → 18 OK
   (add `--verify` for SHA-256 on first deploy).
6. Web `dist/` exists and contains hashed assets (`npm run build -w @anatomiax/web`).
7. Admin `next build` + `next start` boot without localhost assumption.
8. Marketing `_site/sitemap.xml` + `_site/robots.txt` reference the canonical `SITE_URL`.
9. Login → refresh → cohort → quiz smoke path in staging before production.
10. Confirm `CORS_ORIGIN` matches the deployed web/admin origins.
11. Google OAuth (only when configured): start Login → Continue with Google →
    approve → expect landing on `<web>/auth/callback` then the app (never raw
    JSON). Consent-denied stays a safe API error, never a crash.
12. Role access: student reaches `/learn`, teacher reaches `/cohorts`, student
    gets 403 on admin routes, admin reaches admin overview/users/cohorts.
13. `/human` loads; deep link `/human?focus=<key>` opens the viewer.
14. Logout → protected routes redirect to `/login`; expired sessions show the
    sign-in notice without cached data leaking across accounts.
15. Rollback path verified before traffic: previous artifacts retained (§17).

Automated (no secrets, no cloud):

```bash
node scripts/check-production-readiness.js
node scripts/check-anatomy-assets.js --base /models-dev/
npm run typecheck --workspaces --if-present
npm run build --workspaces --if-present
```

Release-day operator smoke against deployed URLs (URLs only, no secrets):

```bash
node scripts/check-production-readiness.js --production --smoke \
  --site-url <https-marketing> --web-url <https-web> --admin-url <https-admin> \
  --health-url <https-api> --api-base <https-api> \
  --asset-base <https-assets>/ --cors <https-web>,<https-admin> --app-url <https-web>
```

This probes `/` (web/admin/site), `/sitemap.xml` + `/robots.txt`, API
liveness/readiness, anatomy manifest rules, APP_URL↔CORS consistency, and
Google-callback liveness — exit 0 only when every probe passes.

---

## 16. Release sequence

1. Merge + green CI (format, typecheck, tests, builds, Playwright).
2. Build API (`npm run build -w @anatomiax/api`).
3. Apply migrations (`npx prisma migrate deploy …`).
4. Start API (`npm run start:prod -w @anatomiax/api`).
5. Verify liveness + readiness (§14).
6. Deploy web/admin/marketing static outputs built with production env.
7. Deploy/verify anatomy assets (§13).
8. Run smoke checklist (§15).
9. Monitor logs (requestId correlation, no secret material).

---

## 17. Rollback strategy

- **Application rollback:** redeploy the previous known-good build (API
  `dist/`, web `dist/`, admin `.next`, marketing `_site`). Keep prior
  artifacts until the new release is verified healthy.
- **Database rollback:** schema rollback is not assumed safe. Do not run
  destructive down-migrations, `db push`, or `migrate reset` in
  staging/production. Prefer backward-compatible migrations (additive first,
  removal later) so an app rollback remains compatible with the newer schema.
  If a migration must be undone, author and review a new forward migration —
  never an automatic data-destroying rollback.
- **Asset rollback:** GLBs are immutable-cacheable by `?v=<shortHash>`/ETag;
  keep the previous 18 files available under the same `<bodyModel>/<file>`
  layout until clients have revalidated.
- **Secret rotation:** rotate by updating the server environment and
  restarting the API (no rebuild needed for server-only values). Rotating a
  public base URL requires rebuilding the affected frontend.

---

## 18. Secret rotation guidance

- `JWT_SECRET`: generate `>=32` random chars (`openssl rand -base64 48`),
  set on the API host, restart. Existing access tokens invalidate; users
  re-login (refresh family will fail closed — expected).
- `DATABASE_URL`: rotate credentials at the database, update the API env,
  restart. Verify `/api/health/db` returns connected.
- Google OAuth: rotate in the Google console, update both `GOOGLE_CLIENT_ID`
  and `GOOGLE_CLIENT_SECRET` together, restart.
- `FCM_SERVER_KEY`: rotate in Firebase console, update env, restart (empty =
  stubbed sender, safe default).
- Never commit rotated values; never echo them in logs/CI; never place them
  in `VITE_*`/`NEXT_PUBLIC_*`.

---

## 19. Common failure conditions

| Symptom                                         | Likely cause                                                 | Fix                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `Invalid production configuration: JWT_SECRET…` | short/placeholder secret                                     | set `>=32` random `JWT_SECRET`                                          |
| `…DATABASE_URL…`                                | missing or non-`postgresql://`                               | set full `postgresql://` URL                                            |
| `…CORS_ORIGIN…wildcard/localhost`               | `*` or localhost in prod                                     | set explicit HTTPS origins                                              |
| `…COOKIE_SECURE…none`                           | `SameSite=None` + `Secure=false`                             | set `COOKIE_SECURE=true`                                                |
| `…GOOGLE_CALLBACK_URL…localhost`                | OAuth callback still dev                                     | set HTTPS callback                                                      |
| `…PORT…`                                        | bad port                                                     | set 1–65535                                                             |
| `503 {degraded, disconnected}`                  | DB unreachable                                               | check `DATABASE_URL`, network, `migrate deploy`                         |
| Web calls `localhost:3000` in prod              | `VITE_API_BASE_URL` not set at build                         | rebuild web with HTTPS API base                                         |
| Admin calls `localhost:3000` in prod            | `NEXT_PUBLIC_API_BASE_URL` not set                           | rebuild admin with HTTPS API base                                       |
| Viewer 404/CORS on GLBs                         | wrong `VITE_ANATOMY_ASSET_BASE_URL` or host headers          | fix base + host per `asset-hosting.md`, rerun `check-anatomy-assets.js` |
| Cookies rejected in prod                        | `SameSite=None` without `Secure` or cross-site without HTTPS | use `lax` + `Secure` + HTTPS                                            |
| Google flow fails in prod                       | partial ID/secret or localhost callback                      | set both + HTTPS callback                                               |

---

## 20. Security notes

- Authorization (`JwtAuthGuard`, `RolesGuard`, ADMIN/TEACHER/STUDENT) is
  unchanged; no test bypass leaks to production.
- `helmet`, `ValidationPipe`, `requestId`, structured error contract, CORS
  allow-list with credentials, and `httpOnly` + `Secure` (prod) + `SameSite`
  cookies remain enforced.
- Error paths never leak stacks, Prisma/SQL internals, tokens, hashes, or
  secrets (5xx → generic `Internal server error`).
- Health/readiness never expose DB errors or secrets.
- No `*` CORS, no insecure-cookie downgrade, no `db push`/`migrate reset` in
  prod docs, no frontend secret exposure, no asset-URL injection (manifest
  filenames only, `bodyModel/file` allow-listed).
- No new dependencies, no paid services, no K8s/service-mesh/queue, no
  Redux/Zustand/Axios, no native mobile reintroduced.

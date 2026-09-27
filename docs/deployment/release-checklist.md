# Production Release Checklist (8.58)

Status legend: **[L]** verified locally (CI, gates, suites) · **[S]** requires
staging validation · **[N]** not tested (external provider behavior).

## Pre-deploy

- [ ] **[L]** CI green: format, typechecks, Jest, builds, Prisma gate, perf
      budget, Playwright 17/17.
- [ ] **[L]** `node scripts/check-production-readiness.js --check-builds` exit 0.
- [ ] **[L]** `node scripts/check-anatomy-assets.js --base /models-dev/` exit 0.
- [ ] Secrets set on the API host (never in repo/CI/logs): `JWT_SECRET`
      (≥32 random), `DATABASE_URL`, Google pair, SMTP creds as needed.
- [ ] `CORS_ORIGIN` equals the deployed web+admin HTTPS origins (no `*`,
      no localhost); first entry is the web app (OAuth callback target).
- [ ] Cookie posture: `Secure` + `lax` (or explicit `none`+`Secure`) over HTTPS.
- [ ] Web/admin rebuilt with production `*_API_BASE_URL` and asset base
      (`VITE_ANATOMY_ASSET_BASE_URL=https://<host>/anatomy/v1/` style).
- [ ] Previous artifacts retained for rollback (API `dist/`, web `dist/`,
      admin `.next`, prior 18 GLBs).

## Deploy (order: `README.md` §16)

- [ ] PostgreSQL reachable; pre-migration backup taken (see `operations.md`).
- [ ] `npx prisma migrate deploy` only — never `db push` / `migrate reset`.
- [ ] API boots with zero `Invalid production configuration` failures.
- [ ] `GET /api/health` → 200; `GET /api/health/db` → 200 connected.
- [ ] Static outputs deployed; asset host serves 18 GLBs
      (`check-anatomy-assets.js --base <https-assets>/ [--verify]`).

## Post-deploy smoke — [S] staging first, then production

- [ ] Login → refresh → logout; expired session returns to sign-in cleanly.
- [ ] Role access: student `/learn`, teacher `/cohorts`, student 403 on admin,
      admin overview/users/cohorts.
- [ ] Learning → quiz → progress sync; teacher assignment flow.
- [ ] `/human` loads; model switch; deep link `?focus=`; retry on forced 404.
- [ ] Google OAuth approve + deny paths (only when configured).
- [ ] SMTP reset mail received; token single-use (only when configured).
- [ ] **[N]** CDN edge caching, real mobile networks, provider dashboards —
      documented requirements, never claimed as tested without staging evidence.

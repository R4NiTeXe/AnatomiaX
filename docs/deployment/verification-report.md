# Verification Report — Production-Correctness Pass (Phases 0–7)

Date: 2026-10-01. Scope: uncommitted working tree only (123 changed paths,
82 tracked-file diffs + new files). Nothing was committed or pushed.

## 1. Gate results (all executed, not assumed)

| Gate                                                                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check` (root)                                            | PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run lint` (`eslint . --max-warnings 0`)                             | PASS, zero warnings                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| web Jest                                                                 | 547/547 (70 suites), 80% thresholds enforced                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| admin Jest                                                               | 60/60 (7 suites), 80% thresholds enforced                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| anatomy-core Jest                                                        | 61/61 (10 suites), 80% thresholds enforced                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| API Jest                                                                 | 326/326 (29 suites), 80% thresholds enforced                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| API `tsc --noEmit`, web `tsc --noEmit`                                   | PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| web production build (`VITE_API_BASE_URL` origin)                        | PASS; bundle: origin 1×, `localhost:3000` 0×, dashboard chunk present                                                                                                                                                                                                                                                                                                                                                                                                            |
| API `nest build`                                                         | PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `node scripts/security-grep.js`                                          | PASS (452 tracked files); negative probe confirmed FAIL on `sk-ant-`/`ghu_`/`npm_` shapes, then cleaned                                                                                                                                                                                                                                                                                                                                                                          |
| `npm audit`                                                              | full 37 (4 low/18 moderate/15 high), prod-only 21, **0 critical**; critical gate wired in CI                                                                                                                                                                                                                                                                                                                                                                                     |
| OAuth prod SameSite default                                              | controller unit (prod None/secure) + boot-rejects-lax + e2e Lax-lock + full api 279/279 green; live `/google` leg probed healthy (302, correct `redirect_uri`, state cookie flags). Browser sign-off still requires a real login run — NOT yet declared fixed                                                                                                                                                                                                                    |
| CORS hardening (plural alias/quote-strip/require/boot-log/preflight e2e) | `cors-origins` unit 11/11 + preflight e2e 4/4 + full api 295/295 green; live prod preflight re-probed PASSING (204 + exact ACAO + credentials) — reported browser errors are stale-or-intermittent, see troubleshooting §2c                                                                                                                                                                                                                                                      |
| Prod model 404-as-HTML incident                                          | Live bytes prove `…/models-dev/skin-meshopt.glb` returns 200 + `text/html` + `<!doctype` (1168 B shell): unset `VITE_ANATOMY_ASSET_BASE_URL` on Vercel bakes in gitignored dev paths. Fix: Vercel-scoped build fail-fast without an `https://` asset base + `scripts/verify-model-url.js` acceptance probe (RED on prod now, PASS on real binary). Provisioning the static host + env + redeploy is operator work — NOT yet fixed in production                                  |
| Playwright                                                               | 17/17 full green locally after the GLB-fixture fix (was 11 + 1 failed + 5 serial-skipped on CI: fresh clones lack the gitignored `models-dev/` subset, so the dev server served `index.html` for `.glb` paths. `scripts/populate-dev-assets.js` copies real meshes when pipeline sources exist, else writes hermetic synthetic fixtures — full 6/6 viewer suite green on fixtures too, RED→GREEN reproduced both ways. Real-cookie flow still mocked-API — known gap, unchanged) |
| Prisma gate / readiness / perf / assets                                  | PASS (unchanged code paths, re-run this session)                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Note: one full web run showed a single transient test failure; two
immediate full reruns were 547/547. No suite was changed between runs —
treated as flakes, not regressions. If it recurs, suspect timing-sensitive
suites first (`cohortDashboard`, `shaderBackdrop`, `queryHooks`).

## 2. What changed (by phase)

- **Phase 1 — lint foundation:** flat `eslint.config.js`, `npm run lint`
  (zero warnings), 5 pinned dev deps, CI lint step. Two post-phase
  violations found and fixed with justified targeted disables
  (decorator metadata-carrier params; `require` inside
  `jest.isolateModules`, which `import` cannot do).
- **Phase 2 — coverage:** 80% global thresholds in all four Jest configs;
  ~100 new tests closing gaps to the gate.
- **Phase 3 — security gates:** `scripts/security-grep.js` (fail-closed,
  CI-wired), `npm audit --audit-level=critical` CI gate + informational
  full report, `SECURITY.md`, Dependabot weekly.
- **Phase 4 — P0 code (all TDD, RED observed before GREEN):**
  - `OriginCheckGuard` on refresh/logout (8→10 unit + e2e; rejects before
    rotation so the token survives a 403) — ADR-001.
  - Fire-and-forget password-reset delivery (unit + e2e polling) — ADR-002.
  - Bounded OAuth round-trip, 15s default / 120s cap, `OAUTH_TIMEOUT_MS`
    boot-validated (7 unit + env specs) — ADR-003.
  - Admin column narrowing (`select` over `include`; `toSafeUser` takes
    `Pick<>`; `passwordHash`/`inviteCode` never leave the driver) — ADR-004.
- **Phase 5 — architecture:** `CohortDashboardPage.tsx` 1064→243 lines,
  six colocated section modules; 11-test suite green before and after +
  new aggregates spec; 5 ADRs (incl. rejected `common/guards` move).
- **Phase 6 — deploy/docs:** Vercel security headers (no Cache-Control —
  Vite preset owns caching; overlapping sources had ambiguous merge),
  baselines refresh, `troubleshooting.md` (auth-cookie field guide),
  `CONTRIBUTING.md`, failure-table additions (403-guard, 408-timeout).

## 3. Council second-opinion (3 parallel reviewers) — dispositions

All findings triaged; every valid one fixed and re-verified above.

| #   | Finding                                                                      | Disposition                                                                                                                                          |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Origin: null` (opaque-origin frame) passed the guard                        | **Fixed:** `null` is now a fail-closed sentinel (never in allow-list) + 2 specs                                                                      |
| 2   | Guard lowercases/strips but `main.ts` CORS was trim-only                     | **Fixed:** shared `config/cors-origins.ts` parser used by both                                                                                       |
| 3   | `OAUTH_TIMEOUT_MS` had no upper bound (bound neuterable)                     | **Fixed:** 120s clamp in guard + prod boot rejection + specs                                                                                         |
| 4   | Assignment section branched on error-object truthiness, not `isError`        | **Fixed:** explicit `assignmentsFailed`/`progressFailed` boolean props                                                                               |
| 5   | `vercel.json` overlapping `Cache-Control` (`immutable` vs `must-revalidate`) | **Fixed:** dropped both; Vite preset owns caching (merge precedence undocumented)                                                                    |
| 6   | Scanner missed `sk-ant-`, `ghu_/ghs_/ghr_`, `npm_`, `xox[cdoe]`, PGP         | **Fixed:** patterns added; negative probe verified                                                                                                   |
| 7   | Line-allowlist (`example`, `test`, `...`) could hide a real secret           | **Fixed:** allowlist narrowed to structural markers; header comment corrected                                                                        |
| 8   | Troubleshooting claimed `*.spec.*`/docs exclusions that don't exist          | **Fixed:** §6 rewritten to actual behavior (no file exclusions)                                                                                      |
| 9   | Dependabot `day: Monday` (capitalized, schema wants lowercase)               | **Fixed:** `monday`                                                                                                                                  |
| 10  | CI lacked `timeout-minutes`; scan/audit ran after install                    | **Fixed:** 20min cap; both moved pre-install (fail fast, no deps needed)                                                                             |
| 11  | `filteredProgress!` non-null assertion fragile on reuse                      | **Fixed:** `(filteredProgress ?? [])`, behavior identical                                                                                            |
| 12  | E2E delivery assertions assumed single-tick flush                            | **Fixed:** bounded `waitForDelivery` polling (absence case keeps one flush)                                                                          |
| 13  | Weak aggregate specs (locale-sensitive date, no zero-total, no 5-cap)        | **Fixed:** zero-total + 7-attempt cap cases added                                                                                                    |
| 14  | Suggested pre-intersection canvas-absence assertion                          | **Rejected with evidence:** canvas renders unconditionally (`ShaderBackdrop.tsx:122-131`); gating is GL-init, not DOM — the assertion would be wrong |
| 15  | Suggested eslint test-block globals "replace" base globals                   | **Rejected with evidence:** flat-config `languageOptions.globals` merge across configs; base browser/node globals intact                             |
| 16  | Minor (DB-dummy regex, queryHooks method assertions, `total:0` note)         | Accepted as documented non-issues; no change                                                                                                         |

## 4. Residual risks and manual steps (not code-fixable here)

1. **Render/Vercel dashboard values + redeploy** (P0): `COOKIE_SAMESITE=none`,
   origin-only `VITE_API_BASE_URL` on Vercel, then redeploy both. Code is
   ready; config is unverified from here.
2. **DevTools cookie-jar check**: confirm `refresh_token` stored under
   `https://anatomiax-api.onrender.com` after login (procedure in
   `troubleshooting.md` §1).
3. **Local `frontend/web/.env`** must be `http://localhost:3000` for daily dev.
4. **Playwright real-cookie flow** remains mocked-API; a live two-origin
   cookie test is still the missing end-to-end proof for the auth saga.
5. **Dependabot schedules are untested** until the first weekly run lands PRs.
6. **Vercel headers** apply on next deploy; verify response headers live
   (especially that `/assets/*` stay immutable via the preset).

## 5. Commit guidance (not executed — no commit per instructions)

Suggested split when the user asks: (1) lint foundation + CI;
(2) coverage thresholds + tests; (3) security gates + docs;
(4) auth/CSRF/OAuth/select P0s + ADRs 001–004; (5) dashboard split +
ADR-005; (6) deploy/docs (vercel, troubleshooting, contributing);
(7) council fixes + this report. Each split keeps gates green
independently (verified incrementally throughout).

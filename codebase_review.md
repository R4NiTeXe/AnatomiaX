# AnatomiaX — ECC-Grounded Codebase Review

**Score: 92 / 100 — Grade A** (scale taken from the vendored `security-scan` skill: A = 90–100).
**Method:** 13 of 18 vendored ECC skills read in full for this review; every scored claim below carries fresh evidence re-verified against the current tree (nothing cited from memory). Honest skill-fidelity notes in §5 — including skills that did _not_ apply.

## 1. Scorecard

| #   | Category (driving skills)                                                          | Wt      | Score    | Key evidence                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Architecture & monorepo (`coding-standards`, `context-budget`)                     | 10      | **9.5**  | Boundaries enforced (`medical-data/`, `3d-assets/` isolated); workspaces clean; −0.5 no one-command onboarding (`docker-compose.yml` absent, verified by glob)                                                                                                    |
| 2   | Backend API & security (`security-review` checklist §2)                            | 20      | **18.5** | Argon2id, rotation + reuse-revokes-family, hashed-at-rest, `OriginCheckGuard`, whitelist pipe, error envelope, fail-fast env; −1 no CSP; −0.5 audit remainder needs breaking upgrades                                                                             |
| 3   | Database & migrations (`prisma-patterns`, `postgres-patterns`)                     | 10      | **9.5**  | 5 migrations, `[role, deletedAt]`/perf indexes, P2002→409/P2025→404 mapping, `migrate deploy` gate, DTO mapping; −0.5 soft-delete filtered manually (no client extension)                                                                                         |
| 4   | Frontend web, 3D + UI (`frontend-a11y`, `react-testing` in part)                   | 15      | **14.0** | R3F/GSAP pipeline, TanStack Query keys, reduced-motion support, aria-labels on icon actions; −0.5 no axe tests; −0.5 3D layer-toggle screen-reader announcements                                                                                                  |
| 5   | Admin dashboard (`coding-standards`)                                               | 10      | **9.5**  | Next.js 15 App Router, column-narrowed reads, DTO mapping; −0.5 no retention/progression analytics                                                                                                                                                                |
| 6   | Medical data & assets (`documentation-lookup` provenance rule)                     | 10      | **9.5**  | `SOURCES.md` provenance, decoupled GLBs, asset-contract gate green; −0.5 no JSON/Zod validation for `medical-data/`                                                                                                                                               |
| 7   | Testing & QA (`tdd-workflow`, `react-testing`, `e2e-testing`, `verification-loop`) | 15      | **12.5** | 547+57+61+276 green, 80% gates in all four configs, RED-before-GREEN practiced; −1 E2E is mocked-API (no real-cookie flow); −0.5 no TDD evidence-report artifacts; −0.5 one transient flake in ~4 full runs; −0.5 admin typecheck miss (fixed, checklist updated) |
| 8   | DevOps & CI (`git-workflow`, `verification-loop`, `security-review` §10)           | 10      | **9.0**  | 18-step CI (scan/audit/lint/typecheck/coverage/builds/migration/readiness/assets/perf/E2E), lockfile + `npm ci`, Dependabot configured; −0.5 first Dependabot run untested; −0.5 Render/Vercel live values still pending verification                             |
|     | **TOTAL**                                                                          | **100** | **92.0** |                                                                                                                                                                                                                                                                   |

## 2. Verification-loop six phases (fresh, this tree)

| Phase    | Command / evidence                                                                                                                                                                                                                                              | Result                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Build    | web prod build (`VITE_API_BASE_URL` origin) + `nest build`                                                                                                                                                                                                      | PASS (bundle: origin 1×, `localhost:3000` 0×)                                                           |
| Types    | `npm run typecheck --workspaces --if-present` (the exact CI command)                                                                                                                                                                                            | PASS all workspaces (after fixing 3 admin test-typing errors this session)                              |
| Lint     | `npm run lint` (`--max-warnings 0`) + `format:check`                                                                                                                                                                                                            | PASS, zero warnings                                                                                     |
| Tests    | web 547/547 (70 suites) · admin 57/57 (6) · core 61/61 (10) · api 276/276 (25); Playwright 17/17 (after fixing a CI-only GLB-fixture gap: fresh clones lack gitignored `models-dev/`, fixed via `scripts/populate-dev-assets.js`; RED→GREEN reproduced locally) | PASS, 80% gates enforced                                                                                |
| Security | `security-grep.js` 522 tracked files + `npm audit` (0 critical) + git-history scan                                                                                                                                                                              | PASS (history holds only an empty `.env.example` value and truncated `MIIE...` fixtures — no real keys) |
| Diff     | `git status` clean at scoring time; `git log` conventional (`feat:`/`test:`)                                                                                                                                                                                    | PASS, nothing uncommitted                                                                               |

## 3. Pre-deployment checklist (`security-review` §verbatim, mapped)

PASS: secrets-in-env, whitelist validation, parameterized ORM (sole `$queryRaw` is a constant `SELECT 1` ping), httpOnly+Secure cookies, RBAC backend-enforced, rate limits on all auth routes, HTTPS/prod-origin validation, error envelope, no secret logging, `npm ci` + lockfile, Dependabot, CORS allow-list.
**Reasoned deviations (documented, not waived):** `SameSite=None` (cross-site split _requires_ it; `OriginCheckGuard` compensates — ADR-001); origin-check instead of CSRF tokens (ADR-001); testids over `getByRole` (3D-canvas UI isn't role-queryable).
**Genuine gaps (priced into the score):** no CSP header; audit remainder (4 low/18 moderate/15 high) needs breaking upgrades; no axe coverage.

## 4. Deduction ledger (the 8 points)

-1.0 no CSP · −1.0 mocked-API E2E (no live two-origin cookie proof) · −0.5 audit remainder · −0.5 no TDD evidence artifacts/checkpoint commits (practice followed, artifacts absent) · −0.5 transient flake · −0.5 typecheck-miss process gap (fixed) · −0.5 no axe · −0.5 3D SR announcements · −0.5 manual soft-delete filtering · −0.5 admin analytics depth · −0.5 medical-data schema validation · −0.5 Dependabot first run untested · −0.5 live deploy values pending · −0.5 no compose onboarding.

## 5. Skill-fidelity notes (what was honestly _not_ used)

- `security-scan` (AgentShield for `.claude/` configs): **not applicable** — no `.claude/` dir exists, never ran; our scanning is custom secret-grep + audit, driven by `security-review` + `verification-loop` Phase 5.
- `council`: used **in spirit, not letter** — the skill reserves itself for decisions and lists code review as an anti-pattern; our Phase 7 ran three independent adversarial reviewers with visible dissent synthesis, which is closer to its `santa-method` cousin. Recorded here so the claim stays checkable.
- `security-review` Supabase/Solana/file-upload sections, `tdd-workflow` Bun/Supabase snippets, `react-testing` vitest/MSW lanes, `postgres-patterns` RLS/GIN lanes: **not applicable** to this stack (NestJS+Prisma, Jest, no uploads, no chain).
- `seo` vitals and `e2e-testing` POM/trace lanes: **unmeasured**, so unscored (no deduction for unmeasured items).
- Vendored skills themselves violate `context-budget`'s >400-line flag (e.g. `git-workflow` 527 lines) — third-party content, out of our control, no deduction.

## 6. Staleness fixed during this review

- `skills/README.md` command mapping quoted pre-phase baselines (web 443·admin 10·core 37·api 226, "no lint script") → corrected to 547·57·61·276 + `npm run lint`.
- A prior external review's figures (257 tests, 4 migrations, 12-step CI, "Next.js 14" title) were audited against the tree and superseded by §1–§2 above.

## 7. Path to 95+

1. Add CSP (nonce/hash-based for Vite inline chunks) — recovers §2's full point.
2. Live two-origin Playwright cookie flow (real Render/Vercel round-trip) — recovers §7's point and closes the auth-saga proof gap.
3. `migrate deploy` already gated; add Prisma Client soft-delete extension — recovers §3.
4. Dependabot first-run green + verify live response headers post-deploy — recovers §8.
5. Keep TDD evidence lightweight: one `docs/releases/*.tdd.md`-style note per behavior change (RED log + GREEN log) instead of full ceremony.

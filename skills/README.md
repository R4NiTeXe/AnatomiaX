# AnatomiaX Skills

Curated, repo-owned playbooks: **what** to enforce and **how** to do it, per area.
Consult the matching skill **before** starting work in its area; follow it
during implementation and review.

## Provenance

Adapted verbatim from [ECC](https://github.com/affaan-m/ECC) (`affaan-m/ECC`,
v2.2.2, MIT-licensed) — 18 of 292 skills selected for this stack
(React 18 + Vite + TanStack Query + NestJS + Prisma + PostgreSQL + Jest +
Playwright + Vercel/Render). Verbatim keeps fidelity with upstream; this index
(and root `AGENTS.md`) carries the AnatomiaX-specific mappings. Only what is
listed below is adopted — the rest of ECC's catalog was evaluated and
declined as inapplicable (other languages, business ops, homelab, blockchain,
Docker, Redis, manufacturing QA).

## Index

### Bug-free

| Skill                  | Why here                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- |
| `tdd-workflow/`        | RED-first discipline + 80% coverage gates (adopt the gates; see project commands) |
| `e2e-testing/`         | Playwright POM/config/flaky-triage/report rules for `e2e/`                        |
| `react-testing/`       | `userEvent`, role-first queries, `axe` — the standard new tests must meet         |
| `verification-loop/`   | build → types → lint → tests → security-grep → diff-report before every PR        |
| `contract-first/`      | Future OpenAPI artifact + generated shared API types (web/admin)                  |
| `error-handling/`      | Typed errors, retry/backoff, user-message map (extends `ApiError`/boundary)       |
| `database-migrations/` | Expand-contract discipline for `backend/api/prisma/migrations/`                   |

### Clean & organized

| Skill                                                                       | Why here                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `coding-standards/`                                                         | Naming, no-`any`, no-magic-numbers, ≤50-line functions                                            |
| `git-workflow/`                                                             | Conventional commits, branching, PR gates                                                         |
| `frontend-a11y/`                                                            | Labels, keyboard maps, live regions, reduced-motion (extends `e2e/a11y.spec.ts`)                  |
| `scientific-thinking-literature-review/` + `scientific-db-pubmed-database/` | Evidence-graded validation of `medical-data/` content against trusted sources (project hard rule) |
| `seo/`                                                                      | Marketing site (`frontend/marketing/`): sitemap, canonical, metadata                              |

### Optimized & faster

| Skill                                     | Why here                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `prisma-patterns/` + `postgres-patterns/` | Index/select/N+1/cursor rules (extends the perf-index migration)         |
| `react-performance/`                      | Memo/bundle/lazy discipline behind `scripts/check-performance-budget.js` |
| `api-design/`                             | Status semantics, pagination, rate-limit headers                         |
| `deployment-patterns/`                    | Health probes, twelve-factor config, rollback readiness (Render/Vercel)  |

### Security & process

| Skill                       | Why here                                                                  |
| --------------------------- | ------------------------------------------------------------------------- |
| `security-review/`          | Auth/input/secrets/API checklist for every auth-touching change           |
| `security-scan`             | Secret + supply-chain scanning (pairs with `npm audit` in CI)             |
| `council/`                  | Second-opinion review for high-risk changes (auth, migrations, contracts) |
| `team-agent-orchestration/` | Parallel exploration pattern for audits spanning backend/frontend/infra   |
| `context-budget/`           | Token/context discipline for large sessions and asset-heavy areas         |
| `documentation-lookup/`     | Vendor-docs lookup backing the research-reuse rule                        |

## Project command mappings

ECC skills reference generic runners (`npm test`, `bun test`, `pytest`). In this
repo, translate to:

| ECC says             | AnatomiaX equivalent                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` (unit)    | `npm run test --workspaces --if-present` (web 443 · admin 10 · core 37 · api 226)                                                                  |
| e2e run              | `npx playwright test` (17 specs, dev server auto-started)                                                                                          |
| typecheck            | `npm run typecheck --workspaces --if-present`                                                                                                      |
| format               | `npm run format:check` (Prettier; no `lint` script — see `coding-standards`)                                                                       |
| DB migrate (prod)    | `npx prisma migrate deploy --schema backend/api/prisma/schema.prisma`                                                                              |
| readiness/perf gates | `node scripts/check-production-readiness.js --check-builds`, `node scripts/check-performance-budget.js`, `node scripts/check-prisma-migrations.js` |

## Maintenance

- Adding a skill: copy the `SKILL.md` dir verbatim from upstream, add one row
  above with the AnatomiaX-specific reason. Never silently edit vendored files;
  project deviations go in this index or root `AGENTS.md`.
- Review this set quarterly; drop skills that stop matching the stack.

## Recorded deviations

- `scripts/security-grep.js` exempts `skills/**` from the
  database-credentials check only: vendored playbooks (e.g.
  `prisma-patterns/SKILL.md`) contain third-party DB-URL documentation
  fixtures (`postgresql://user:pass@host/...`) that we must not rewrite.
  Key-shape patterns and tracked-file rules still scan `skills/**`, so a
  real key pasted into a playbook still fails the gate.

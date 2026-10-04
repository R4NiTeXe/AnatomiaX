# ADR-010: Physical Domain Migration (Phase 5)

Status: accepted (explicitly authorized reorganization; supersedes the
no-move stance of ADR-008 for layout only — ADR-008's duplication and
circularity prohibitions still bind).

## Why

Discoverability: a new production developer can now locate any
capability by browsing `modules/<domain>` or `features/<domain>`.
Previous layout was logically domain-separated but physically flat
(backend) and route-scattered (web).

## What moved (real files only, no empty scaffolding)

- Backend `src/<domain>/` → `src/modules/<domain>/` (9 domains);
  `common/*` → `common/{decorators,guards,filters,interceptors,
exceptions}/`; specs → `tests/` per domain or `common/tests/`
  (cross-domain contract specs); `web-app-url` stays auth-local
  (imported by auth delivery code — moving it to `config/` would split
  it from its only consumers for no gain).
- Web `components/auth|lib/authRedirect|auth pages` →
  `features/auth/`; quiz/cohort/progress/anatomy verticals →
  `features/*`. Session core, shared UI, cross-domain hooks/tests, and
  the `pages/` route manifest stay put.
- Admin app untouched (App Router colocation is already its feature
  structure).

## What was deliberately NOT created

- `modules/students|teachers|anatomy`, `features/student|teacher|
notifications`, `common/{pipes,middleware,types,utils}` — no code is
  exclusive to those scopes; empty folders are fake architecture.
- `database/` split — `prisma/` stays whole per Prisma tooling.
- New path aliases — Nest runtime cannot resolve `tsc` paths without
  extra tooling; relative imports kept.
- Barrel exports — direct imports preserved (no cycles, no hidden deps).

## Verification performed per domain

`tsc` + affected unit/integration suites after every move; full suites,
builds, lint, format, secret scan, and E2E at phase end. Baseline
(api 328, admin 64, web 554, core 61, pw 17) preserved exactly.

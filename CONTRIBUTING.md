# Contributing to AnatomiaX

## Structure

- `frontend/web`, `frontend/admin` — apps. `frontend/packages/*` — shared
  frontend code. `backend/api` — NestJS API. `medical-data/` — medical
  content (never invent anatomy facts; validate against trusted sources).
  `3d-assets/` — large 3D assets, kept optimized. `skills/` — vendored
  playbooks (do not edit silently; record deviations in `skills/README.md`).

## Before you start

Consult the matching skill in `skills/` for the area you are touching and
follow it during implementation and review.

## Gates (all must pass before reporting completion)

```bash
npm run format:check          # Prettier
npm run lint                  # ESLint, zero warnings
npm run typecheck --workspaces --if-present
# Jest; the 80% coverage gates are enforced by CI, which appends
# `-- --coverage` — reproduce locally per workspace, e.g.:
# npm run test -w @anatomiax/web -- --coverage --coverageReporters=text
npm test --workspaces --if-present
node scripts/security-grep.js # fail-closed secret scan
npm audit --audit-level=critical
```

Targeted runs are fine while iterating; run the affected workspace suite
fully before finishing.

## Conventions

- TypeScript everywhere appropriate; Prettier formatting (`npm run format`).
- Test-first for behavior changes: write the failing test, then the fix.
  Regression tests pin security behavior (auth rotation/reuse, CSRF 403,
  select narrowing, timeouts) — do not weaken them to make a suite pass.
- Never commit API keys or passwords; no secrets in `VITE_*` /
  `NEXT_PUBLIC_*`; no fake medical information.
- Backend list queries select only rendered columns (ADR-004); new admin
  reads need an explicit `select`, never full rows.
- Cookie-credentialed mutations go through `OriginCheckGuard` (ADR-001);
  new cookie-authenticated routes must opt in.
- One simple commit per completed piece of work, Conventional Commits
  (`feat:`, `fix:`, `refactor:` …), lowercase type, no vague messages.
- Do not change unrelated files. Verify folder structure and package
  configuration after changes.

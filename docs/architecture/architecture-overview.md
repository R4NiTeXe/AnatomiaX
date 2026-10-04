# Architecture Overview (post–Phase 5)

Modular monolith (NestJS API + React SPA + Next.js admin), organized by
business domain on the backend and by feature vertical on the web
frontend. Role-specific backend modules intentionally do not exist:
roles cut across domains via guards + service ownership checks, so
`students/` / `teachers/` backend modules would duplicate logic (see
ADR-008, ADR-010).

## Backend (`backend/api/src/`)

- `modules/<domain>/` — one directory per business domain (admins,
  audit, auth, cohorts, health, notifications, progress, quizzes,
  users), each with its module/controller/service/DTOs and a `tests/`
  directory. No cross-domain business imports outside the allowed
  edges (`npm run boundaries` enforces).
- `common/{decorators,guards,filters,interceptors,exceptions}/` —
  cross-cutting infrastructure only. `common/tests/` holds
  cross-domain contract specs (no single owning domain).
- `config/` — env validation, CORS/origin parsing, app URL. `prisma/`
  — schema, migrations, client infrastructure (kept together by
  Prisma tooling requirements). `main.ts` + `app.module.ts` —
  composition roots.

## Frontend web (`frontend/web/src/`, Vite SPA, react-router)

- `features/<domain>/` — vertical slices (`auth`, `cohorts`,
  `progress`, `quizzes`, `anatomy`), each with `components/`,
  `pages/`, `hooks/`, `api/`, `tests/` as actually used. No
  `features/student|teacher|notifications`: no code is exclusive to
  those scopes (documented, not omitted by accident).
- `components/{ui,layout,motion,animation,effects}/` + `lib/api.ts`,
  `lib/auth.ts` — shared infrastructure anything may use.
- `pages/` — remaining route manifest (account, cohorts entry points
  live with their features; public pages stay).

## Admin (`frontend/admin/`, Next.js App Router)

Route-colocated by framework convention (`app/users`, `app/cohorts`,
`app/quizzes`, `app/audit-logs`); no `features/` split — that would
scatter route-adjacent code for no boundary gain.

## Data

PostgreSQL + Prisma. Schema/migrations under `backend/api/prisma/`.
`medical-data/` (content) and `3d-assets/` (meshes) stay outside all
source trees; production GLBs come from the external static host.

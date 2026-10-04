# Role Experience Architecture (Student / Teacher / Admin)

Companion to ADR-008 (domain verdict) and ADR-009 (role decisions).
Backend layout is unchanged (domain modules); this documents the
role-facing composition.

## System overview

- Web SPA (`frontend/web`, React Router): public content + authenticated
  student/teacher journeys. Auth memory tokens, httpOnly cookie refresh.
- Admin app (`frontend/admin`, Next.js App Router): ADMIN-only
  operations behind `AdminShell` + backend `@Roles('ADMIN')`.
- API (`backend/api`, NestJS modular monolith): domains own their
  authorization (guards + service checks); roles cut across domains.

## Backend module map

| Module          | Owns                                                                                                              | Depends on                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `auth`          | registration, login (+requested-role check), refresh/rotation, logout, OAuth, reset, change, guards, cookie flags | `users`, `common`                   |
| `users`         | identity, live lookups, OAuth link, safe views                                                                    | `prisma`                            |
| `cohorts`       | membership, assignments, viewer/manager gates                                                                     | `auth`, `users`                     |
| `progress`      | studied merge, free-form attempts, snapshots                                                                      | `auth`, `users`                     |
| `quizzes`       | bank CRUD, publish/archive, grading, attempts, stats                                                              | `auth`, `users`, `cohorts`, `audit` |
| `notifications` | subscriptions, FCM sender abstraction                                                                             | `auth`, `users`                     |
| `admin`         | overview, lists, user lifecycle, audit reads                                                                      | `auth`, `users`, `audit`            |
| `audit`         | ledger writer (sanitized), no read UI of its own                                                                  | `prisma`                            |
| `common`        | filter, interceptors, error contract, guards infra                                                                | nothing domain                      |
| `config`        | env validation, CORS/origin parsing                                                                               | nothing domain                      |
| `prisma`        | client infrastructure only                                                                                        | nothing                             |

No cycles: `quizzes → cohorts` one-way; `admin/audit` are sinks except
`quizzes,admin → audit` (writer only).

## Frontend map

- Web `pages/`: public + `RequireAuth` routes; `RequireRole` for
  `/teach/*` (UX gate; API re-authorizes). `SiteNav` shows role links
  (Quizzes when authed; Teach for TEACHER/ADMIN).
- Web `lib/`: `auth` (session, forced credentials), `quizzes`,
  `cohorts`, `progress` clients — single `fetch` choke point.
- Admin `app/`: overview, users (+`[id]` lifecycle), cohorts,
  quizzes (+`[id]` lifecycle/stats), audit-logs. `hooks/useAdmin*` +
  `lib/*` clients; shell gates ADMIN.
- Contracts: `@anatomiax/shared-types` for new web quiz code; admin
  keeps local copies (no new workspace wiring — ADR-008).

## Role/permission matrix (current)

| Capability                          | STUDENT | TEACHER    | ADMIN  |
| ----------------------------------- | ------- | ---------- | ------ |
| Login (+role tab) / Google / logout | ✅      | ✅         | ✅     |
| Own profile/progress/attempts       | ✅      | ✅         | ✅     |
| Take published quizzes, own results | ✅      | ✅         | ✅     |
| Cohorts: member views               | ✅ own  | ✅ managed | ✅ all |
| Cohorts: create/manage              | ❌      | ✅ own     | ✅ all |
| Quiz authoring (own)                | ❌      | ✅ own     | ✅ all |
| Teacher cohort-scoped results       | ❌      | ✅ managed | ✅ all |
| Admin users/roles/lifecycle         | ❌      | ❌         | ✅     |
| Admin audit logs                    | ❌      | ❌         | ✅     |
| Admin quiz lifecycle                | ❌      | own only   | ✅ all |
| Role provisioning/self-promotion    | ❌      | ❌         | ✅/❌  |

## Authentication flow (incl. role selection)

1. Login UI tabs select a _requested_ role → `POST /login {email,
password, role?}` → backend compares against the DB role; mismatch
   → generic 401, no session, no cookie.
2. Success returns the DB-role session → frontend routes by returned
   role (`/human`, `/cohorts`, `/account`), explicit `?next=` wins.
3. OAuth carries no requested role; the restored DB-role session routes
   identically. Registration stays STUDENT-only (no role field).

## Quiz architecture

Bank (`Quiz`/`QuizQuestion`) → publish gate (≥1 question) → student
submit (selected indexes only) → server grades → attempt + immutable
snapshot → own-result correctness. Published questions immutable;
archive freezes; delete nulls links (history survives). Answer key
leaves the server only for managers.

## Deployment

Unchanged: Vercel SPA + admin + Render API + external static asset
host. New migration (`20261003000000`) deploys via `migrate deploy`
(staging first). No new env vars required (SMTP mandate is
validation-only on existing vars).

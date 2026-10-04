# Backend Module Architecture

## Domains (`src/modules/`)

| Module          | Owns                                                                                                                                                                                                                    | Key files                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `auth`          | registration, login (+requested-role check), refresh/rotation, logout, Google OAuth, reset, change, session cookies, auth-specific guards (`JwtAuthGuard`, `GoogleAuthGuard`, `OriginCheckGuard`), strategies, delivery | controller/service/module, `dto/`, `tests/` (8 specs)   |
| `users`         | identity, live lookups, OAuth link, safe views                                                                                                                                                                          | service/module, `safe-user.ts`                          |
| `cohorts`       | membership, assignments, invites, viewer/manager gates                                                                                                                                                                  | controller/service/module, `dto/`, `tests/`             |
| `progress`      | studied merge, free-form attempts, snapshots                                                                                                                                                                            | controller/service/module, `dto/`, `tests/`             |
| `quizzes`       | bank CRUD, publish/archive, grading, attempts, stats                                                                                                                                                                    | controller/service/module, `dto/`, `tests/`             |
| `notifications` | subscriptions, FCM sender abstraction                                                                                                                                                                                   | controller/service/module, `dto/`, `senders/`, `tests/` |
| `audit`         | ledger writer (sanitized), no read UI of its own                                                                                                                                                                        | service/module, `tests/`                                |
| `admins`        | overview, lists, user lifecycle, audit reads                                                                                                                                                                            | controller/service/module, `dto/`, `tests/`             |
| `health`        | liveness/readiness probes (public)                                                                                                                                                                                      | controller/service/module, `tests/`                     |

Deliberately absent: `students/`, `teachers/` (no backend logic is
role-exclusive), `anatomy/` (no backend anatomy endpoints exist —
anatomy is a frontend + asset-pipeline domain).

## Shared layers

- `common/decorators` (`Roles`, `CurrentUser`), `common/guards`
  (`RolesGuard` only — `JwtAuthGuard` stays in `auth/` because it
  injects `UsersService`; moving it would couple `common` to a
  business module), `common/filters`, `common/interceptors`,
  `common/exceptions` (error contract + Prisma mapping),
  `common/tests` (cross-domain contract specs).
- `config/` (validation, CORS, origins, app URL), `prisma/`
  (client + schema + migrations), `main.ts` (bootstrap + CORS
  application order), `app.module.ts` (composition).

## Dependency edges (enforced by `npm run boundaries`)

Sinks: `common`, `config`, `database`. `auth → users`.
`cohorts/progress/notifications → auth, users`. `quizzes → cohorts,
audit` (plus auth/users). `admins → users, audit`. `health → auth`
solely for the shared `ThrottlerModule` instance (documented
exception — re-importing would fork rate-limit storage). No cycles;
type-only imports are exempt (erased at runtime).

# Frontend Feature Architecture

## Web (`frontend/web/src/`, Vite + react-router)

Feature verticals under `features/` (each: only the subdirs it really
uses — no empty scaffolding):

- `auth/` — `components/` (provider, guards, buttons, layouts),
  `pages/` (login/register/forgot/reset/callback), `tests/`,
  `authRedirect.ts`. Session core (`lib/auth.ts`, `lib/api.ts`) stays
  shared: ~30 importers, zero cohesion gain from moving.
- `quizzes/` — `api.ts`, `hooks/`, `pages/` (list/take/teach list/teach
  detail), `tests/`.
- `cohorts/` — `api.ts`, `analytics.ts`, `hooks/`, `pages/`,
  `components/dashboard/`, `tests/`.
- `progress/` — `api.ts`, `hooks/`, `pages/` (learn, module),
  `components/` (learning UI), `tests/`.
- `anatomy/` — `components/` (viewer + panels, ~25 files), `pages/`
  (human, human-test), `humanLink.ts`, `tests/`.

Shared (never feature-scoped): `components/{ui,layout,motion,animation,
effects}/`, `lib/{api,auth,env,utils,…}`, `hooks/` (cross-domain query
keys), `pages/` (remaining route manifest: account, home, cohorts entry
points live beside their features), `e2e/` (route/testid contract,
unaffected by file locations).

Deliberately absent: `features/student|teacher|notifications` — no code
is exclusive to those scopes (student UI is the default experience;
teacher UI lives inside `quizzes/`; no notification UI exists).

## Admin (`frontend/admin/`, Next.js)

App Router colocation is the feature structure (`app/users`,
`app/cohorts`, `app/quizzes`, `app/audit-logs` + shared `components/`,
`hooks/`, `lib/`). No `features/` split: it would scatter
route-adjacent code against framework convention for no boundary gain.

## Import rules

- Cross-directory imports use `@/` (immune to moves); sibling `./`
  imports stay inside moved subtrees.
- Tests that read source files via `fs` assert on feature paths
  (location-coupled by design — they pin the architecture).
- No new path aliases were introduced (Nest runtime cannot resolve
  `tsc` paths without extra tooling; Vite `@/` already existed).

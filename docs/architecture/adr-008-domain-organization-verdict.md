# ADR-008: Domain Organization Verdict (Phase 4 Audit)

Status: accepted.

## Audit outcome

The requested `backend/api/src/modules/*` nesting plus `students/`,
`teachers/`, `admins/` splits and the `common/*` reshuffle were
evaluated against the repo's own rules (no duplication, dependency-reason
moves only, no circular dependencies) and **rejected as specified**:

- Backend `src/` is already domain-organized (`auth`, `users`,
  `cohorts`, `progress`, `quizzes`, `notifications`, `admin`, `audit`,
  `health`; `common` holds only cross-cutting filter/interceptors).
- There is no student-specific, teacher-specific, or admin-specific
  backend logic to house: roles cut _across_ domains via guards
  (`JwtAuthGuard`, `RolesGuard`, `OriginCheckGuard`) plus service-level
  ownership checks (`requireViewer`/`requireManager`, hardcoded
  `userId` scoping). Splitting these into role modules would duplicate
  user/auth logic and couple every domain to three role facades.
- Moving `common/*` into `common/{decorators,filters,…}` renames ~40
  import sites for zero dependency gain.
- Same for frontend: `frontend/web` flat `pages/` + feature-colocated
  `components/cohorts/dashboard/` plus `hooks/` + `lib/` is framework
  idiomatic; a wholesale `features/*` migration churns ~100 files with
  no boundary improvement. `frontend/admin` App Router layout stays.

## What changes instead (dependency-reasoned only)

1. Login role-selection: `role` added to the login contract (backend
   compares against the DB role, rejects mismatch with no session);
   role tabs in web login UI; role-aware default post-login routing.
   Google OAuth unchanged — DB role is already authoritative there.
2. Missing role surfaces (all additive, existing conventions):
   web student Quizzes (list/take/results) and teacher quiz authoring;
   admin quiz/question-bank pages and Teachers/Students filtered views.
3. `frontend/packages/shared-types` (already a web dependency) gains API
   contract types (auth, cohorts, quizzes, audit, admin, envelope);
   new code consumes them. Admin does not depend on the package today —
   wiring a new workspace dependency for existing local types is
   deferred (documented, not done).
4. No `modules/` wrapper, no role-split backend modules, no `common/`
   reshuffle, no repository abstraction, no CQRS — modular monolith
   stands, matching the existing architecture.

## Dependency rules (enforced by construction, verified by `tsc` + suites)

- Feature code depends on `lib/` + `hooks/`; never the reverse.
- `quizzes` domain depends on `cohorts` (manager checks) and `audit`
  (ledger); `cohorts` never depends on `quizzes`.
- `admin` domain depends on `users` + `audit`; never on web frontend.
- Guards stay in `auth/`; shared HTTP/error primitives stay in
  `common/` and `lib/`; no business logic in generic UI.

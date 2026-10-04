# ADR-009: Role Experiences (Login Tabs, Routing, Quiz Surfaces)

Status: accepted.

## Login role selection

The login UI offers Student/Teacher/Admin tabs, but the selection is
advisory: `POST /api/v1/auth/login` accepts optional `role`, compares it
against the database role, and rejects mismatches with the generic
credential error — no session, no oracle, no escalation. Registration
stays STUDENT-only (DTO has no role field). Google OAuth carries no
requested role; the DB role is authoritative by construction.

## Post-auth routing

Explicit destinations (`?next=`, login `from` state) always win. Fallback
is role-based: STUDENT → `/human`, TEACHER → `/cohorts`, ADMIN →
`/account` (role administration lives in the separate admin app, not the
SPA). OAuth callback uses the same rule on the restored session.

## Quiz surfaces (no duplication)

- Students take bank quizzes in the web SPA (`/quizzes`, `/quizzes/:id`);
  grading stays server-side, the answer key never reaches these views.
- Teachers author in the web SPA (`/teach/*`, `RequireRole` UX gate —
  every call re-authorized server-side).
- Admins manage lifecycle/stats in the admin app (`/quizzes`,
  `/quizzes/:id`); question add/delete is shared API behavior, not
  shared components (separate apps, separate shells).
- Static-content quizzes (AnatomyQuiz) are untouched; legacy
  free-form attempts keep working.

## Dashboards and notifications

No separate dashboard pages: `LearnPage` (progress hub), `CohortsPage`,
and `AccountPage` already serve per-role content with server-side
scoping; duplicating them per role would fork maintenance for zero new
authorization. Push subscription UI is deferred (no service-worker/VAPID
infrastructure exists; the subscription API is complete and tested).

## Shared contracts

`@anatomiax/shared-types` (already a web dependency) carries API
contract types; new web quiz code consumes them via aliases. The admin
app keeps local copies — wiring a new workspace dependency plus
transpilation for existing local types was rejected as churn (ADR-008).

# Role Boundaries (Student / Teacher / Admin)

Roles are enforced server-side (guards + service ownership); frontend
gates (`RequireAuth`, `RequireRole`, nav links) are UX only.

## Matrix (code-derived)

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
| Self-promotion / forged roles       | ❌      | ❌         | ✅/❌  |

## Login role selection

Tabs are advisory: `POST /login {…, role?}` compares against the DB
role; mismatch → generic 401, no session, no cookie. Registration has
no role field. OAuth carries no requested role (DB role authoritative).
Post-auth routing: explicit `?next=` wins, else STUDENT → `/human`,
TEACHER → `/cohorts`, ADMIN → `/account`.

## Where role logic lives (no role modules — deliberate)

- `modules/auth`: `RolesGuard`, login role check, `JwtAuthGuard`.
- `modules/cohorts`: `requireViewer` (outsider 404) / `requireManager`
  (owner-or-ADMIN, else 403).
- `modules/quizzes`: owner-or-ADMIN management, teacher cohort scoping
  via `CohortsService`, student own-only reads.
- `modules/admins`: class-level `@Roles('ADMIN')` + last-admin guards.
- Web: `RequireRole` (teach routes), role-aware nav/redirects.

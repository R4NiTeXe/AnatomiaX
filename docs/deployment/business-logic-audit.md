# AnatomiaX Business-Logic Audit — Full Application (2026-10-02)

Method: five parallel evidence audits (auth lifecycle, RBAC/API surface,
DB integrity, frontend role flows, notifications/lifecycle) plus targeted
verification reads of every flagged path. Nothing below is asserted from
code existence alone: each verdict cites files, and each fix is TDD'd
(RED observed) with suite evidence. No secrets printed; no credentials
hard-coded; no gates weakened.

## 1. Complete business logic audit (verdicts)

**A. Existing and correct:** register/login/logout/refresh/OAuth/reset/change
flows incl. rotation, reuse-detection, non-enumeration, fire-and-forget
delivery, argon2id, login-throttle tiers, canonical error envelope;
cohort CRUD + membership + assignments + progress scoping (owner/admin
gates, member 403/outsider 404); quiz submit/list/snapshot user-scoped;
notification subscription CRUD with cross-user 409/404 masking;
admin read-only surface with backend `@Roles('ADMIN')`; export allowlist;
hard-delete cascade; P2002→409/P2025→404 filter mapping; frontend
protected routes, session restore, logout cleanup, loading/error/empty/
expired states per journey; FCM stub/unconfigured/multicast behavior.

**B. Existing but needs improvement (accepted unless fixed below):**
mergeStudied lost-update race (self-healing via full-set resends —
documented limitation, no change); reset double-token window (self-heals
on confirm — no change); soft-delete filter discipline for a state
nothing ever sets (no `deletedAt` writers exist — moot, no change);
member-roster visibility + 403/404 and 409/200 oracles (deliberate
trade-offs — no change); single-layer `requireManager` (pinned by
tests — no change); TEACHER-join downgraded to STUDENT (safe — no
change); 201-vs-200 on action POSTs (cosmetic, clients depend on it —
no change).

**C. Existing but incorrect/insecure (ALL FIXED this audit):**

1. reset-confirm + account-delete cleared the cookie path-only while
   logout/change mirror full flags (edge browsers could retain a live
   `SameSite=None` session cookie) — routed through `clearSession`.
2. `confirmPasswordReset` double-submit: both racers passed `findUnique`
   and reset twice — atomic `updateMany({id, usedAt:null})` claim first,
   loser rolls back with the generic error (mirrors the refresh claim).
3. Push `register` P2002 race → 500/409 broke the documented idempotent
   contract — catch, re-read, same-user update-and-return, other-user 409.
4. Auth hot paths lacked composite indexes (`{userId,revokedAt}`,
   `{userId,usedAt}`) — migration `20261002000000_auth_hot_path_indexes`
   (byte-identical to Prisma's own generated DDL — zero drift).

**D. Partially implemented (completed):** FCM malformed-JSON path
unpinned → unit test added; admin anonymous gate was a dead end → hint
text now directs to main-app sign-in (no test pinned the text).

**E. Completely missing:** none found that is implementable without a
product decision. Every lifecycle gap traces to absent product scope
(see §6), not overlooked implementation.

**F. Needs product decision:** server-side quiz grading (no question
bank exists — scores/answers are client-supplied by architecture);
admin user-lifecycle endpoints + TEACHER/ADMIN provisioning + teacher
approval (nothing in-app can create non-STUDENT roles — DB-only today);
session cap/device list; SMTP-required-in-production; export field set
(push/assignments omitted); login lockout beyond throttles; audit-log
infrastructure (no model exists); teacher content/quiz CRUD (content
is static frontend code by architecture); email-verification flow
(absent by design — accounts are instant-active).

## 2. Existing features

§1-A plus: Google OAuth (state nonce, verified-email gate, safe
link-or-create, timeout, cookie 302 to allow-listed app origin);
GoogleAuth/JWT/Roles/OriginCheck guards; ValidationPipe whitelist;
helmet/cors/cookieParser ordering; React Query gated hooks; admin
overview/users/cohorts lists; cohort dashboard analytics; account
export/delete; quiz history; progress snapshot; studied-keys merge
(capped, deduped); invite codes; archive semantics; soft-delete read
filters on auth/admin paths.

## 3. Partial features

FCM malformed-JSON pin + admin gate hint (both completed this audit).
Remaining partials are §1-B accepted limitations with rationale.

## 4. Incorrect/insecure features

The four §1-C items, all fixed with RED→GREEN specs. Pre-existing
posture issue found but correctly out of scope: none — the RBAC/IDOR
hunt found no missing auth/role/ownership check on any route
(matrix in §6-RBAC below; sole gates are documented single-layer
with test pins).

## 5. Missing features

None implementable without product scope (see §6). Deliberate
absences verified, not assumed: email verification, teacher
approval, role management UI, content/quiz authoring, audit logs,
session device list, account lockout.

## 6. Features requiring product decision

Server-side grading/question bank; admin user lifecycle
(activate/deactivate/delete/roles) + role provisioning path; teacher
approval; session caps; SMTP mandate; export scope; lockout policy;
audit-log model; teacher authoring tools. Each is a scope call with
schema/API/UI consequences — no behavior invented here.

### Real permission matrix (code-derived, `/api` prefix)

| Route group                                        | anon  | STUDENT     | TEACHER     | ADMIN    | Enforcement                                   |
| -------------------------------------------------- | ----- | ----------- | ----------- | -------- | --------------------------------------------- |
| register/login/reset-request                       | allow | allow       | allow       | allow    | public + throttle                             |
| google*/refresh/logout                             | allow | allow       | allow       | allow    | OAuth/OriginCheck guards (no JWT)             |
| me/change/export/delete-account                    | 401   | allow       | allow       | allow    | JwtAuthGuard, self-scoped                     |
| health                                             | allow | allow       | allow       | allow    | throttle only                                 |
| POST cohorts                                       | 401   | 403         | allow       | allow    | Roles(TEACHER,ADMIN)                          |
| cohorts read/join/mine                             | 401   | allow       | allow       | allow    | JWT + membership scoping                      |
| cohort detail/members/assignments                  | 401   | member-only | member-only | all      | requireViewer (outsider 404)                  |
| cohort manage (patch/archive/invite/remove/assign) | 401   | 403         | owner-only  | allow    | requireManager (owner\|\|ADMIN)               |
| cohort progress                                    | 401   | 403*        | owner-only  | allow    | viewer then owner check (*member non-manager) |
| progress quiz/snapshot                             | 401   | own-only    | own-only    | own-only | hardcoded userId scoping                      |
| notification subscriptions                         | 401   | own-only    | own-only    | own-only | userId scoping, 409/404 masking               |
| admin/*                                            | 401   | 403         | 403         | allow    | JwtAuthGuard + Roles(ADMIN)                   |

## 7. Files changed

- `backend/api/src/auth/auth.controller.ts` — clearSession on confirm + delete
- `backend/api/src/auth/auth.controller.spec.ts` — 2 clear-mirror specs
- `backend/api/src/auth/auth.service.ts` — atomic reset claim
- `backend/api/src/auth/auth.service.spec.ts` — double-submit race spec
- `backend/api/src/notifications/notifications.service.ts` — P2002 idempotent catch (+import)
- `backend/api/src/notifications/notifications.service.spec.ts` — 2 race specs
- `backend/api/src/notifications/fcm-notification.sender.spec.ts` — malformed-JSON spec
- `frontend/admin/components/admin-shell.tsx` — gate hint text
- `backend/api/prisma/schema.prisma` + `prisma/migrations/20261002000000_auth_hot_path_indexes/migration.sql` — 2 composite indexes

## 8. Database changes

Schema: `@@index([userId, revokedAt])` on refresh_tokens,
`@@index([userId, usedAt])` on password_reset_tokens; one additive
migration (no table/column/data changes). No other schema changes —
email-reuse-after-soft-delete, RLS-style extensions, and key-row
remodels were evaluated and rejected as out of scope.

## 9. API changes

Behavioral: reset-confirm is now race-safe (loser gets generic 401,
no second reset); push register is race-idempotent; confirm/delete
clear cookies with full flags. No route/method/status/DTO changes —
all existing contracts preserved.

## 10. Frontend changes

One string: admin gate hint. No logic, routing, or styling changes.

## 11. Auth/RBAC changes

No guard/decorator/role changes. Cookie-clearing consistency only;
RBAC matrix verified unchanged (admin boundary, teacher/student
boundaries, IDOR coverage all re-green).

## 12. Tests added/updated

6 backend specs (2 clear-mirror, 1 reset race, 2 push race, 1 FCM
malformed) + 1 migration + 0 test modifications (no test touched to
accommodate changes). Journeys re-covered: student register→logout→
relogin, teacher manage flows, admin lists, Google callback→refresh→
logout, reset request→confirm→relogin (all pre-existing e2e green).

## 13. Test results

api 301/301 (27 suites, +6) · admin 57/57 · web 547/547 · core 61/61 ·
Playwright 17/17 (one transient a11y-worker flake, 2/2 alone, 17/17
on full re-run). Coverage thresholds enforced via suite runs.

## 14. Build results

`nest build` clean · root typecheck all workspaces clean · web/admin
typechecks clean.

## 15. Security check results

`security-grep` PASS (527 tracked files) · `npm audit
--audit-level=critical` PASS (0 critical) · format clean · lint exit 0 ·
migration safety gate PASS · no secrets/tokens in output, logs, or diffs.

## 16. Remaining risks

- Client-graded quizzes: forged histories possible until a question
  bank exists (needs product decision). Teacher-facing analytics
  should be read with this caveat.
- Roles are DB-provisioned only; whoever holds DB access holds role
  assignment — acceptable today, must be revisited if admin UI gains
  user management.
- Fake-DB e2e cannot prove real-Postgres cascade/isolation; schema +
  migration SQL reviewed instead (documented limitation).
- No login lockout: throttles only (product decision for lockout).
- SMTP-unset production silently stubs reset mail (validate-env keeps
  SMTP optional — product decision to mandate).

## 17. Remaining manual QA items

Real Google click-through · physical push receipt · external email
delivery · live-PostgreSQL behaviors · tablet viewport · GitHub-hosted
run · `migrate deploy` of the new index migration against staging
before production (additive, low-risk).

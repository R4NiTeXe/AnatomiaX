# ADR-007: Quiz Bank, Audit Ledger, Admin Lifecycle, SMTP Mandate

Status: accepted (approved product scope, Phase 3).

## Quiz bank over client grading

Scores were client-supplied; teacher analytics could not be authoritative.
New `Quiz`/`QuizQuestion` domain with server-side grading. Deliberate rules:

- Submit DTOs carry selected option indexes only — score/total/correct
  cannot be forged because no such fields exist.
- Unanswered questions count as incorrect (explicit product rule).
- Repeats allowed: every submit is a new attempt row (existing product rule).
- Published questions immutable; new questions may be added; archive
  freezes everything; attempts carry an immutable `questionSnapshot` so
  history never changes meaning; quiz delete nulls the link (SetNull),
  history survives via the legacy listing.
- Answer key (`correctIndex`) leaves the server only for quiz managers
  (owner or ADMIN); student payloads never contain it. Per-question
  correctness appears solely inside a caller's own completed-attempt
  result (result display, not key distribution).
- Non-owner teachers see member rows of cohorts they manage only
  (reuses `CohortsService` ownership — no duplicated RBAC); ADMIN sees all.
- Legacy free-form attempts (`quizId` null) keep working unchanged.

## Audit ledger

`AuditLog` has no FK to `User` (survives account deletion) and stores no
authentication material — enforced by a sanitizer (password/token/secret
key patterns redacted) with unit cover. Writes are fire-and-forget-safe:
an audit failure warns server-side but never breaks the mutation.
Coverage: role changes, de/activation, deletion, quiz lifecycle.

## Admin lifecycle without new account states

`deletedAt` doubles as the deactivation flag (active ↔ deactivated →
hard-deleted); no `suspended`/`disabled` states invented. All auth
reads already exclude non-null `deletedAt`. Registration stays
STUDENT-only (DTO has no role field); roles are ADMIN-provisioned.
Last-administrator removal (demote/deactivate/delete, including
self-inflicted) is rejected — no self-action ban, so every guard stays
reachable and tested.

## SMTP mandate

Production boot now requires `SMTP_HOST` (reset requests promise
delivery); non-production keeps the safe stub. Delivery code, retry
semantics, and non-enumeration behavior unchanged.

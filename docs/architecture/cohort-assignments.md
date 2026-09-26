# Cohort assignments + assignment progress (8.52 / 8.53)

## Authorization rule

- `POST /cohorts/:id/assignments`, `DELETE /cohorts/:id/assignments/:key`:
  cohort manager (owner or ADMIN) on active cohorts only (archived → 403).
- `GET /cohorts/:id/assignments`: any cohort viewer (members included).
- `GET /cohorts/:id/progress`: owner/ADMIN only (members → 403, outsiders → 404);
  archived cohorts keep reads, freeze writes.
- Assignment writes are idempotent (re-assign returns the existing row;
  `@@unique([cohortId, moduleKey])`); unassigning a missing row is 404.

## Analytics calculation

No analytics endpoint and no progress tables. Teacher analytics derive
client-side (`frontend/web/src/lib/cohortAnalytics.ts`) from the two existing
authorized queries (assignments + progress) and the static module registry:

- complete = every module structure in `studiedKeys` (the single canonical
  `moduleProgress` rule — same semantics the student system uses);
- in progress = ≥1 structure studied; not started = 0 studied;
- per-student rows expose only already-authorized fields (name, role,
  studied count); unknown module keys render "unavailable", never fabricated.

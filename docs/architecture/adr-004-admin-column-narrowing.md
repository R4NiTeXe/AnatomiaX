# ADR-004: Admin List Column Narrowing

Status: accepted.

## Context

`AdminService` list/overview queries fetched full `User` and `Cohort` rows.
`toSafeUser` stripped secrets before serialization, but `passwordHash`
(and cohort `inviteCode`) still traveled from the driver into service
memory on every admin list call — a wider secret footprint than necessary,
plus wasted I/O on large text columns.

## Decision

- All admin list/overview reads use explicit `select`: users fetch exactly
  `{ id, email, name, role, createdAt }`; cohorts fetch only rendered
  fields plus `_count.members` nested inside `select` (Prisma forbids
  `select` + `include` siblings).
- `toSafeUser` now accepts `Pick<User, ...>` instead of full `User`, so
  narrowed rows typecheck and full rows remain assignable.
- Unit specs pin the exact user `select` and assert `passwordHash` /
  `inviteCode` are absent from cohort/user selections; e2e fakes honor
  `select._count` like they honored `include._count`.

## Consequences

- Secrets never enter the Node process on admin list paths (defense in
  depth beyond response mapping). Any new admin list query must add its own
  `select` — full-row fetches should be treated as review findings.

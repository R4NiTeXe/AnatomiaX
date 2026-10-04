# Dependency Rules (enforced by `npm run boundaries`)

## Backend (`backend/api/src/`)

```
common, config, database  →  infrastructure only (no business imports)
modules/users             →  common, config, database
modules/auth              →  users, common, config, database
modules/cohorts           →  auth, users, common, config, database
modules/progress          →  auth, users, common, config, database
modules/quizzes           →  auth, users, cohorts, audit, common, config, database
modules/notifications     →  auth, users, common, config, database
modules/health            →  auth (ThrottlerModule instance only), common, config, database
modules/audit             →  common, config, database
modules/admins            →  auth, users, audit, common, config, database
app.module.ts, main.ts    →  anything (composition roots)
```

- Only **value** imports are checked (type-only imports erase at
  runtime and cannot cycle).
- Test files (`*.spec.ts`) are exempt — tests may wire anything.
- No cycles exist; the graph flows one way toward infrastructure
  sinks. Any new edge outside this table fails CI.

## Frontend

- Features import from `lib/`, `hooks/`, `components/{ui,layout,…}`,
  `@anatomiax/*` — never the reverse.
- `features/*` never import each other except `quizzes → cohorts`
  patterns via shared hooks where already established; prefer shared
  `lib/` for cross-feature helpers.
- No business rules inside generic UI (`components/ui`).
- No Prisma/database types outside the API contract copies in
  `@anatomiax/shared-types`.

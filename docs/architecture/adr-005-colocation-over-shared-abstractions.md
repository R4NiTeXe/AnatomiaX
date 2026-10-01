# ADR-005: Colocation Over Shared Abstractions (Dashboard Split, Guard Placement)

Status: accepted.

## Context

`CohortDashboardPage.tsx` grew to 1064 lines (header, KPIs, assignment
analytics, member roster, activity feed). The audit also suggested moving
auth guards into a shared `common/guards` directory.

## Decision

- Split by section, colocated at
  `frontend/web/src/components/cohorts/dashboard/`: `DashboardHeader`,
  `DashboardKpis`, `AssignmentAnalytics`, `MemberRoster`, `RecentActivity`,
  plus `dashboardFormat` helpers and `useDashboardAggregates`. The page
  (243 lines) owns hooks/state/memos/composition; sections are
  presentational and receive values via props.
- Sections stay cohort-specific — nothing was promoted to generic
  `components/ui`, which would fake reuse where none exists yet. Promote
  only on the second real consumer.
- Guards stay feature-colocated (`auth/` module): this is idiomatic Nest
  (providers resolve within their module, no barrel churn), and
  `OriginCheckGuard`/`GoogleAuthGuard` are auth-domain concepts. A
  `common/guards` move was reviewed and rejected as indirection without a
  second consumer.
- The existing 11-test `cohortDashboard` suite (testid-pinned) served as
  the regression gate: green before and after, plus a new focused spec for
  the extracted aggregates/format logic.

## Consequences

- Dashboard changes touch one section file, not a 1000-line page.
  Cross-feature guard reuse, if ever needed, can revisit this decision —
  the ADR records where the bar is (second consumer).

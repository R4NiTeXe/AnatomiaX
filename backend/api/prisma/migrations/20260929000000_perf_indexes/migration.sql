-- Composite and sort indexes for observed WHERE/ORDER BY patterns
-- (admin lists, cohort member/assignment listings, subscription lists).
-- Additive only: no table/column changes, no data migration.

-- CreateIndex
CREATE INDEX "users_role_deletedAt_idx" ON "users"("role", "deletedAt");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "cohorts_createdAt_idx" ON "cohorts"("createdAt");

-- CreateIndex
CREATE INDEX "cohorts_archivedAt_idx" ON "cohorts"("archivedAt");

-- CreateIndex
CREATE INDEX "cohort_members_cohortId_joinedAt_idx" ON "cohort_members"("cohortId", "joinedAt");

-- CreateIndex
CREATE INDEX "cohort_assignments_cohortId_createdAt_idx" ON "cohort_assignments"("cohortId", "createdAt");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_createdAt_idx" ON "push_subscriptions"("userId", "createdAt");


CREATE INDEX "users_role_deletedAt_idx" ON "users"("role", "deletedAt");

CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

CREATE INDEX "cohorts_createdAt_idx" ON "cohorts"("createdAt");

CREATE INDEX "cohorts_archivedAt_idx" ON "cohorts"("archivedAt");

CREATE INDEX "cohort_members_cohortId_joinedAt_idx" ON "cohort_members"("cohortId", "joinedAt");

CREATE INDEX "cohort_assignments_cohortId_createdAt_idx" ON "cohort_assignments"("cohortId", "createdAt");

CREATE INDEX "push_subscriptions_userId_createdAt_idx" ON "push_subscriptions"("userId", "createdAt");

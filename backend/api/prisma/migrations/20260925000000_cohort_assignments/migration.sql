CREATE TABLE "cohort_assignments" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cohortId" TEXT NOT NULL,
    "assignedById" TEXT,

    CONSTRAINT "cohort_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cohort_assignments_cohortId_moduleKey_key" ON "cohort_assignments"("cohortId", "moduleKey");

CREATE INDEX "cohort_assignments_cohortId_idx" ON "cohort_assignments"("cohortId");

ALTER TABLE "cohort_assignments" ADD CONSTRAINT "cohort_assignments_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cohort_assignments" ADD CONSTRAINT "cohort_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

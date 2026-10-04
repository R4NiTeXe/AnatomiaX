-- Composite indexes for auth hot paths: family revocation scans
-- ({ userId, revokedAt: null }) and reset-token cleanup/claims
-- ({ userId, usedAt: null }). Names follow Prisma's default
-- {table}_{columns}_idx convention so `migrate diff` reports no drift.
-- Additive only: no table/column changes, no data migration.

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_usedAt_idx" ON "password_reset_tokens"("userId", "usedAt");

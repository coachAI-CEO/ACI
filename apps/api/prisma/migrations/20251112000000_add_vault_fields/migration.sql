-- AlterTable
ALTER TABLE "Drill" ADD COLUMN IF NOT EXISTS "savedToVault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "savedToVault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "isSeries" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "seriesNumber" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Drill_savedToVault_idx" ON "Drill"("savedToVault");
CREATE INDEX IF NOT EXISTS "Drill_gameModelId_ageGroup_phase_zone_idx" ON "Drill"("gameModelId", "ageGroup", "phase", "zone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_savedToVault_idx" ON "Session"("savedToVault");
CREATE INDEX IF NOT EXISTS "Session_isSeries_seriesId_idx" ON "Session"("isSeries", "seriesId");
CREATE INDEX IF NOT EXISTS "Session_gameModelId_ageGroup_phase_zone_idx" ON "Session"("gameModelId", "ageGroup", "phase", "zone");

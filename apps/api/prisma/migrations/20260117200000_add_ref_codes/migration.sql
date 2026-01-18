-- AlterTable
ALTER TABLE "Drill" ADD COLUMN "refCode" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "refCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Drill_refCode_key" ON "Drill"("refCode");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refCode_key" ON "Session"("refCode");

-- CreateIndex
CREATE INDEX "Drill_refCode_idx" ON "Drill"("refCode");

-- CreateIndex
CREATE INDEX "Session_refCode_idx" ON "Session"("refCode");

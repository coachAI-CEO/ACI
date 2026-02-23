-- AlterTable
ALTER TABLE "VideoAnalysisVault" ADD COLUMN "refCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VideoAnalysisVault_refCode_key" ON "VideoAnalysisVault"("refCode");

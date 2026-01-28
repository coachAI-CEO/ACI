-- AlterTable
ALTER TABLE "Drill" ADD COLUMN     "generatedBy" TEXT;

-- CreateIndex
CREATE INDEX "Drill_generatedBy_idx" ON "Drill"("generatedBy");

-- AddForeignKey
ALTER TABLE "Drill" ADD CONSTRAINT "Drill_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

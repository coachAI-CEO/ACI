-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "generatedBy" TEXT;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

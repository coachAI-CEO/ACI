-- AlterTable
ALTER TABLE "AccessPermission" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "AccessPermission_userId_idx" ON "AccessPermission"("userId");

-- AddForeignKey
ALTER TABLE "AccessPermission" ADD CONSTRAINT "AccessPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

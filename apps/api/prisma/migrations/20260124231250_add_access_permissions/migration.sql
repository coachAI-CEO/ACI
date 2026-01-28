-- CreateTable
CREATE TABLE "AccessPermission" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "coachLevel" "CoachLevel",
    "ageGroups" TEXT[],
    "formats" TEXT[],
    "canGenerateSessions" BOOLEAN NOT NULL DEFAULT false,
    "canAccessVault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessPermission_resourceType_idx" ON "AccessPermission"("resourceType");

-- CreateIndex
CREATE INDEX "AccessPermission_coachLevel_idx" ON "AccessPermission"("coachLevel");

-- CreateIndex
CREATE INDEX "AccessPermission_createdAt_idx" ON "AccessPermission"("createdAt");

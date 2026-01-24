-- CreateTable
CREATE TABLE "PlayerPlan" (
    "id" TEXT NOT NULL,
    "refCode" TEXT,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceRefCode" TEXT,
    "title" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "playerLevel" "PlayerLevel",
    "objectives" TEXT,
    "durationMin" INTEGER NOT NULL,
    "json" JSONB NOT NULL,
    "equipment" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPlan_refCode_key" ON "PlayerPlan"("refCode");

-- CreateIndex
CREATE INDEX "PlayerPlan_userId_idx" ON "PlayerPlan"("userId");

-- CreateIndex
CREATE INDEX "PlayerPlan_sourceType_sourceId_idx" ON "PlayerPlan"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "PlayerPlan_refCode_idx" ON "PlayerPlan"("refCode");

-- AddForeignKey
ALTER TABLE "PlayerPlan" ADD CONSTRAINT "PlayerPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

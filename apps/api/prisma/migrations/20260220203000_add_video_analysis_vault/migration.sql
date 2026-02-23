-- CreateTable
CREATE TABLE "VideoAnalysisVault" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "playerLevel" TEXT NOT NULL,
    "coachLevel" TEXT NOT NULL,
    "gameModelId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "focusTeamColor" TEXT NOT NULL,
    "opponentTeamColor" TEXT NOT NULL,
    "sourceFileUri" TEXT,
    "fileUriUsed" TEXT,
    "model" TEXT,
    "analysis" JSONB NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnalysisVault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoAnalysisVault_userId_idx" ON "VideoAnalysisVault"("userId");

-- CreateIndex
CREATE INDEX "VideoAnalysisVault_createdAt_idx" ON "VideoAnalysisVault"("createdAt");

-- CreateIndex
CREATE INDEX "VideoAnalysisVault_gameModelId_phase_zone_idx" ON "VideoAnalysisVault"("gameModelId", "phase", "zone");

-- AddForeignKey
ALTER TABLE "VideoAnalysisVault" ADD CONSTRAINT "VideoAnalysisVault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

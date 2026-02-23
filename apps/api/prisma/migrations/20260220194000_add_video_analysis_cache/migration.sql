-- CreateTable
CREATE TABLE "VideoAnalysisCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "sourceFileUri" TEXT NOT NULL,
    "sourceFileUriNormalized" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "playerLevel" TEXT NOT NULL,
    "coachLevel" TEXT NOT NULL,
    "gameModelId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "focusTeamColor" TEXT NOT NULL,
    "opponentTeamColor" TEXT NOT NULL,
    "minItems" INTEGER NOT NULL,
    "maxItems" INTEGER NOT NULL,
    "contract" JSONB NOT NULL,
    "analysis" JSONB NOT NULL,
    "fileUriUsed" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnalysisCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoAnalysisCache_cacheKey_key" ON "VideoAnalysisCache"("cacheKey");

-- CreateIndex
CREATE INDEX "VideoAnalysisCache_sourceFileUriNormalized_idx" ON "VideoAnalysisCache"("sourceFileUriNormalized");

-- CreateIndex
CREATE INDEX "VideoAnalysisCache_createdAt_idx" ON "VideoAnalysisCache"("createdAt");

-- CreateIndex
CREATE INDEX "VideoAnalysisCache_model_idx" ON "VideoAnalysisCache"("model");

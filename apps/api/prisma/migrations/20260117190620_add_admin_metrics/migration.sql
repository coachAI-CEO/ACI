-- CreateTable
CREATE TABLE "ApiMetrics" (
    "id" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "artifactId" TEXT,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "promptLength" INTEGER NOT NULL,
    "responseLength" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "ageGroup" TEXT,
    "gameModelId" TEXT,
    "phase" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMetrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalApiCalls" INTEGER NOT NULL DEFAULT 0,
    "successfulCalls" INTEGER NOT NULL DEFAULT 0,
    "failedCalls" INTEGER NOT NULL DEFAULT 0,
    "sessionsGenerated" INTEGER NOT NULL DEFAULT 0,
    "drillsGenerated" INTEGER NOT NULL DEFAULT 0,
    "seriesGenerated" INTEGER NOT NULL DEFAULT 0,
    "skillFocusGenerated" INTEGER NOT NULL DEFAULT 0,
    "qaReviewsRun" INTEGER NOT NULL DEFAULT 0,
    "totalPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCompletionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "avgDurationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiMetrics_operationType_idx" ON "ApiMetrics"("operationType");

-- CreateIndex
CREATE INDEX "ApiMetrics_createdAt_idx" ON "ApiMetrics"("createdAt");

-- CreateIndex
CREATE INDEX "ApiMetrics_model_idx" ON "ApiMetrics"("model");

-- CreateIndex
CREATE INDEX "ApiMetrics_success_idx" ON "ApiMetrics"("success");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetrics_date_key" ON "DailyMetrics"("date");

-- CreateIndex
CREATE INDEX "DailyMetrics_date_idx" ON "DailyMetrics"("date");

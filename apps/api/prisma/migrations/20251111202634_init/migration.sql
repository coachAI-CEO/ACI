CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "GameModelId" AS ENUM ('COACHAI', 'POSSESSION', 'PRESSING', 'TRANSITION');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('ATTACKING', 'DEFENDING', 'TRANSITION', 'TRANSITION_TO_ATTACK', 'TRANSITION_TO_DEFEND');

-- CreateEnum
CREATE TYPE "Zone" AS ENUM ('DEFENSIVE_THIRD', 'MIDDLE_THIRD', 'ATTACKING_THIRD');

-- CreateEnum
CREATE TYPE "SpaceConstraint" AS ENUM ('FULL', 'HALF', 'THIRD', 'QUARTER');

-- CreateEnum
CREATE TYPE "PlayerLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "CoachLevel" AS ENUM ('GRASSROOTS', 'USSF_C', 'USSF_B_PLUS');

-- CreateEnum
CREATE TYPE "DrillType" AS ENUM ('WARMUP', 'TECHNICAL', 'TACTICAL', 'CONDITIONED_GAME', 'FULL_GAME', 'COOLDOWN');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('DRILL', 'SESSION', 'MICROCYCLE', 'MESOCYCLE');

-- CreateTable
CREATE TABLE "Drill" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "principleIds" JSONB,
    "psychThemeIds" JSONB,
    "energySystem" TEXT,
    "rpeMin" INTEGER,
    "rpeMax" INTEGER,
    "numbersMin" INTEGER,
    "numbersMax" INTEGER,
    "spaceConstraint" TEXT,
    "goalsAvailable" INTEGER,
    "goalMode" TEXT,
    "formationUsed" TEXT,
    "playerLevel" "PlayerLevel",
    "coachLevel" "CoachLevel",
    "drillType" "DrillType",
    "needGKFocus" BOOLEAN DEFAULT false,
    "gkFocus" TEXT,
    "gameModelId" "GameModelId" NOT NULL,
    "phase" "Phase" NOT NULL,
    "zone" "Zone" NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "durationMin" INTEGER,
    "qaScore" DOUBLE PRECISION,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "savedToVault" BOOLEAN NOT NULL DEFAULT false,
    "json" JSONB NOT NULL,
    "visualThumbSvg" TEXT,
    "visualHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "principleIds" JSONB,
    "psychThemeIds" JSONB,
    "energySystem" TEXT,
    "rpeMin" INTEGER,
    "rpeMax" INTEGER,
    "numbersMin" INTEGER,
    "numbersMax" INTEGER,
    "spaceConstraint" TEXT,
    "goalsAvailable" INTEGER,
    "goalMode" TEXT,
    "formationUsed" TEXT,
    "playerLevel" "PlayerLevel",
    "coachLevel" "CoachLevel",
    "gameModelId" "GameModelId" NOT NULL,
    "phase" "Phase",
    "zone" "Zone",
    "ageGroup" TEXT NOT NULL,
    "durationMin" INTEGER,
    "qaScore" DOUBLE PRECISION,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "savedToVault" BOOLEAN NOT NULL DEFAULT false,
    "isSeries" BOOLEAN NOT NULL DEFAULT false,
    "seriesId" TEXT,
    "seriesNumber" INTEGER,
    "json" JSONB NOT NULL,
    "visualThumbSvg" TEXT,
    "visualHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillFocus" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "seriesId" TEXT,
    "sessionIds" JSONB,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "keySkills" JSONB NOT NULL,
    "coachingPoints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillFocus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QAReport" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "artifactType" "ArtifactType" NOT NULL DEFAULT 'DRILL',
    "drillId" TEXT,
    "sessionId" TEXT,
    "pass" BOOLEAN NOT NULL,
    "scores" JSONB NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QAReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtifactEmbedding" (
    "id" TEXT NOT NULL,
    "artifactType" "ArtifactType" NOT NULL,
    "artifactId" TEXT NOT NULL,
    "dims" INTEGER NOT NULL,
    "embedding" vector NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtifactEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Drill_visualHash_key" ON "Drill"("visualHash");

-- CreateIndex
CREATE INDEX "Drill_savedToVault_idx" ON "Drill"("savedToVault");

-- CreateIndex
CREATE INDEX "Drill_gameModelId_ageGroup_phase_zone_idx" ON "Drill"("gameModelId", "ageGroup", "phase", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "Session_visualHash_key" ON "Session"("visualHash");

-- CreateIndex
CREATE INDEX "Session_savedToVault_idx" ON "Session"("savedToVault");

-- CreateIndex
CREATE INDEX "Session_isSeries_seriesId_idx" ON "Session"("isSeries", "seriesId");

-- CreateIndex
CREATE INDEX "Session_gameModelId_ageGroup_phase_zone_idx" ON "Session"("gameModelId", "ageGroup", "phase", "zone");

-- CreateIndex
CREATE INDEX "SkillFocus_sessionId_idx" ON "SkillFocus"("sessionId");

-- CreateIndex
CREATE INDEX "SkillFocus_seriesId_idx" ON "SkillFocus"("seriesId");

-- CreateIndex
CREATE INDEX "QAReport_artifactId_artifactType_idx" ON "QAReport"("artifactId", "artifactType");

-- CreateIndex
CREATE INDEX "QAReport_drillId_idx" ON "QAReport"("drillId");

-- CreateIndex
CREATE INDEX "QAReport_sessionId_idx" ON "QAReport"("sessionId");

-- CreateIndex
CREATE INDEX "ArtifactEmbedding_artifactType_artifactId_idx" ON "ArtifactEmbedding"("artifactType", "artifactId");

-- AddForeignKey
ALTER TABLE "SkillFocus" ADD CONSTRAINT "SkillFocus_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAReport" ADD CONSTRAINT "QAReport_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "Drill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAReport" ADD CONSTRAINT "QAReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

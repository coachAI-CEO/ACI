CREATE EXTENSION IF NOT EXISTS vector;
-- CreateEnum
CREATE TYPE "GameModelId" AS ENUM ('COACHAI', 'POSSESSION', 'PRESSING', 'TRANSITION');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('ATTACKING', 'DEFENDING', 'TRANSITION_TO_ATTACK', 'TRANSITION_TO_DEFEND');

-- CreateEnum
CREATE TYPE "Zone" AS ENUM ('DEFENSIVE_THIRD', 'MIDDLE_THIRD', 'ATTACKING_THIRD');

-- CreateEnum
CREATE TYPE "SpaceConstraint" AS ENUM ('FULL', 'HALF', 'THIRD', 'QUARTER');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('DRILL', 'SESSION', 'MICROCYCLE', 'MESOCYCLE');

-- CreateTable
CREATE TABLE "Drill" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "gameModelId" "GameModelId" NOT NULL,
    "phase" "Phase" NOT NULL,
    "zone" "Zone" NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "durationMin" INTEGER,
    "qaScore" DOUBLE PRECISION,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "numbersMin" INTEGER NOT NULL,
    "numbersMax" INTEGER NOT NULL,
    "gkOptional" BOOLEAN NOT NULL DEFAULT true,
    "spaceConstraint" "SpaceConstraint" NOT NULL,
    "goalsSupported" INTEGER[],
    "json" JSONB NOT NULL,
    "visualThumbSvg" TEXT,
    "visualHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QAReport" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
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
CREATE INDEX "ArtifactEmbedding_artifactType_artifactId_idx" ON "ArtifactEmbedding"("artifactType", "artifactId");

-- AddForeignKey
ALTER TABLE "QAReport" ADD CONSTRAINT "QAReport_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Drill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArtifactEmbedding" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

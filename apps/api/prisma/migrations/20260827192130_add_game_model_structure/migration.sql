-- CreateEnum
CREATE TYPE "GameModelMoment" AS ENUM ('ATTACKING_ORGANIZATION', 'DEFENSIVE_TRANSITION', 'DEFENSIVE_ORGANIZATION', 'ATTACKING_TRANSITION');

-- CreateEnum
CREATE TYPE "TrainingPriorityStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TrainingPriorityOutcome" AS ENUM ('RARELY', 'SOMETIMES', 'CONSISTENTLY');

-- CreateEnum
CREATE TYPE "SubprincipleReadiness" AS ENUM ('FOUNDATIONAL', 'DEVELOPING', 'ADVANCED');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "target_subprinciple_id" TEXT,
ADD COLUMN     "training_priority_id" TEXT;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "readiness_override" "SubprincipleReadiness";

-- CreateTable
CREATE TABLE "principles" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "moment" "GameModelMoment" NOT NULL,
    "statement" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "principles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subprinciples" (
    "id" TEXT NOT NULL,
    "principle_id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "anti_pattern" TEXT,
    "readiness" "SubprincipleReadiness" NOT NULL DEFAULT 'FOUNDATIONAL',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subprinciples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_priorities" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "subprinciple_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" "TrainingPriorityStatus" NOT NULL DEFAULT 'ACTIVE',
    "outcome" "TrainingPriorityOutcome",
    "outcome_notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "age_group_maturity_notes" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "age_group" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "age_group_maturity_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_ceiling_overrides" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "age_group" TEXT NOT NULL,
    "ceiling" "SubprincipleReadiness" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "readiness_ceiling_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "principles_club_id_moment_idx" ON "principles"("club_id", "moment");

-- CreateIndex
CREATE INDEX "subprinciples_principle_id_idx" ON "subprinciples"("principle_id");

-- CreateIndex
CREATE INDEX "training_priorities_team_id_week_start_idx" ON "training_priorities"("team_id", "week_start");

-- CreateIndex
CREATE INDEX "training_priorities_subprinciple_id_idx" ON "training_priorities"("subprinciple_id");

-- CreateIndex
CREATE UNIQUE INDEX "age_group_maturity_notes_club_id_age_group_key" ON "age_group_maturity_notes"("club_id", "age_group");

-- CreateIndex
CREATE UNIQUE INDEX "readiness_ceiling_overrides_club_id_age_group_key" ON "readiness_ceiling_overrides"("club_id", "age_group");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_target_subprinciple_id_fkey" FOREIGN KEY ("target_subprinciple_id") REFERENCES "subprinciples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_training_priority_id_fkey" FOREIGN KEY ("training_priority_id") REFERENCES "training_priorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "principles" ADD CONSTRAINT "principles_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subprinciples" ADD CONSTRAINT "subprinciples_principle_id_fkey" FOREIGN KEY ("principle_id") REFERENCES "principles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_priorities" ADD CONSTRAINT "training_priorities_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_priorities" ADD CONSTRAINT "training_priorities_subprinciple_id_fkey" FOREIGN KEY ("subprinciple_id") REFERENCES "subprinciples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "age_group_maturity_notes" ADD CONSTRAINT "age_group_maturity_notes_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readiness_ceiling_overrides" ADD CONSTRAINT "readiness_ceiling_overrides_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "TeamCoachRole" AS ENUM ('HEAD', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "SeasonPhase" AS ENUM ('PRESEASON', 'IN_SEASON', 'PLAYOFFS', 'OFFSEASON');

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age_group" TEXT NOT NULL,
    "club_id" TEXT,
    "section_id" TEXT,
    "game_model_id" "GameModelId" NOT NULL,
    "season_label" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_coaches" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TeamCoachRole" NOT NULL DEFAULT 'HEAD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_seasons" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "phase" "SeasonPhase" NOT NULL DEFAULT 'IN_SEASON',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_weeks" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "week_index" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "moment" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "zone" TEXT,
    "focus" TEXT,
    "notes" TEXT,

    CONSTRAINT "curriculum_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_center_messages" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_center_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_day_documents" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "match_date" TIMESTAMP(3) NOT NULL,
    "opponent" TEXT,
    "venue" TEXT,
    "competition" TEXT,
    "kickoff_time" TEXT,
    "formation" TEXT,
    "key_focus" TEXT,
    "attacking_notes" TEXT,
    "defending_notes" TEXT,
    "set_pieces" TEXT,
    "lineup_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_day_documents_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "team_id" TEXT;

-- CreateIndex
CREATE INDEX "teams_created_by_user_id_idx" ON "teams"("created_by_user_id");

-- CreateIndex
CREATE INDEX "teams_club_id_idx" ON "teams"("club_id");

-- CreateIndex
CREATE INDEX "team_coaches_user_id_idx" ON "team_coaches"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_coaches_team_id_user_id_key" ON "team_coaches"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "team_seasons_team_id_active_idx" ON "team_seasons"("team_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_weeks_season_id_week_index_key" ON "curriculum_weeks"("season_id", "week_index");

-- CreateIndex
CREATE INDEX "coach_center_messages_team_id_created_at_idx" ON "coach_center_messages"("team_id", "created_at");

-- CreateIndex
CREATE INDEX "game_day_documents_team_id_match_date_idx" ON "game_day_documents"("team_id", "match_date");

-- CreateIndex
CREATE INDEX "CalendarEvent_team_id_idx" ON "CalendarEvent"("team_id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_coaches" ADD CONSTRAINT "team_coaches_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_coaches" ADD CONSTRAINT "team_coaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_weeks" ADD CONSTRAINT "curriculum_weeks_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "team_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_center_messages" ADD CONSTRAINT "coach_center_messages_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_center_messages" ADD CONSTRAINT "coach_center_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_day_documents" ADD CONSTRAINT "game_day_documents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_day_documents" ADD CONSTRAINT "game_day_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

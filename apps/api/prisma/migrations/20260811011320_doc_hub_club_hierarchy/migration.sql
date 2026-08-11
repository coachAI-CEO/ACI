/*
  Warnings:

  - Changed the type of `game_model_id` on the `clubs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ClubRole" AS ENUM ('DOC', 'SECTION_DIRECTOR', 'COACH');

-- AlterTable
ALTER TABLE "AccessPermission" ADD COLUMN     "club_id" TEXT,
ADD COLUMN     "created_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "assigned_by_user_id" TEXT,
ADD COLUMN     "original_coach_id" TEXT,
ADD COLUMN     "reassigned_at" TIMESTAMP(3),
ADD COLUMN     "reassigned_by" TEXT;

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "philosophy_attacking_organization" TEXT,
ADD COLUMN     "philosophy_attacking_transition" TEXT,
ADD COLUMN     "philosophy_defensive_organization" TEXT,
ADD COLUMN     "philosophy_defensive_transition" TEXT,
ADD COLUMN     "philosophy_updated_at" TIMESTAMP(3),
ADD COLUMN     "philosophy_updated_by" TEXT,
ALTER COLUMN "game_model_id" TYPE "GameModelId" USING ("game_model_id"::"GameModelId"),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMembership" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "section_id" TEXT,
    "role" "ClubRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Section_club_id_idx" ON "Section"("club_id");

-- CreateIndex
CREATE UNIQUE INDEX "Section_club_id_name_key" ON "Section"("club_id", "name");

-- CreateIndex
CREATE INDEX "ClubMembership_club_id_idx" ON "ClubMembership"("club_id");

-- CreateIndex
CREATE INDEX "ClubMembership_section_id_idx" ON "ClubMembership"("section_id");

-- CreateIndex
CREATE INDEX "ClubMembership_user_id_idx" ON "ClubMembership"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMembership_user_id_club_id_key" ON "ClubMembership"("user_id", "club_id");

-- CreateIndex
CREATE INDEX "AccessPermission_club_id_idx" ON "AccessPermission"("club_id");

-- AddForeignKey
ALTER TABLE "AccessPermission" ADD CONSTRAINT "AccessPermission_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPermission" ADD CONSTRAINT "AccessPermission_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "BoardShareMode" AS ENUM ('PRIVATE', 'CLUB');

-- CreateTable
CREATE TABLE "tactical_boards" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "club_id" TEXT,
    "title" TEXT NOT NULL,
    "diagram" JSONB NOT NULL,
    "age_group" TEXT,
    "game_model_id" "GameModelId" NOT NULL,
    "share_mode" "BoardShareMode" NOT NULL DEFAULT 'PRIVATE',
    "source_session_id" TEXT,
    "source_drill_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tactical_boards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tactical_boards_owner_user_id_updated_at_idx" ON "tactical_boards"("owner_user_id", "updated_at");

-- CreateIndex
CREATE INDEX "tactical_boards_club_id_updated_at_idx" ON "tactical_boards"("club_id", "updated_at");

-- AddForeignKey
ALTER TABLE "tactical_boards" ADD CONSTRAINT "tactical_boards_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tactical_boards" ADD CONSTRAINT "tactical_boards_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

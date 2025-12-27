-- CreateEnum
CREATE TYPE "DrillType" AS ENUM ('WARMUP', 'TECHNICAL', 'TACTICAL', 'CONDITIONED_GAME', 'FULL_GAME', 'COOLDOWN');

-- AlterTable
ALTER TABLE "Drill" ADD COLUMN "drillType" "DrillType";

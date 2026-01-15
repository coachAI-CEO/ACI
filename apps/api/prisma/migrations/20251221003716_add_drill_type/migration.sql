-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DrillType') THEN
    CREATE TYPE "DrillType" AS ENUM ('WARMUP', 'TECHNICAL', 'TACTICAL', 'CONDITIONED_GAME', 'FULL_GAME', 'COOLDOWN');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Drill" ADD COLUMN IF NOT EXISTS "drillType" "DrillType";

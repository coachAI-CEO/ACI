-- AlterTable
ALTER TABLE "SkillFocus" ADD COLUMN IF NOT EXISTS "psychologyGood" JSONB;
ALTER TABLE "SkillFocus" ADD COLUMN IF NOT EXISTS "psychologyBad" JSONB;

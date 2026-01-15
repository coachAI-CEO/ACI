-- CreateTable
CREATE TABLE IF NOT EXISTS "SkillFocus" (
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SkillFocus_sessionId_idx" ON "SkillFocus"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SkillFocus_seriesId_idx" ON "SkillFocus"("seriesId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SkillFocus_sessionId_fkey'
  ) THEN
    ALTER TABLE "SkillFocus" ADD CONSTRAINT "SkillFocus_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

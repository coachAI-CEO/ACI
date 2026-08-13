-- AlterTable
ALTER TABLE "Session" ADD COLUMN "clubId" TEXT;

-- CreateIndex
CREATE INDEX "Session_clubId_idx" ON "Session"("clubId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from the generator's preferred ClubMembership (COACH first).
UPDATE "Session" s
SET "clubId" = m.club_id
FROM (
  SELECT DISTINCT ON (cm.user_id)
    cm.user_id,
    cm.club_id
  FROM "ClubMembership" cm
  INNER JOIN clubs c ON c.id = cm.club_id AND COALESCE(c.active, true) = true
  ORDER BY cm.user_id,
    CASE WHEN cm.role = 'COACH' THEN 0 ELSE 1 END,
    cm.created_at ASC
) m
WHERE s."generatedBy" = m.user_id
  AND s."clubId" IS NULL;

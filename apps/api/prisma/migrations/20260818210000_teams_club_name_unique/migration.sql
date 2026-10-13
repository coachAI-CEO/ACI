-- Duplicate catalog rows were created by concurrent GET /admin/teams seeds.
-- Keep the oldest team per club + name, then prevent repeats.

DELETE FROM "teams" t
WHERE t.club_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "teams" keep
    WHERE keep.club_id = t.club_id
      AND lower(keep.name) = lower(t.name)
      AND (
        keep.created_at < t.created_at
        OR (keep.created_at = t.created_at AND keep.id < t.id)
      )
  );

CREATE UNIQUE INDEX "teams_club_id_name_unique" ON "teams"("club_id", "name");

import { prisma } from "../prisma";
import { getAgeGroupMaturityNote as getDefaultNote, KNOWN_AGE_GROUPS } from "./game-model-readiness";

export class AgeGroupMaturityError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AgeGroupMaturityError";
  }
}

export type AgeGroupMaturityRow = {
  ageGroup: string;
  note: string;
  isCustom: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

/**
 * All known age groups for a club, editable-screen shape: the club's own
 * override where one exists, the shared default everywhere else. This is
 * what DOC Hub's age-group maturity screen reads to render the full table.
 */
export async function getAgeGroupMaturityNotesForClub(clubId: string): Promise<AgeGroupMaturityRow[]> {
  const custom = await prisma.ageGroupMaturityNote.findMany({ where: { clubId } });
  const byAgeGroup = new Map(custom.map((row) => [row.ageGroup, row]));

  return KNOWN_AGE_GROUPS.map((ageGroup) => {
    const row = byAgeGroup.get(ageGroup);
    return {
      ageGroup,
      note: row?.note ?? getDefaultNote(ageGroup),
      isCustom: Boolean(row),
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
}

/**
 * DOC edits one age group's note. Passing note: null resets that age group
 * back to the shared default instead of storing an empty override.
 */
export async function setAgeGroupMaturityNote(input: {
  clubId: string;
  ageGroup: string;
  note: string | null;
  updatedBy?: string;
}): Promise<AgeGroupMaturityRow> {
  if (!KNOWN_AGE_GROUPS.includes(input.ageGroup)) {
    throw new AgeGroupMaturityError(
      400,
      "INVALID_AGE_GROUP",
      `ageGroup must be one of ${KNOWN_AGE_GROUPS.join(", ")}`
    );
  }

  if (input.note === null) {
    await prisma.ageGroupMaturityNote.deleteMany({ where: { clubId: input.clubId, ageGroup: input.ageGroup } });
    return { ageGroup: input.ageGroup, note: getDefaultNote(input.ageGroup), isCustom: false, updatedAt: null, updatedBy: null };
  }

  const trimmed = input.note.trim();
  if (!trimmed) {
    throw new AgeGroupMaturityError(400, "INVALID_NOTE", "note cannot be empty -- pass null to reset instead");
  }

  const row = await prisma.ageGroupMaturityNote.upsert({
    where: { clubId_ageGroup: { clubId: input.clubId, ageGroup: input.ageGroup } },
    create: { clubId: input.clubId, ageGroup: input.ageGroup, note: trimmed, updatedBy: input.updatedBy },
    update: { note: trimmed, updatedBy: input.updatedBy },
  });

  return {
    ageGroup: row.ageGroup,
    note: row.note,
    isCustom: true,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

/**
 * Used by generate-from-priority.ts at generation time: the club's own
 * override if one exists, else the shared default -- same fallback rule as
 * getAgeGroupMaturityNotesForClub, but a single-row lookup instead of all 11.
 */
export async function resolveAgeGroupMaturityNote(clubId: string | null, ageGroup: string): Promise<string> {
  if (!clubId) return getDefaultNote(ageGroup);

  const row = await prisma.ageGroupMaturityNote.findUnique({
    where: { clubId_ageGroup: { clubId, ageGroup } },
    select: { note: true },
  });
  return row?.note ?? getDefaultNote(ageGroup);
}

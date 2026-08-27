import { prisma } from "../prisma";
import { SubprincipleReadiness } from "@prisma/client";
import { getDefaultReadinessCeiling, KNOWN_AGE_GROUPS } from "./game-model-readiness";

export class ReadinessCeilingOverrideError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ReadinessCeilingOverrideError";
  }
}

export type ReadinessCeilingRow = {
  ageGroup: string;
  ceiling: SubprincipleReadiness;
  isCustom: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

/**
 * All known age groups for a club, editable-screen shape -- the club's own
 * default ceiling override where one exists, the shared hardcoded default
 * everywhere else. Distinct from Team.readinessOverride: this changes the
 * DEFAULT for an age group across the whole club, not one specific team.
 */
export async function getReadinessCeilingsForClub(clubId: string): Promise<ReadinessCeilingRow[]> {
  const custom = await prisma.readinessCeilingOverride.findMany({ where: { clubId } });
  const byAgeGroup = new Map(custom.map((row) => [row.ageGroup, row]));

  return KNOWN_AGE_GROUPS.map((ageGroup) => {
    const row = byAgeGroup.get(ageGroup);
    return {
      ageGroup,
      ceiling: row?.ceiling ?? getDefaultReadinessCeiling(ageGroup),
      isCustom: Boolean(row),
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
}

/** DOC edits one age group's default ceiling. ceiling: null resets to the shared default. */
export async function setReadinessCeilingOverride(input: {
  clubId: string;
  ageGroup: string;
  ceiling: SubprincipleReadiness | null;
  updatedBy?: string;
}): Promise<ReadinessCeilingRow> {
  if (!KNOWN_AGE_GROUPS.includes(input.ageGroup)) {
    throw new ReadinessCeilingOverrideError(
      400,
      "INVALID_AGE_GROUP",
      `ageGroup must be one of ${KNOWN_AGE_GROUPS.join(", ")}`
    );
  }

  if (input.ceiling === null) {
    await prisma.readinessCeilingOverride.deleteMany({ where: { clubId: input.clubId, ageGroup: input.ageGroup } });
    return {
      ageGroup: input.ageGroup,
      ceiling: getDefaultReadinessCeiling(input.ageGroup),
      isCustom: false,
      updatedAt: null,
      updatedBy: null,
    };
  }

  const row = await prisma.readinessCeilingOverride.upsert({
    where: { clubId_ageGroup: { clubId: input.clubId, ageGroup: input.ageGroup } },
    create: { clubId: input.clubId, ageGroup: input.ageGroup, ceiling: input.ceiling, updatedBy: input.updatedBy },
    update: { ceiling: input.ceiling, updatedBy: input.updatedBy },
  });

  return {
    ageGroup: row.ageGroup,
    ceiling: row.ceiling,
    isCustom: true,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

/**
 * Used by createTrainingPriority: the club's own default-ceiling override
 * for this age group if one exists, else the shared hardcoded default.
 * Team.readinessOverride (checked separately, higher priority) still wins
 * over this when set.
 */
export async function resolveClubDefaultReadinessCeiling(
  clubId: string | null,
  ageGroup: string
): Promise<SubprincipleReadiness> {
  if (!clubId) return getDefaultReadinessCeiling(ageGroup);

  const row = await prisma.readinessCeilingOverride.findUnique({
    where: { clubId_ageGroup: { clubId, ageGroup } },
    select: { ceiling: true },
  });
  return row?.ceiling ?? getDefaultReadinessCeiling(ageGroup);
}

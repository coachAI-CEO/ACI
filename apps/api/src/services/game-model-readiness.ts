import { SubprincipleReadiness } from "@prisma/client";
import { getGameFormatForAgeGroup } from "../prompts/session";

// Ordered low-to-high; index also doubles as "how many tiers are unlocked
// at or below this ceiling."
const TIER_ORDER: SubprincipleReadiness[] = [
  SubprincipleReadiness.FOUNDATIONAL,
  SubprincipleReadiness.DEVELOPING,
  SubprincipleReadiness.ADVANCED,
];

/**
 * Default readiness ceiling by format/age band, per the age/format bands
 * already used everywhere else in generation (getGameFormatForAgeGroup).
 * A DOC can override this per team via Team.readinessOverride -- this is
 * only the fallback when no override is set.
 */
export function getDefaultReadinessCeiling(ageGroup: string): SubprincipleReadiness {
  const format = getGameFormatForAgeGroup(ageGroup);
  if (format === "7v7") return SubprincipleReadiness.FOUNDATIONAL;
  if (format === "9v9") return SubprincipleReadiness.DEVELOPING;
  return SubprincipleReadiness.ADVANCED;
}

/** The team's actual ceiling: DOC override if set, else the age/format default. */
export function resolveTeamReadinessCeiling(team: {
  ageGroup: string;
  readinessOverride?: SubprincipleReadiness | null;
}): SubprincipleReadiness {
  return team.readinessOverride ?? getDefaultReadinessCeiling(team.ageGroup);
}

/** All tiers at or below a ceiling, e.g. DEVELOPING -> [FOUNDATIONAL, DEVELOPING]. */
export function getEligibleTiers(ceiling: SubprincipleReadiness): SubprincipleReadiness[] {
  const ceilingIndex = TIER_ORDER.indexOf(ceiling);
  return TIER_ORDER.slice(0, ceilingIndex + 1);
}

export function isReadinessEligibleForTeam(
  team: { ageGroup: string; readinessOverride?: SubprincipleReadiness | null },
  readiness: SubprincipleReadiness
): boolean {
  const ceiling = resolveTeamReadinessCeiling(team);
  return getEligibleTiers(ceiling).includes(readiness);
}

/**
 * Default playerLevel + coachLevel by age band, matching the existing
 * PLAYER LEVEL DIFFICULTY LOCK pairing rule elsewhere in the codebase:
 * BEGINNER only pairs with USSF_D. Used when a Team doesn't have its own
 * playerLevel/coachLevel set (true for every real team today -- Team has no
 * coachLevel field yet, and playerLevel is null on every seeded Rocklin FC
 * team) -- without this, priority-driven generation would silently default
 * every team, including U8s, to adult-level vocabulary and difficulty.
 */
export function getDefaultPlayerAndCoachLevel(ageGroup: string): { playerLevel: string; coachLevel: string } {
  const format = getGameFormatForAgeGroup(ageGroup);
  if (format === "7v7") return { playerLevel: "BEGINNER", coachLevel: "USSF_D" };
  if (format === "9v9") return { playerLevel: "INTERMEDIATE", coachLevel: "USSF_C" };
  return { playerLevel: "ADVANCED", coachLevel: "USSF_B_PLUS" };
}

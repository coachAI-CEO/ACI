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

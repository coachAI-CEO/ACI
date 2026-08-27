import { SubprincipleReadiness } from "@prisma/client";
import { getGameFormatForAgeGroup } from "../prompts/session";

// Ordered low-to-high; index also doubles as "how many tiers are unlocked
// at or below this ceiling."
const TIER_ORDER: SubprincipleReadiness[] = [
  SubprincipleReadiness.FOUNDATIONAL,
  SubprincipleReadiness.DEVELOPING,
  SubprincipleReadiness.ADVANCED,
];

type GameFormat = ReturnType<typeof getGameFormatForAgeGroup>;

/**
 * Single source of truth for everything that varies by format/age band:
 * readiness ceiling, default playerLevel, and default coachLevel. Both
 * getDefaultReadinessCeiling and getDefaultPlayerAndCoachLevel read from
 * this ONE table (keyed on getGameFormatForAgeGroup's output) instead of
 * each hand-rolling its own format->tier ladder -- so a format-band change
 * can't update one without the other.
 */
const BAND_DEFAULTS: Record<
  GameFormat,
  { readinessCeiling: SubprincipleReadiness; playerLevel: string; coachLevel: string }
> = {
  "7v7": { readinessCeiling: SubprincipleReadiness.FOUNDATIONAL, playerLevel: "BEGINNER", coachLevel: "USSF_D" },
  "9v9": { readinessCeiling: SubprincipleReadiness.DEVELOPING, playerLevel: "INTERMEDIATE", coachLevel: "USSF_C" },
  "11v11": { readinessCeiling: SubprincipleReadiness.ADVANCED, playerLevel: "ADVANCED", coachLevel: "USSF_B_PLUS" },
};

/**
 * Default readiness ceiling by format/age band, per the age/format bands
 * already used everywhere else in generation (getGameFormatForAgeGroup).
 * A DOC can override this per team via Team.readinessOverride -- this is
 * only the fallback when no override is set.
 */
export function getDefaultReadinessCeiling(ageGroup: string): SubprincipleReadiness {
  return BAND_DEFAULTS[getGameFormatForAgeGroup(ageGroup)].readinessCeiling;
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
  const { playerLevel, coachLevel } = BAND_DEFAULTS[getGameFormatForAgeGroup(ageGroup)];
  return { playerLevel, coachLevel };
}

/**
 * One-sentence maturity context per age group, injected into generation
 * prompts ALONGSIDE playerLevel/coachLevel (not instead of them) -- those
 * two enums only have 3 possible values each, so U13 through U18 all land
 * on the same ADVANCED/USSF_B_PLUS bucket with nothing to tell them apart.
 * This gives the model a real per-age signal without touching the enum
 * system anything else (the BEGINNER-only-pairs-with-USSF_D rule, the
 * readiness ceiling table) depends on.
 *
 * DRAFT CONTENT: written from general age/format development knowledge, not
 * from Rocklin FC's own coaching staff. Treat this table as a first pass
 * for the club's coaches to correct, the same way the game-model
 * subprinciples themselves were coach-authored rather than assumed.
 */
const AGE_GROUP_MATURITY: Record<string, string> = {
  U8: "Youngest team in the 7v7 format -- first exposure to positional shape; keep the picture small and concrete.",
  U9: "Early 7v7 -- building basic role recognition, but still needs simple, single-cue instructions.",
  U10: "Oldest in the 7v7 format -- ready for slightly more structure ahead of the step up to 9v9.",
  U11: "Youngest in the 9v9 format -- learning to read a larger picture and more spacing than 7v7 offered.",
  U12: "Oldest in the 9v9 format -- consolidating intermediate concepts before the jump to full 11v11.",
  U13: "Youngest in the 11v11 format -- still adjusting to full-pitch scale and spacing, not yet at senior sophistication.",
  U14: "Early 11v11 -- developing tactical discipline within the full structure; concepts are named but still being internalized.",
  U15: "Mid-tier 11v11 -- comfortable with structure; the focus shifts to decision speed under real pressure.",
  U16: "Established 11v11 -- increasing positional interchangeability and proactively reading the game, not just reacting.",
  U17: "Near-senior 11v11 -- multi-phase tactical thinking; treat constraints and language close to adult sophistication.",
  U18: "Most experienced age group -- full adult-level tactical vocabulary and game management expected.",
};

/** Single source of truth for which age groups are known/editable. */
export const KNOWN_AGE_GROUPS = Object.keys(AGE_GROUP_MATURITY);

export function getAgeGroupMaturityNote(ageGroup: string): string {
  return AGE_GROUP_MATURITY[ageGroup.toUpperCase()] || "";
}

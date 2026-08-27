/**
 * Shared generate-form constants — used by both the webapp (apps/web) and the
 * mobile app (apps/mobile) so the two surfaces stay in lockstep.
 */

export type Phase = 'ATTACKING' | 'DEFENDING' | 'TRANSITION';
export type Zone = 'DEFENSIVE_THIRD' | 'MIDDLE_THIRD' | 'ATTACKING_THIRD';
export type SpaceConstraint = 'FULL' | 'HALF' | 'THIRD' | 'QUARTER';
export type DrillType = 'WARMUP' | 'TECHNICAL' | 'TACTICAL' | 'CONDITIONED_GAME' | 'FULL_GAME' | 'COOLDOWN';

export const PHASES: Phase[] = ['ATTACKING', 'DEFENDING', 'TRANSITION'];
export const ZONES: Zone[] = ['DEFENSIVE_THIRD', 'MIDDLE_THIRD', 'ATTACKING_THIRD'];
export const SPACE_CONSTRAINTS: SpaceConstraint[] = ['FULL', 'HALF', 'THIRD', 'QUARTER'];
export const DRILL_TYPES: DrillType[] = ['WARMUP', 'TECHNICAL', 'TACTICAL', 'CONDITIONED_GAME', 'FULL_GAME', 'COOLDOWN'];

/** Formation options per age group. Prevents clarity issues (e.g. 4-3-3 at U10). */
export const FORMATION_BY_AGE: Record<string, string[]> = {
  // 7v7 (U8-U10)
  U8: ['2-3-1', '3-2-1'],
  U9: ['2-3-1', '3-2-1'],
  U10: ['2-3-1', '3-2-1'],
  // 9v9 (U11-U12)
  U11: ['3-2-3', '2-3-2-1', '3-3-2'],
  U12: ['3-2-3', '2-3-2-1', '3-3-2'],
  // 11v11 (U13-U18)
  U13: ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'],
  U14: ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'],
  U15: ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'],
  U16: ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'],
  U17: ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'],
  U18: ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'],
};

export function getValidFormations(ageGroup: string): string[] {
  return FORMATION_BY_AGE[ageGroup] || FORMATION_BY_AGE['U10'];
}

export function getDefaultFormation(ageGroup: string): string {
  const valid = getValidFormations(ageGroup);
  return valid[0] || '2-3-1';
}

export function getFormationTypeLabel(ageGroup: string): string {
  if (['U8', 'U9', 'U10'].includes(ageGroup)) return '7v7 formations';
  if (['U11', 'U12'].includes(ageGroup)) return '9v9 formations';
  return '11v11 formations';
}

/** Display labels — match the webapp verbatim. */
export const PHASE_LABELS: Record<string, string> = {
  ATTACKING: 'Attacking phase',
  DEFENDING: 'Defending phase',
  TRANSITION: 'Transition phase',
};

export const ZONE_LABELS: Record<string, string> = {
  DEFENSIVE_THIRD: 'Defensive third',
  MIDDLE_THIRD: 'Middle third',
  ATTACKING_THIRD: 'Attacking third',
};

export const SPACE_CONSTRAINT_LABELS: Record<string, string> = {
  FULL: 'Full pitch',
  HALF: 'Half pitch',
  THIRD: 'Third',
  QUARTER: 'Quarter',
};

export const DRILL_TYPE_LABELS: Record<string, string> = {
  WARMUP: 'Warmup',
  TECHNICAL: 'Technical',
  TACTICAL: 'Tactical',
  CONDITIONED_GAME: 'Conditioned Game',
  FULL_GAME: 'Full Game',
  COOLDOWN: 'Cooldown',
};

/** Per the webapp rule: USSF_C and USSF_B+ coaches don't pair with Beginner players. */
export function isPlayerLevelAllowedForCoach(
  coachLevel: string,
  playerLevel: string
): boolean {
  if (
    playerLevel === 'BEGINNER' &&
    (coachLevel === 'USSF_C' || coachLevel === 'USSF_B_PLUS')
  ) {
    return false;
  }
  return true;
}
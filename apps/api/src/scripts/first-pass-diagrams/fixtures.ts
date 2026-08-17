import type { FieldFormat } from "../../data/field-dimensions";
import type { DrillPromptInput } from "../../prompts/drill-optimized-v2";

export type FirstPassScene = "A" | "B" | "C" | "D";

export type FirstPassFixture = {
  id: string;
  scene: FirstPassScene;
  label: string;
  input: DrillPromptInput;
  expectedFullGoals: 0 | 1 | 2;
  allowUnopposed: boolean;
  /** Fail if all players sit in one half of a two-goal full pitch. */
  expectSpreadOnPitch: boolean;
};

const PINNED = {
  gameModelId: "ROCKLIN_FC",
  playerLevel: "INTERMEDIATE",
  coachLevel: "USSF_C",
  durationMin: 20,
} as const;

export function fixture(
  id: string,
  scene: FirstPassScene,
  label: string,
  extra: {
    drillType: string;
    ageGroup: string;
    fieldFormat: FieldFormat;
    spaceConstraint: string;
    numbersMin: number;
    numbersMax: number;
    goalsAvailable: number;
    formationAttacking: string;
    formationDefending: string;
    expectedFullGoals: 0 | 1 | 2;
    allowUnopposed?: boolean;
    expectSpreadOnPitch?: boolean;
    phase?: string;
    zone?: string;
    playerLevel?: string;
    coachLevel?: string;
  }
): FirstPassFixture {
  const space = extra.spaceConstraint.toUpperCase();
  return {
    id,
    scene,
    label,
    expectedFullGoals: extra.expectedFullGoals,
    allowUnopposed: extra.allowUnopposed === true,
    expectSpreadOnPitch: extra.expectSpreadOnPitch === true,
    input: {
      ...PINNED,
      drillType: extra.drillType,
      ageGroup: extra.ageGroup,
      fieldFormat: extra.fieldFormat,
      spaceConstraint: extra.spaceConstraint,
      numbersMin: extra.numbersMin,
      numbersMax: extra.numbersMax,
      goalsAvailable: extra.goalsAvailable,
      formationAttacking: extra.formationAttacking,
      formationDefending: extra.formationDefending,
      playerLevel: extra.playerLevel ?? PINNED.playerLevel,
      coachLevel: extra.coachLevel ?? PINNED.coachLevel,
      phase: extra.phase ?? "ATTACKING",
      zone: extra.zone ?? (space === "FULL" ? "MIDDLE_THIRD" : "ATTACKING_THIRD"),
    },
  };
}

export const FIRST_PASS_FIXTURES: FirstPassFixture[] = [
  fixture("A1", "A", "Warmup rondo, 6 to 8 players, no full goal", {
    drillType: "WARMUP",
    ageGroup: "U10",
    fieldFormat: "7V7",
    spaceConstraint: "QUARTER",
    numbersMin: 6,
    numbersMax: 8,
    goalsAvailable: 0,
    formationAttacking: "3-1",
    formationDefending: "2-1",
    expectedFullGoals: 0,
    allowUnopposed: true,
  }),
  fixture("A2", "A", "Warmup 4v4+2 neutrals, no full goal", {
    drillType: "WARMUP",
    ageGroup: "U10",
    fieldFormat: "7V7",
    spaceConstraint: "THIRD",
    numbersMin: 10,
    numbersMax: 10,
    goalsAvailable: 0,
    formationAttacking: "2-2 +2 neutral jokers who always play for the team in possession",
    formationDefending: "2-2",
    expectedFullGoals: 0,
  }),
  fixture("A3", "A", "Technical rondo, 6 to 8 players, 9v9-age quarter", {
    drillType: "TECHNICAL",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "QUARTER",
    numbersMin: 6,
    numbersMax: 8,
    goalsAvailable: 0,
    formationAttacking: "3-1",
    formationDefending: "2-1",
    expectedFullGoals: 0,
    allowUnopposed: true,
  }),
  fixture("A4", "A", "Technical 4v4 two mini-goals, 7v7 third", {
    drillType: "TECHNICAL",
    ageGroup: "U10",
    fieldFormat: "7V7",
    spaceConstraint: "THIRD",
    numbersMin: 8,
    numbersMax: 10,
    goalsAvailable: 0,
    formationAttacking: "2-2",
    formationDefending: "2-2",
    expectedFullGoals: 0,
  }),
  fixture("A5", "A", "Technical 4v4 two mini-goals, 9v9 half", {
    drillType: "TECHNICAL",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "HALF",
    numbersMin: 8,
    numbersMax: 10,
    goalsAvailable: 0,
    formationAttacking: "2-2",
    formationDefending: "2-2",
    expectedFullGoals: 0,
  }),
  fixture("B1", "B", "Tactical 7v7 one full goal, third", {
    drillType: "TACTICAL",
    ageGroup: "U10",
    fieldFormat: "7V7",
    spaceConstraint: "THIRD",
    numbersMin: 12,
    numbersMax: 14,
    goalsAvailable: 1,
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    expectedFullGoals: 1,
  }),
  fixture("B2", "B", "Tactical 7v7 one full goal, half", {
    drillType: "TACTICAL",
    ageGroup: "U10",
    fieldFormat: "7V7",
    spaceConstraint: "HALF",
    numbersMin: 12,
    numbersMax: 14,
    goalsAvailable: 1,
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    expectedFullGoals: 1,
  }),
  fixture("B3", "B", "Tactical 9v9 one full goal, third", {
    drillType: "TACTICAL",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "THIRD",
    numbersMin: 16,
    numbersMax: 18,
    goalsAvailable: 1,
    formationAttacking: "3-2-3",
    formationDefending: "3-3-2",
    expectedFullGoals: 1,
  }),
  fixture("B4", "B", "Tactical 9v9 one full goal, half", {
    drillType: "TACTICAL",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "HALF",
    numbersMin: 16,
    numbersMax: 18,
    goalsAvailable: 1,
    formationAttacking: "3-2-3",
    formationDefending: "3-3-2",
    expectedFullGoals: 1,
  }),
  fixture("B5", "B", "Tactical 11v11 one full goal, third", {
    drillType: "TACTICAL",
    ageGroup: "U14",
    fieldFormat: "11V11",
    spaceConstraint: "THIRD",
    numbersMin: 20,
    numbersMax: 22,
    goalsAvailable: 1,
    formationAttacking: "4-3-3",
    formationDefending: "4-4-2",
    expectedFullGoals: 1,
  }),
  fixture("B6", "B", "Technical finishing, 9v9 one full goal, third", {
    drillType: "TECHNICAL",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "THIRD",
    numbersMin: 10,
    numbersMax: 14,
    goalsAvailable: 1,
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    expectedFullGoals: 1,
  }),
  fixture("C1", "C", "Conditioned 7v7 two goals, full", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U10",
    fieldFormat: "7V7",
    spaceConstraint: "FULL",
    numbersMin: 12,
    numbersMax: 14,
    goalsAvailable: 2,
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    expectedFullGoals: 2,
    expectSpreadOnPitch: true,
  }),
  fixture("C2", "C", "Conditioned 7v7 two goals, half", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U10",
    fieldFormat: "7V7",
    spaceConstraint: "HALF",
    numbersMin: 12,
    numbersMax: 14,
    goalsAvailable: 2,
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    expectedFullGoals: 2,
  }),
  fixture("C3", "C", "Conditioned 9v9 two goals, full (D-PVG7 class)", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "FULL",
    numbersMin: 16,
    numbersMax: 18,
    goalsAvailable: 2,
    formationAttacking: "3-2-3",
    formationDefending: "3-3-2",
    expectedFullGoals: 2,
    expectSpreadOnPitch: true,
  }),
  fixture("C4", "C", "Conditioned 9v9 two goals, half", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "HALF",
    numbersMin: 16,
    numbersMax: 18,
    goalsAvailable: 2,
    formationAttacking: "3-2-3",
    formationDefending: "3-3-2",
    expectedFullGoals: 2,
  }),
  fixture("C5", "C", "Conditioned 11v11 two goals, full", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U14",
    fieldFormat: "11V11",
    spaceConstraint: "FULL",
    numbersMin: 20,
    numbersMax: 22,
    goalsAvailable: 2,
    formationAttacking: "4-3-3",
    formationDefending: "4-4-2",
    expectedFullGoals: 2,
    expectSpreadOnPitch: true,
  }),
  fixture("C6", "C", "Conditioned 9v9 one full goal, half", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "HALF",
    numbersMin: 16,
    numbersMax: 18,
    goalsAvailable: 1,
    formationAttacking: "3-2-3",
    formationDefending: "3-3-2",
    expectedFullGoals: 1,
  }),
  fixture("C7", "C", "Conditioned 7v7 no full goal, third", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U10",
    fieldFormat: "7V7",
    spaceConstraint: "THIRD",
    numbersMin: 12,
    numbersMax: 14,
    goalsAvailable: 0,
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    expectedFullGoals: 0,
  }),
  fixture("D1", "D", "Defending C3: 9v9 two goals, defensive third (D-8MJH class)", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "FULL",
    numbersMin: 16,
    numbersMax: 18,
    goalsAvailable: 2,
    formationAttacking: "3-2-3",
    formationDefending: "3-3-2",
    expectedFullGoals: 2,
    expectSpreadOnPitch: true,
    phase: "DEFENDING",
    zone: "DEFENSIVE_THIRD",
  }),
  fixture("D2", "D", "Defending B3: 9v9 one full goal, defensive third", {
    drillType: "TACTICAL",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "THIRD",
    numbersMin: 16,
    numbersMax: 18,
    goalsAvailable: 1,
    formationAttacking: "3-2-3",
    formationDefending: "3-3-2",
    expectedFullGoals: 1,
    phase: "DEFENDING",
    zone: "DEFENSIVE_THIRD",
  }),
  fixture("D3", "D", "Defending C3, USSF_D beginner density", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "FULL",
    numbersMin: 16,
    numbersMax: 18,
    goalsAvailable: 2,
    formationAttacking: "3-2-3",
    formationDefending: "3-3-2",
    expectedFullGoals: 2,
    expectSpreadOnPitch: true,
    phase: "DEFENDING",
    zone: "DEFENSIVE_THIRD",
    playerLevel: "BEGINNER",
    coachLevel: "USSF_D",
  }),
  fixture("D4", "D", "Defending C3, USSF_B+ advanced density", {
    drillType: "CONDITIONED_GAME",
    ageGroup: "U12",
    fieldFormat: "9V9",
    spaceConstraint: "FULL",
    numbersMin: 16,
    numbersMax: 18,
    goalsAvailable: 2,
    formationAttacking: "3-2-3",
    formationDefending: "3-3-2",
    expectedFullGoals: 2,
    expectSpreadOnPitch: true,
    phase: "DEFENDING",
    zone: "DEFENSIVE_THIRD",
    playerLevel: "ADVANCED",
    coachLevel: "USSF_B_PLUS",
  }),
];

export function fixturesForScene(scene: string | undefined): FirstPassFixture[] {
  const wanted = String(scene || "A").toUpperCase();
  if (wanted === "ALL") return FIRST_PASS_FIXTURES;
  return FIRST_PASS_FIXTURES.filter((row) => row.scene === wanted);
}

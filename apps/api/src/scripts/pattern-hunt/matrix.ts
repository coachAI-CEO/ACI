import type { FieldFormat } from "../../data/field-dimensions";
import { FIRST_PASS_FIXTURES, fixture, type FirstPassFixture, type FirstPassScene } from "../first-pass-diagrams/fixtures";

export type FaultKind =
  | "empty-formation"
  | "setup-text-only"
  | "dump-422"
  | "all-cb"
  | "yard-axis"
  | "phantom-gk"
  | "att-lr-swap"
  | "def-lr-swap"
  | "four-line"
  | "352"
  | "match-area"
  | "viewbox";

export type PatternHuntCell = FirstPassFixture & { fault?: FaultKind };

function ageFor(format: FieldFormat): string {
  if (format === "7V7") return "U10";
  if (format === "11V11") return "U14";
  return "U12";
}

function numsFor(format: FieldFormat, box = false, neu = false, rondo = false): { min: number; max: number } {
  if (rondo) return { min: 6, max: 8 };
  if (neu) return { min: 10, max: 10 };
  if (box) return { min: 8, max: 10 };
  if (format === "7V7") return { min: 12, max: 14 };
  if (format === "11V11") return { min: 20, max: 22 };
  return { min: 16, max: 18 };
}

function hunt(
  id: string,
  scene: FirstPassScene,
  label: string,
  args: {
    drillType: string;
    format: FieldFormat;
    space: string;
    goals: 0 | 1 | 2;
    att: string;
    def: string;
    phase?: string;
    zone?: string;
    box?: boolean;
    neu?: boolean;
    rondo?: boolean;
    unopposed?: boolean;
    spread?: boolean;
    fault?: FaultKind;
    min?: number;
    max?: number;
  }
): PatternHuntCell {
  const n = numsFor(args.format, args.box, args.neu, args.rondo);
  const cell = fixture(id, scene, label, {
    drillType: args.drillType,
    ageGroup: ageFor(args.format),
    fieldFormat: args.format,
    spaceConstraint: args.space,
    numbersMin: args.min ?? n.min,
    numbersMax: args.max ?? n.max,
    goalsAvailable: args.goals,
    formationAttacking: args.att,
    formationDefending: args.def,
    expectedFullGoals: args.goals,
    allowUnopposed: args.unopposed,
    expectSpreadOnPitch: args.spread,
    phase: args.phase,
    zone: args.zone,
  }) as PatternHuntCell;
  if (args.fault) cell.fault = args.fault;
  return cell;
}

const NEW_CELLS: PatternHuntCell[] = [
  hunt("A6", "A", "Rondo 9v9 quarter, no minis", {
    drillType: "WARMUP", format: "9V9", space: "QUARTER", goals: 0, att: "3-1", def: "2-1", rondo: true, unopposed: true,
  }),
  hunt("A7", "A", "4v4 minis on 11v11 third", {
    drillType: "TECHNICAL", format: "11V11", space: "THIRD", goals: 0, att: "2-2", def: "2-2", box: true,
  }),
  hunt("A8", "A", "5v5 even 7v7 third, opposite minis", {
    drillType: "WARMUP", format: "7V7", space: "THIRD", goals: 0, att: "2-2", def: "2-2", box: true, min: 10, max: 10,
  }),
  hunt("A9", "A", "6v6+2 neutrals 9v9 half", {
    drillType: "TECHNICAL", format: "9V9", space: "HALF", goals: 0, att: "2-2 +2 neutrals", def: "2-2", neu: true,
  }),
  hunt("A10", "A", "Unopposed finishing 7v7 quarter, 0 full", {
    drillType: "TECHNICAL", format: "7V7", space: "QUARTER", goals: 0, att: "3-1", def: "2-1", rondo: true, unopposed: true,
  }),
  hunt("A11", "A", "Rondo 7v7 third", {
    drillType: "WARMUP", format: "7V7", space: "THIRD", goals: 0, att: "3-1", def: "2-1", rondo: true, unopposed: true,
  }),
  hunt("A12", "A", "4v4 minis 9v9 quarter", {
    drillType: "TECHNICAL", format: "9V9", space: "QUARTER", goals: 0, att: "2-2", def: "2-2", box: true,
  }),
  hunt("A13", "A", "4v4+2 warmup 9v9 third", {
    drillType: "WARMUP", format: "9V9", space: "THIRD", goals: 0, att: "2-2 +2 neutrals", def: "2-2", neu: true,
  }),
  hunt("A14", "A", "4v4 minis 7v7 half", {
    drillType: "TECHNICAL", format: "7V7", space: "HALF", goals: 0, att: "2-2", def: "2-2", box: true,
  }),
  hunt("A15", "A", "4v4 minis 11v11 third warmup", {
    drillType: "WARMUP", format: "11V11", space: "THIRD", goals: 0, att: "2-2", def: "2-2", box: true,
  }),
  hunt("A16", "A", "Unopposed technical 9v9 third, 0 full", {
    drillType: "TECHNICAL", format: "9V9", space: "THIRD", goals: 0, att: "3-1", def: "2-1", rondo: true, unopposed: true,
  }),
  hunt("A17", "A", "5v5 even 7v7 quarter", {
    drillType: "WARMUP", format: "7V7", space: "QUARTER", goals: 0, att: "2-2", def: "2-2", box: true, min: 10, max: 10,
  }),
  hunt("A18", "A", "4v4 minis 11v11 half", {
    drillType: "TECHNICAL", format: "11V11", space: "HALF", goals: 0, att: "2-2", def: "2-2", box: true,
  }),

  hunt("B7", "B", "7v7 one-goal third 2-3-1 vs 3-2-1", {
    drillType: "TACTICAL", format: "7V7", space: "THIRD", goals: 1, att: "2-3-1", def: "3-2-1",
  }),
  hunt("B8", "B", "7v7 one-goal third defending", {
    drillType: "TACTICAL", format: "7V7", space: "THIRD", goals: 1, att: "2-3-1", def: "3-2-1",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("B9", "B", "7v7 one-goal half attacking", {
    drillType: "TACTICAL", format: "7V7", space: "HALF", goals: 1, att: "2-3-1", def: "3-2-1",
  }),
  hunt("B10", "B", "7v7 one-goal half defending", {
    drillType: "TACTICAL", format: "7V7", space: "HALF", goals: 1, att: "2-3-1", def: "3-2-1",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("B11", "B", "9v9 one-goal third conditioned 323/332", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "THIRD", goals: 1, att: "3-2-3", def: "3-3-2",
  }),
  hunt("B12", "B", "9v9 one-goal third defending 323/332", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "3-2-3", def: "3-3-2",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("B13", "B", "9v9 one-goal half defending", {
    drillType: "TACTICAL", format: "9V9", space: "HALF", goals: 1, att: "3-2-3", def: "3-3-2",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("B14", "B", "9v9 one-goal full attacking", {
    drillType: "TACTICAL", format: "9V9", space: "FULL", goals: 1, att: "3-2-3", def: "3-3-2",
  }),
  hunt("B15", "B", "9v9 one-goal half conditioned", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "HALF", goals: 1, att: "3-2-3", def: "3-3-2",
  }),
  hunt("B16", "B", "9v9 one-goal full defending", {
    drillType: "TACTICAL", format: "9V9", space: "FULL", goals: 1, att: "3-2-3", def: "3-3-2",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("B17", "B", "9v9 one-goal 2-3-2-1 vs 3-2-3", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "2-3-2-1", def: "3-2-3",
  }),
  hunt("B18", "B", "9v9 one-goal both 3-2-3", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "3-2-3", def: "3-2-3",
  }),
  hunt("B19", "B", "9v9 one-goal half 2-3-2-1 vs 3-3-2", {
    drillType: "TACTICAL", format: "9V9", space: "HALF", goals: 1, att: "2-3-2-1", def: "3-3-2",
  }),
  hunt("B20", "B", "9v9 one-goal flipped 3-3-2 vs 3-2-3", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "3-3-2", def: "3-2-3",
  }),
  hunt("B21", "B", "11v11 one-goal third 4-3-3 vs 4-4-2", {
    drillType: "TACTICAL", format: "11V11", space: "THIRD", goals: 1, att: "4-3-3", def: "4-4-2",
  }),
  hunt("B22", "B", "11v11 one-goal third defending", {
    drillType: "TACTICAL", format: "11V11", space: "THIRD", goals: 1, att: "4-3-3", def: "4-4-2",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("B23", "B", "11v11 one-goal half 4-3-3 vs 4-2-3-1", {
    drillType: "TACTICAL", format: "11V11", space: "HALF", goals: 1, att: "4-3-3", def: "4-2-3-1",
  }),
  hunt("B24", "B", "11v11 one-goal 3-5-2 vs 4-3-3", {
    drillType: "TACTICAL", format: "11V11", space: "THIRD", goals: 1, att: "3-5-2", def: "4-3-3",
  }),
  hunt("B25", "B", "11v11 one-goal half 4-3-3 vs 4-4-2", {
    drillType: "TACTICAL", format: "11V11", space: "HALF", goals: 1, att: "4-3-3", def: "4-4-2",
  }),
  hunt("B26", "B", "11v11 one-goal conditioned third", {
    drillType: "CONDITIONED_GAME", format: "11V11", space: "THIRD", goals: 1, att: "4-3-3", def: "4-4-2",
  }),
  hunt("B27", "B", "9v9 one-goal both 3-3-2", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "3-3-2", def: "3-3-2",
  }),
  hunt("B28", "B", "7v7 one-goal both 2-3-1", {
    drillType: "TACTICAL", format: "7V7", space: "THIRD", goals: 1, att: "2-3-1", def: "2-3-1",
  }),
  hunt("B29", "B", "7v7 one-goal both 3-2-1", {
    drillType: "TACTICAL", format: "7V7", space: "THIRD", goals: 1, att: "3-2-1", def: "3-2-1",
  }),
  hunt("B30", "B", "11v11 one-goal both 4-3-3", {
    drillType: "TACTICAL", format: "11V11", space: "THIRD", goals: 1, att: "4-3-3", def: "4-3-3",
  }),
  hunt("B31", "B", "11v11 one-goal flipped 4-4-2 vs 4-3-3", {
    drillType: "TACTICAL", format: "11V11", space: "THIRD", goals: 1, att: "4-4-2", def: "4-3-3",
  }),
  hunt("B32", "B", "9v9 one-goal half both 3-2-3", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "HALF", goals: 1, att: "3-2-3", def: "3-2-3",
  }),

  hunt("C8", "C", "9v9 two-goal both 3-2-3", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-2-3", spread: true,
  }),
  hunt("C9", "C", "9v9 two-goal transition 323/332", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-3-2",
    phase: "TRANSITION", zone: "MIDDLE_THIRD", spread: true,
  }),
  hunt("C10", "C", "9v9 two-goal tactical 323/332", {
    drillType: "TACTICAL", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-3-2", spread: true,
  }),
  hunt("C11", "C", "9v9 two-goal 2-3-2-1 vs 3-2-3", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "2-3-2-1", def: "3-2-3", spread: true,
  }),
  hunt("C12", "C", "7v7 two-goal full 231/321", {
    drillType: "CONDITIONED_GAME", format: "7V7", space: "FULL", goals: 2, att: "2-3-1", def: "3-2-1", spread: true,
  }),
  hunt("C13", "C", "7v7 two-goal both 2-3-1", {
    drillType: "CONDITIONED_GAME", format: "7V7", space: "FULL", goals: 2, att: "2-3-1", def: "2-3-1", spread: true,
  }),
  hunt("C14", "C", "7v7 two-goal half 231/321", {
    drillType: "CONDITIONED_GAME", format: "7V7", space: "HALF", goals: 2, att: "2-3-1", def: "3-2-1",
  }),
  hunt("C15", "C", "7v7 two-goal tactical full", {
    drillType: "TACTICAL", format: "7V7", space: "FULL", goals: 2, att: "2-3-1", def: "3-2-1", spread: true,
  }),
  hunt("C16", "C", "11v11 two-goal 4-3-3 vs 4-4-2", {
    drillType: "CONDITIONED_GAME", format: "11V11", space: "FULL", goals: 2, att: "4-3-3", def: "4-4-2", spread: true,
  }),
  hunt("C17", "C", "11v11 two-goal 4-3-3 vs 4-2-3-1", {
    drillType: "CONDITIONED_GAME", format: "11V11", space: "FULL", goals: 2, att: "4-3-3", def: "4-2-3-1", spread: true,
  }),
  hunt("C18", "C", "11v11 two-goal half 433/442", {
    drillType: "CONDITIONED_GAME", format: "11V11", space: "HALF", goals: 2, att: "4-3-3", def: "4-4-2",
  }),
  hunt("C19", "C", "11v11 two-goal 3-5-2 vs 4-3-3", {
    drillType: "TACTICAL", format: "11V11", space: "FULL", goals: 2, att: "3-5-2", def: "4-3-3", spread: true,
  }),
  hunt("C20", "C", "9v9 two-goal flipped 332 vs 323", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "3-3-2", def: "3-2-3", spread: true,
  }),
  hunt("C21", "C", "9v9 two-goal 2-3-2-1 vs 3-3-2", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "2-3-2-1", def: "3-3-2", spread: true,
  }),
  hunt("C22", "C", "9v9 two-goal half both 3-2-3", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "HALF", goals: 2, att: "3-2-3", def: "3-2-3",
  }),
  hunt("C23", "C", "9v9 two-goal transition to attack", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-3-2",
    phase: "TRANSITION_TO_ATTACK", zone: "MIDDLE_THIRD", spread: true,
  }),
  hunt("C24", "C", "9v9 two-goal tactical half", {
    drillType: "TACTICAL", format: "9V9", space: "HALF", goals: 2, att: "3-2-3", def: "3-3-2",
  }),

  hunt("D5", "D", "7v7 two-goal defending compact", {
    drillType: "CONDITIONED_GAME", format: "7V7", space: "FULL", goals: 2, att: "2-3-1", def: "3-2-1",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("D6", "D", "11v11 two-goal defending compact", {
    drillType: "CONDITIONED_GAME", format: "11V11", space: "FULL", goals: 2, att: "4-3-3", def: "4-4-2",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("D7", "D", "7v7 two-goal tactical defending", {
    drillType: "TACTICAL", format: "7V7", space: "FULL", goals: 2, att: "2-3-1", def: "3-2-1",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("D8", "D", "11v11 two-goal tactical defending", {
    drillType: "TACTICAL", format: "11V11", space: "FULL", goals: 2, att: "4-3-3", def: "4-4-2",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("D9", "D", "9v9 two-goal transition to defend", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-3-2",
    phase: "TRANSITION_TO_DEFEND", zone: "DEFENSIVE_THIRD",
  }),
  hunt("D10", "D", "9v9 two-goal transition defensive third", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-3-2",
    phase: "TRANSITION", zone: "DEFENSIVE_THIRD",
  }),
  hunt("D11", "D", "9v9 two-goal defending both 3-2-3", {
    drillType: "TACTICAL", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-2-3",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("D12", "D", "7v7 one-goal defending third", {
    drillType: "TACTICAL", format: "7V7", space: "THIRD", goals: 1, att: "2-3-1", def: "3-2-1",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("D13", "D", "11v11 one-goal defending third", {
    drillType: "TACTICAL", format: "11V11", space: "THIRD", goals: 1, att: "4-3-3", def: "4-4-2",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),
  hunt("D14", "D", "9v9 one-goal conditioned defending third", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "THIRD", goals: 1, att: "3-2-3", def: "3-3-2",
    phase: "DEFENDING", zone: "DEFENSIVE_THIRD",
  }),

  hunt("N1", "B", "Empty JSON formations, 9v9 one-goal inherit", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "3-2-3", def: "3-3-2",
    fault: "empty-formation",
  }),
  hunt("N2", "B", "Setup text 323 vs 332, JSON empty", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "", def: "",
    fault: "setup-text-only",
  }),
  hunt("N3", "C", "LLM 4-2-2 dump on 9v9 two-goal", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-3-2",
    spread: true, fault: "dump-422",
  }),
  hunt("N4", "B", "All DEF labeled CB, 9v9 one-goal", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "3-2-3", def: "3-3-2",
    fault: "all-cb",
  }),
  hunt("N5", "C", "Yard-axis positions 80x55 two-goal", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-3-2",
    spread: true, fault: "yard-axis",
  }),
  hunt("N6", "A", "Phantom GK on 0-full warmup", {
    drillType: "WARMUP", format: "7V7", space: "QUARTER", goals: 0, att: "3-1", def: "2-1",
    rondo: true, unopposed: true, fault: "phantom-gk",
  }),
  hunt("N7", "B", "ATT L/R swapped in JSON", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "3-2-3", def: "3-3-2",
    fault: "att-lr-swap",
  }),
  hunt("N8", "B", "DEF L/R swapped in JSON", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "3-2-3", def: "3-3-2",
    fault: "def-lr-swap",
  }),
  hunt("N9", "B", "4-2-3-1 four-line 11v11 one-goal", {
    drillType: "TACTICAL", format: "11V11", space: "THIRD", goals: 1, att: "4-2-3-1", def: "4-4-2",
    fault: "four-line",
  }),
  hunt("N10", "C", "3-5-2 wing-backs 11v11 two-goal", {
    drillType: "CONDITIONED_GAME", format: "11V11", space: "FULL", goals: 2, att: "3-5-2", def: "4-3-3",
    spread: true, fault: "352",
  }),
  hunt("N11", "C", "Match Area overlay two-goal", {
    drillType: "CONDITIONED_GAME", format: "9V9", space: "FULL", goals: 2, att: "3-2-3", def: "3-3-2",
    spread: true, fault: "match-area",
  }),
  hunt("N12", "B", "ViewBox origin lock 9v9 one-goal", {
    drillType: "TACTICAL", format: "9V9", space: "THIRD", goals: 1, att: "3-2-3", def: "3-3-2",
    fault: "viewbox",
  }),
];

export const PATTERN_HUNT_CELLS: PatternHuntCell[] = [...FIRST_PASS_FIXTURES, ...NEW_CELLS];

/** Live-generate subset: messy JSON, not mapper self-tests. */
export const PASS2_IDS = [
  "A1", "A2", "A4", "A6", "A9", "A13",
  "B1", "B3", "B5", "B6", "B11", "B12", "B17", "B18", "B21", "B23", "B24",
  "C1", "C3", "C5", "C8", "C11", "C12", "C16", "C17", "C19", "C20",
  "D1", "D2", "D5", "D6", "D9", "D11", "D12", "D13", "D14",
  "N1", "N3", "N9", "N10",
] as const;

if (PASS2_IDS.length !== 40) {
  throw new Error(`Pass 2 subset has ${PASS2_IDS.length} cells, expected 40`);
}
const huntIds = new Set(PATTERN_HUNT_CELLS.map((cell) => cell.id));
for (const id of PASS2_IDS) {
  if (!huntIds.has(id)) throw new Error(`Pass 2 id ${id} is not in the 100-cell matrix`);
}

if (PATTERN_HUNT_CELLS.length !== 100) {
  throw new Error(`Pattern hunt matrix has ${PATTERN_HUNT_CELLS.length} cells, expected 100`);
}

const seen = new Set<string>();
for (const cell of PATTERN_HUNT_CELLS) {
  if (seen.has(cell.id)) throw new Error(`Duplicate pattern-hunt id ${cell.id}`);
  seen.add(cell.id);
}

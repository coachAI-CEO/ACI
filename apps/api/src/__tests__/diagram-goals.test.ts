import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import {
  enforceDiagramGoalAvailability,
} from "../services/diagram-goals";
import { normalizeGoalkeeperPositions } from "../services/session";

function miniGoalDrill() {
  return {
    goalsAvailable: 0,
    goalMode: "MINI2",
    diagram: {
      teams: [
        { label: "Attack", count: 8 },
        { label: "Defend", count: 8 },
        { label: "GK", count: 2, color: "green" },
      ],
      players: [
        { id: "A1", team: "ATT", role: "ST", number: 9, x: 70, y: 50 },
        { id: "GKL", team: "GK", role: "GK", number: 1, x: 8, y: 50 },
        { id: "GKR", team: "DEF", role: "GK", number: 1, x: 92, y: 50 },
        { id: "D1", team: "DEF", role: "CB", number: 4, x: 30, y: 50 },
      ],
      goals: [
        { id: "MG1", type: "MINI", width: 5, x: 6, y: 38, teamAttacks: "DEF" },
        { id: "MG2", type: "MINI", width: 5, x: 6, y: 62, teamAttacks: "DEF" },
        { id: "MG3", type: "MINI", width: 5, x: 94, y: 38, teamAttacks: "ATT" },
        { id: "MG4", type: "MINI", width: 5, x: 94, y: 62, teamAttacks: "ATT" },
      ],
    },
  };
}

test("MINI2 diagrams drop keepers instead of parking them on puggs", () => {
  const drill = miniGoalDrill();
  drill.goalsAvailable = 0;
  enforceDiagramGoalAvailability(drill, { goalsAvailable: 0 });
  normalizeGoalkeeperPositions(drill.diagram);

  const keepers = drill.diagram.players.filter(
    (p: any) =>
      String(p.role || "").toUpperCase() === "GK" ||
      String(p.team || "").toUpperCase() === "GK"
  );
  expect(keepers).toHaveLength(0);
  expect(drill.diagram.teams.some((t: any) => String(t.label).toUpperCase() === "GK")).toBe(
    false
  );
  expect(drill.diagram.goals.every((g: any) => String(g.type).toUpperCase() === "MINI")).toBe(
    true
  );
});

test("goalsAvailable=0 demotes keepers even when the model already drew only minis", () => {
  const drill = miniGoalDrill();
  drill.goalsAvailable = 0;
  enforceDiagramGoalAvailability(drill, { goalsAvailable: 0 });
  expect(drill.diagram.players.some((p: any) => String(p.role).toUpperCase() === "GK")).toBe(
    false
  );
});

test("two full-size goals keep their goalkeepers", () => {
  const drill = {
    goalsAvailable: 2,
    diagram: {
      players: [
        { id: "GKL", team: "DEF", role: "GK", number: 1, x: 8, y: 50 },
        { id: "GKR", team: "ATT", role: "GK", number: 1, x: 92, y: 50 },
      ],
      goals: [
        { id: "G1", type: "BIG", width: 8, x: 6, y: 50, teamAttacks: "ATT" },
        { id: "G2", type: "BIG", width: 8, x: 94, y: 50, teamAttacks: "DEF" },
      ],
    },
  };
  enforceDiagramGoalAvailability(drill, { goalsAvailable: 2 });
  expect(drill.diagram.players.filter((p: any) => p.role === "GK")).toHaveLength(2);
});

test("goalsAvailable=2 adds the missing opposite full goal and keeps one GK each", () => {
  const drill = {
    goalsAvailable: 2,
    diagram: {
      players: [
        { id: "GK_ATT", team: "ATT", role: "GK", number: 1, x: 94, y: 27 },
        { id: "DEF_GK", team: "DEF", role: "GK", number: 99, x: 94, y: 27 },
        { id: "CB1", team: "ATT", role: "CB", number: 2, x: 25, y: 27 },
      ],
      goals: [
        { id: "G_DEF", type: "BIG", width: 8, x: 100, y: 27, teamAttacks: "DEF" },
      ],
    },
  };
  enforceDiagramGoalAvailability(drill, { goalsAvailable: 2 });
  expect(drill.diagram.goals.filter((g: any) => g.type === "BIG")).toHaveLength(2);
  const keepers = drill.diagram.players.filter((p: any) => p.role === "GK");
  expect(keepers).toHaveLength(2);
  const keeperXs = keepers.map((p: any) => Number(p.x)).sort((a: number, b: number) => a - b);
  expect(keeperXs[0]).toBeLessThan(30);
  expect(keeperXs[1]).toBeGreaterThan(70);
});

test("null goalsAvailable keeps a drawn full goal and one GK", () => {
  const drill = {
    goalsAvailable: null,
    diagram: {
      players: [
        { id: "GK1", team: "ATT", role: "GK", number: 1, x: 92, y: 50 },
        { id: "D6", team: "DEF", role: "GK", number: 14, x: 92, y: 50 },
        { id: "CB1", team: "ATT", role: "CB", number: 3, x: 25, y: 50 },
      ],
      goals: [{ id: "G1", type: "BIG", width: 8, x: 100, y: 50, teamAttacks: "ATT" }],
    },
  };
  enforceDiagramGoalAvailability(drill, { goalsAvailable: null });
  expect(drill.diagram.goals.filter((g: any) => g.type === "BIG")).toHaveLength(1);
  expect(drill.diagram.players.filter((p: any) => p.role === "GK")).toHaveLength(1);
});

test("drawer mapper paints a GK on the full goal and a GK on the mini-goal end", () => {
  const params = drillToDrawerParams({
    title: "9v9 Attacking Third Build-Up and Overload Play",
    json: {
      goalsAvailable: 1,
      organization: { area: { widthYards: 55, lengthYards: 80 } },
      diagram: {
        players: [
          { id: "GK_ATT", team: "ATT", role: "GK", number: 1, x: 94, y: 27 },
          { id: "DEF_GK", team: "DEF", role: "GK", number: 99, x: 94, y: 27 },
          { id: "CB1", team: "ATT", role: "CB", number: 2, x: 25, y: 27 },
          { id: "ST1", team: "ATT", role: "ST", number: 9, x: 65, y: 27 },
          { id: "CM1", team: "ATT", role: "CM", number: 8, x: 45, y: 40 },
        ],
        goals: [
          { id: "G_DEF", type: "BIG", width: 8, x: 100, y: 27, teamAttacks: "DEF" },
        ],
      },
    },
    drillType: "TACTICAL",
    durationMin: 25,
    rpeMin: 5,
    rpeMax: 7,
    numbersMin: 16,
    numbersMax: 18,
  });
  expect(params.goals.filter((g) => g.type === "full")).toHaveLength(1);
  const keepers = params.players.filter((p) => p.team === "gk");
  expect(keepers).toHaveLength(2);
  const xs = keepers.map((p) => p.x).sort((a, b) => a - b);
  expect(xs[0]).toBeLessThan(20);
  expect(xs[1]).toBeGreaterThan(80);
  expect(params.players.some((p) => p.x >= 88 && p.team !== "gk")).toBe(false);
  expect(params.goals.filter((g) => g.type === "mini" || g.type === "gate").length).toBeGreaterThanOrEqual(2);
});

test("drawer mapper does not paint GK tokens when every goal is mini", () => {
  const params = drillToDrawerParams({
    title: "Middle Third 9v9 Transition",
    json: miniGoalDrill(),
    drillType: "TACTICAL",
    durationMin: 25,
    rpeMin: 5,
    rpeMax: 7,
    numbersMin: 16,
    numbersMax: 18,
  });
  expect(params.players.some((p) => p.team === "gk")).toBe(false);
  expect(params.goals.every((g) => g.type === "mini")).toBe(true);
});

test("one-goal drill keeps only one GK on the full-size net, no dedicated mini-end keeper", () => {
  // Per limitKeepersToDrawnFullGoals's docstring: "1 full goal + opposite
  // minis -> GK only on the full-size net (mini-goals are outfield restarts,
  // no dedicated keeper)". pickPugGoalkeeper (which used to reposition a
  // second GK-role player to the mini-goal end) was deliberately removed --
  // a second GK-role player on a one-goal drill is now demoted/discarded,
  // not repositioned.
  const drill = {
    goalsAvailable: 1,
    diagram: {
      players: [
        { id: "att_gk", team: "ATT", role: "GK", number: 1, x: 94, y: 50 },
        { id: "att_cb", team: "ATT", role: "CB", number: 3, x: 25, y: 50 },
        { id: "def_gk", team: "DEF", role: "GK", number: 1, x: 94, y: 50 },
        { id: "def_cb", team: "DEF", role: "CB", number: 4, x: 85, y: 50 },
      ],
      goals: [{ id: "goal_main", type: "BIG", width: 8, x: 100, y: 50, teamAttacks: "ATT" }],
    },
  };
  enforceDiagramGoalAvailability(drill, { goalsAvailable: 1 });
  const keepers = drill.diagram.players.filter((p: any) => p.role === "GK");
  expect(keepers).toHaveLength(1);
  // The kept keeper defends the drawn full-size goal.
  expect(Number(keepers[0].x)).toBeGreaterThan(80);
});

test("one-goal drill turns a leftover in the net into the mini-end GK", () => {
  const params = drillToDrawerParams({
    title: "one full goal",
    json: {
      goalsAvailable: 1,
      organization: { area: { widthYards: 25, lengthYards: 35 } },
      diagram: {
        players: [
          { id: "p1", team: "ATT", role: "CB", x: 94, y: 50 },
          { id: "att_cb", team: "ATT", role: "CB", x: 25, y: 50 },
          { id: "def_gk", team: "DEF", role: "GK", number: 1, x: 94, y: 50 },
          { id: "def_cb", team: "DEF", role: "CB", x: 80, y: 50 },
        ],
        goals: [
          { id: "goal_main", type: "BIG", width: 8, x: 100, y: 50, teamAttacks: "ATT" },
          { id: "MG1", type: "MINI", x: 6, y: 38 },
          { id: "MG2", type: "MINI", x: 6, y: 62 },
        ],
      },
    },
    drillType: "TACTICAL",
    durationMin: 20,
    rpeMin: 5,
    rpeMax: 7,
    numbersMin: 12,
    numbersMax: 14,
  });
  const keepers = params.players.filter((p) => p.team === "gk");
  expect(keepers).toHaveLength(2);
  expect(keepers.some((p) => p.id === "p1" && p.x < 20)).toBe(true);
  expect(params.players.some((p) => p.x >= 88 && p.team !== "gk")).toBe(false);
});

test("zero full goals invents opposite minis and drops the endline GK token", () => {
  const drill = {
    goalsAvailable: 0,
    diagram: {
      players: [
        { id: "att_gk", team: "ATT", role: "GK", number: 1, x: 94, y: 50 },
        { id: "att_cb", team: "ATT", role: "CB", number: 2, x: 25, y: 50 },
        { id: "def_cb", team: "DEF", role: "CB", number: 8, x: 80, y: 50 },
      ],
      goals: [],
    },
  };
  enforceDiagramGoalAvailability(drill, { goalsAvailable: 0 });
  expect(drill.diagram.players.some((p: any) => p.id === "att_gk")).toBe(false);
  expect(drill.diagram.goals.filter((g: any) => String(g.type).toUpperCase() === "MINI").length).toBeGreaterThanOrEqual(2);
});

function boxPlayers(att: number, def: number, neutrals = 0) {
  const players: any[] = [];
  for (let i = 0; i < att; i++) players.push({ id: `a${i}`, team: "ATT", role: "CB", x: 30, y: 20 + i * 15 });
  for (let i = 0; i < def; i++) players.push({ id: `d${i}`, team: "DEF", role: "CB", x: 80, y: 20 + i * 15 });
  for (let i = 0; i < neutrals; i++) players.push({ id: `n${i}`, team: "NEUTRAL", role: "NT", x: 50, y: 20 + i * 40 });
  return players;
}

test("warmup with neutrals puts mini-goals on opposite ends", () => {
  const params = drillToDrawerParams({
    title: "4v4+2 neutrals",
    json: {
      goalsAvailable: 0,
      organization: { area: { widthYards: 25, lengthYards: 30 } },
      diagram: {
        players: boxPlayers(4, 4, 2),
        goals: [
          { id: "g1", type: "MINI", x: 100, y: 40 },
          { id: "g2", type: "MINI", x: 100, y: 60 },
        ],
      },
    },
    drillType: "WARMUP",
    durationMin: 20,
    rpeMin: 4,
    rpeMax: 6,
    numbersMin: 10,
    numbersMax: 10,
  });
  const minis = params.goals.filter((g) => g.type === "mini");
  expect(minis).toHaveLength(2);
  const xs = minis.map((g) => g.x).sort((a, b) => a - b);
  expect(xs[0]).toBeLessThan(20);
  expect(xs[1]).toBeGreaterThan(80);
});

test("technical 4v4 puts mini-goals on opposite ends", () => {
  const params = drillToDrawerParams({
    title: "4v4 two mini-goals",
    json: {
      goalsAvailable: 0,
      organization: { area: { widthYards: 25, lengthYards: 35 } },
      diagram: {
        players: boxPlayers(4, 4),
        goals: [
          { id: "g1", type: "MINI", x: 100, y: 10 },
          { id: "g2", type: "MINI", x: 100, y: 90 },
        ],
      },
    },
    drillType: "TECHNICAL",
    durationMin: 20,
    rpeMin: 4,
    rpeMax: 6,
    numbersMin: 8,
    numbersMax: 8,
  });
  const minis = params.goals.filter((g) => g.type === "mini");
  expect(minis).toHaveLength(2);
  const xs = minis.map((g) => g.x).sort((a, b) => a - b);
  expect(xs[0]).toBeLessThan(20);
  expect(xs[1]).toBeGreaterThan(80);
});

test("technical rondo drops mini-goals so it is not a 4v4 finishing picture", () => {
  const params = drillToDrawerParams({
    title: "rondo 6 to 8 players",
    json: {
      goalsAvailable: 0,
      organization: { area: { widthYards: 20, lengthYards: 25 } },
      diagram: {
        players: boxPlayers(4, 3),
        goals: [
          { id: "MG-LEFT", type: "MINI", x: 6, y: 50 },
          { id: "MG-RIGHT", type: "MINI", x: 94, y: 50 },
        ],
        areas: [{ label: "Final-Third Scoring Zone", x: 60, y: 20, width: 30, height: 60 }],
      },
    },
    drillType: "TECHNICAL",
    durationMin: 20,
    rpeMin: 4,
    rpeMax: 6,
    numbersMin: 6,
    numbersMax: 8,
  });
  expect(params.goals.filter((g) => g.type === "mini")).toHaveLength(0);
  expect(params.zones.some((z) => /scoring|finish/i.test(z.label || ""))).toBe(false);
});

test("11v11 third overwrites a 40x35 box to 40x80", () => {
  const drill: any = {
    fieldFormat: "11V11",
    spaceConstraint: "THIRD",
    drillType: "TACTICAL",
    goalsAvailable: 1,
    organization: { area: { lengthYards: 40, widthYards: 35, notes: "attacking third" } },
    diagram: { players: [], goals: [{ type: "FULL", x: 94, y: 50 }] },
  };
  enforceDiagramGoalAvailability(drill, {
    goalsAvailable: 1,
    fieldFormat: "11V11",
    spaceConstraint: "THIRD",
    drillType: "TACTICAL",
  });
  expect(drill.organization.area.lengthYards).toBe(40);
  expect(drill.organization.area.widthYards).toBe(80);
});

test("warmup rondo keeps a small box", () => {
  const drill: any = {
    fieldFormat: "7V7",
    spaceConstraint: "QUARTER",
    drillType: "WARMUP",
    goalsAvailable: 0,
    organization: { area: { lengthYards: 20, widthYards: 15 } },
    diagram: { players: [], goals: [] },
  };
  enforceDiagramGoalAvailability(drill, {
    goalsAvailable: 0,
    fieldFormat: "7V7",
    spaceConstraint: "QUARTER",
    drillType: "WARMUP",
  });
  expect(drill.organization.area.widthYards).toBe(15);
  expect(drill.organization.area.lengthYards).toBe(20);
});

test("mapper draws 11v11 third as 40x80 even when JSON says 40x35", () => {
  const params = drillToDrawerParams({
    title: "11v11 third",
    json: {
      fieldFormat: "11V11",
      spaceConstraint: "THIRD",
      goalsAvailable: 1,
      organization: { area: { lengthYards: 40, widthYards: 35 } },
      diagram: {
        players: [
          { id: "gk1", team: "GK", role: "GK", x: 92, y: 50 },
          { id: "a1", team: "ATT", role: "ST", x: 70, y: 50 },
          { id: "d1", team: "DEF", role: "CB", x: 80, y: 50 },
        ],
        goals: [{ id: "g1", type: "FULL", x: 94, y: 50 }],
      },
    },
    drillType: "TACTICAL",
    durationMin: 20,
    rpeMin: 4,
    rpeMax: 7,
    numbersMin: 20,
    numbersMax: 22,
    spaceConstraint: "THIRD",
  } as any);
  expect(params.lengthYards).toBe(40);
  expect(params.widthYards).toBe(80);
});

test("7v7 one-full pads 6v5 to 6v6 and keeps defenders out of the six-yard box", () => {
  const params = drillToDrawerParams({
    title: "7v7 third",
    json: {
      fieldFormat: "7V7",
      spaceConstraint: "THIRD",
      goalsAvailable: 1,
      formationAttacking: "2-3-1",
      formationDefending: "3-2-1",
      organization: { area: { lengthYards: 22, widthYards: 45 } },
      diagram: {
        players: [
          { id: "att_gk", team: "ATT", role: "GK", x: 12, y: 50 },
          { id: "att_lcb", team: "ATT", role: "LCB", x: 22, y: 32 },
          { id: "att_rcb", team: "ATT", role: "RCB", x: 22, y: 68 },
          { id: "att_lm", team: "ATT", role: "LM", x: 42, y: 18 },
          { id: "att_cm", team: "ATT", role: "CM", x: 38, y: 50 },
          { id: "att_rm", team: "ATT", role: "RM", x: 42, y: 82 },
          { id: "att_st", team: "ATT", role: "ST", x: 65, y: 50 },
          { id: "def_st", team: "DEF", role: "ST", x: 78, y: 50 },
          { id: "def_ldm", team: "DEF", role: "LDM", x: 84, y: 62 },
          { id: "def_rdm", team: "DEF", role: "RDM", x: 84, y: 38 },
          { id: "def_lcb", team: "DEF", role: "LCB", x: 92, y: 70 },
          { id: "def_rcb", team: "DEF", role: "RCB", x: 92, y: 30 },
          { id: "def_gk", team: "DEF", role: "GK", x: 94, y: 50 },
        ],
        goals: [
          { id: "g1", type: "FULL", x: 94, y: 50 },
          { id: "mg1", type: "MINI", x: 6, y: 38 },
          { id: "mg2", type: "MINI", x: 6, y: 62 },
        ],
      },
    },
    drillType: "TACTICAL",
    durationMin: 20,
    rpeMin: 4,
    rpeMax: 7,
    numbersMin: 12,
    numbersMax: 14,
    spaceConstraint: "THIRD",
  } as any);
  const attack = params.players.filter((p) => p.team === "home");
  const defend = params.players.filter((p) => p.team === "away");
  const gk = params.players.filter((p) => p.team === "gk");
  expect(attack).toHaveLength(6);
  expect(defend).toHaveLength(6);
  expect(gk).toHaveLength(2);
  expect(defend.every((p) => p.x < 78)).toBe(true);
  const midXs = new Set(attack.filter((p) => /LM|CM|RM/i.test(p.role)).map((p) => Math.round(p.x)));
  expect(midXs.size).toBeGreaterThan(1);
});

test("11v11 defending 4-4-2 is a compact flat four and two-up, not touchline wingers", () => {
  const params = drillToDrawerParams({
    title: "11v11 third",
    json: {
      fieldFormat: "11V11",
      spaceConstraint: "THIRD",
      goalsAvailable: 1,
      formationAttacking: "4-3-3",
      formationDefending: "4-4-2",
      organization: { area: { lengthYards: 40, widthYards: 80 } },
      diagram: {
        players: [
          { id: "att_gk", team: "ATT", role: "GK", x: 12, y: 50 },
          { id: "def_gk", team: "DEF", role: "GK", x: 94, y: 50 },
          ...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, team: "ATT", role: "CM", x: 30, y: 20 + i * 6 })),
          ...Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, team: "DEF", role: "CM", x: 70, y: 20 + i * 6 })),
        ],
        goals: [
          { id: "g1", type: "FULL", x: 94, y: 50 },
          { id: "mg1", type: "MINI", x: 6, y: 38 },
          { id: "mg2", type: "MINI", x: 6, y: 62 },
        ],
      },
    },
    drillType: "TACTICAL",
    durationMin: 20,
    rpeMin: 4,
    rpeMax: 7,
    numbersMin: 20,
    numbersMax: 22,
    spaceConstraint: "THIRD",
  } as any);
  const defend = params.players.filter((p) => p.team === "away");
  const back = defend.filter((p) => /^(LB|RB|CB)$/i.test(p.role));
  const mid = defend.filter((p) => /^(LM|RM|CM)$/i.test(p.role));
  const front = defend.filter((p) => /^ST$/i.test(p.role));
  expect(back).toHaveLength(4);
  expect(mid).toHaveLength(4);
  expect(front).toHaveLength(2);
  const midXs = mid.map((p) => p.x);
  expect(Math.max(...midXs) - Math.min(...midXs)).toBeLessThan(6);
  expect(Math.abs(front[0].x - front[1].x)).toBeLessThan(6);
  expect(Math.abs(front[0].y - front[1].y)).toBeLessThan(28);
  const minBack = Math.min(...back.map((p) => p.x));
  const maxFront = Math.max(...front.map((p) => p.x));
  expect(minBack).toBeGreaterThan(Math.max(...midXs));
  expect(Math.max(...midXs)).toBeGreaterThan(maxFront);
  expect(Math.max(...defend.map((p) => p.y))).toBeLessThan(82);
  expect(Math.min(...defend.map((p) => p.y))).toBeGreaterThan(18);
});

test("attacking LB/LM sit on their GK's left, not the right", () => {
  const params = drillToDrawerParams({
    title: "9v9 defending third",
    json: {
      fieldFormat: "9V9",
      spaceConstraint: "FULL",
      goalsAvailable: 2,
      organization: { area: { lengthYards: 80, widthYards: 55 } },
      diagram: {
        players: [
          { id: "G1", team: "DEF", role: "GK", x: 6, y: 50 },
          { id: "G2", team: "ATT", role: "GK", x: 94, y: 50 },
          { id: "A-LB", team: "ATT", role: "LB", x: 20, y: 75 },
          { id: "A-RB", team: "ATT", role: "RB", x: 20, y: 25 },
          { id: "A-LM", team: "ATT", role: "LM", x: 40, y: 70 },
          { id: "D-LB", team: "DEF", role: "LB", x: 80, y: 75 },
          { id: "D-RB", team: "DEF", role: "RB", x: 80, y: 25 },
        ],
        goals: [
          { id: "GL", type: "BIG", x: 0, y: 50 },
          { id: "GR", type: "BIG", x: 100, y: 50 },
        ],
      },
    },
    drillType: "CONDITIONED_GAME",
    durationMin: 25,
    rpeMin: 6,
    rpeMax: 8,
    numbersMin: 16,
    numbersMax: 18,
    spaceConstraint: "FULL",
  } as any);
  const attLb = params.players.find((player) => player.team === "home" && /^LB$/i.test(player.role));
  const attRb = params.players.find((player) => player.team === "home" && /^RB$/i.test(player.role));
  const attLw = params.players.find((player) => player.team === "home" && /^LW$/i.test(player.role));
  const defLb = params.players.find((player) => player.team === "away" && /^LB$/i.test(player.role));
  expect(attLb?.y).toBeLessThan(50);
  expect(attRb?.y).toBeGreaterThan(50);
  expect(attLw?.y).toBeLessThan(50);
  expect(defLb?.y).toBeGreaterThan(50);
});

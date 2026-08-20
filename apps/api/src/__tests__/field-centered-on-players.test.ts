import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { looksLikeYardAxis, playerClusterCentered } from "../data/field-dimensions";
import { scorePicture } from "../scripts/first-pass-diagrams/score";
import { FIRST_PASS_FIXTURES } from "../scripts/first-pass-diagrams/fixtures";
import { VISUAL_FRAME_RULE } from "../scripts/first-pass-diagrams/visual-qa";

test("yard-space 9v9 width (y=8..48 on 55yd) is not percent-50", () => {
  const ys = [8, 12, 20, 27, 35, 42, 48, 27, 27];
  expect(looksLikeYardAxis(ys, 55)).toBe(true);
  expect(looksLikeYardAxis([18, 32, 50, 68, 82], 45)).toBe(false);
  expect(looksLikeYardAxis([20, 26, 32, 38, 50, 62, 68, 74], 80)).toBe(false);
});

test("9v9 two-goal yard Y is remapped so the field is centered on the players", () => {
  const params = drillToDrawerParams({
    title: "9v9 two goal",
    json: {
      fieldFormat: "9V9",
      spaceConstraint: "FULL",
      goalsAvailable: 2,
      organization: { area: { lengthYards: 80, widthYards: 55 } },
      diagram: {
        players: [
          { id: "GK1", team: "DEF", role: "GK", x: 94, y: 27 },
          { id: "CB1", team: "ATT", role: "CB", x: 25, y: 27 },
          { id: "LB1", team: "ATT", role: "LB", x: 25, y: 12 },
          { id: "RB1", team: "ATT", role: "RB", x: 25, y: 42 },
          { id: "CM1", team: "ATT", role: "CM", x: 45, y: 20 },
          { id: "CM2", team: "ATT", role: "CM", x: 45, y: 35 },
          { id: "LW1", team: "ATT", role: "LW", x: 65, y: 12 },
          { id: "ST1", team: "ATT", role: "ST", x: 65, y: 27 },
          { id: "RW1", team: "ATT", role: "RW", x: 65, y: 42 },
          { id: "DEF_GK", team: "ATT", role: "GK", x: 6, y: 27 },
          { id: "DEF_CB1", team: "DEF", role: "CB", x: 75, y: 20 },
          { id: "DEF_CB2", team: "DEF", role: "CB", x: 75, y: 35 },
          { id: "DEF_LB", team: "DEF", role: "LB", x: 75, y: 8 },
          { id: "DEF_RB", team: "DEF", role: "RB", x: 75, y: 48 },
          { id: "DEF_CM1", team: "DEF", role: "CM", x: 55, y: 20 },
          { id: "DEF_CM2", team: "DEF", role: "CM", x: 55, y: 35 },
          { id: "DEF_ST1", team: "DEF", role: "ST", x: 35, y: 20 },
          { id: "DEF_ST2", team: "DEF", role: "ST", x: 35, y: 35 },
        ],
        goals: [
          { id: "G_ATT", type: "BIG", x: 0, y: 27 },
          { id: "G_DEF", type: "BIG", x: 100, y: 27 },
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

  const width = playerClusterCentered(params.players, "y");
  const length = playerClusterCentered(params.players, "x");
  expect(width.ok).toBe(true);
  expect(length.ok).toBe(true);
  const ys = params.players.filter((p) => p.team !== "gk").map((p) => p.y);
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(50);
});

test("frozen picture fails a sideline-shifted player cluster", () => {
  const c3 = FIRST_PASS_FIXTURES.find((f) => f.id === "C3")!;
  const scored = scorePicture(
    {
      players: [
        { id: "a", team: "home", role: "ST", x: 40, y: 12, number: 9 },
        { id: "b", team: "home", role: "CM", x: 40, y: 18, number: 8 },
        { id: "c", team: "home", role: "CB", x: 40, y: 22, number: 4 },
        { id: "d", team: "away", role: "ST", x: 60, y: 14, number: 9 },
        { id: "e", team: "away", role: "CM", x: 60, y: 20, number: 8 },
        { id: "f", team: "away", role: "CB", x: 60, y: 24, number: 4 },
        { id: "g", team: "gk", role: "GK", x: 8, y: 18, number: 1 },
        { id: "h", team: "gk", role: "GK", x: 92, y: 18, number: 1 },
      ],
      goals: [
        { id: "1", type: "full", x: 0, y: 18, width: 8 },
        { id: "2", type: "full", x: 100, y: 18, width: 8 },
      ],
    } as any,
    c3
  );
  expect(scored.ok).toBe(false);
  expect(scored.issues.join(" ")).toMatch(/centered on players/);
});

test("visual QA contract requires the field to be centered on the players", () => {
  expect(VISUAL_FRAME_RULE).toMatch(/CENTERED on the players/i);
});

test("one-full-goal yard Y does not drag the pug GK onto a touchline", () => {
  const params = drillToDrawerParams({
    title: "9v9 Attacking Third Build-Up and Overload Play",
    json: {
      fieldFormat: "9V9",
      spaceConstraint: "FULL",
      goalsAvailable: 1,
      organization: { area: { lengthYards: 80, widthYards: 55 } },
      diagram: {
        players: [
          { id: "GK_ATT", team: "ATT", role: "GK", number: 1, x: 94, y: 27 },
          { id: "CB1", team: "ATT", role: "CB", x: 25, y: 27 },
          { id: "LB1", team: "ATT", role: "LB", x: 25, y: 10 },
          { id: "RB1", team: "ATT", role: "RB", x: 25, y: 45 },
          { id: "CM1", team: "ATT", role: "CM", x: 45, y: 20 },
          { id: "ST1", team: "ATT", role: "ST", x: 65, y: 27 },
          { id: "DEF_GK", team: "DEF", role: "GK", number: 1, x: 94, y: 27 },
          { id: "DEF_CB1", team: "DEF", role: "CB", x: 75, y: 20 },
          { id: "DEF_LB", team: "DEF", role: "LB", x: 75, y: 8 },
          { id: "DEF_RB", team: "DEF", role: "RB", x: 75, y: 48 },
          { id: "DEF_ST1", team: "DEF", role: "ST", x: 35, y: 20 },
        ],
        goals: [{ id: "G_DEF", type: "BIG", width: 8, x: 100, y: 27 }],
      },
    },
    drillType: "TACTICAL",
    durationMin: 25,
    rpeMin: 5,
    rpeMax: 7,
    numbersMin: 16,
    numbersMax: 18,
    spaceConstraint: "FULL",
  } as any);

  const minis = params.goals.filter((goal) => goal.type === "mini" || goal.type === "gate");
  expect(minis).toHaveLength(2);
  expect(minis.every((goal) => goal.x < 20)).toBe(true);
  expect(minis.map((goal) => goal.y).sort((a, b) => a - b)).toEqual([38, 62]);
  const gks = params.players.filter((player) => player.team === "gk");
  expect(gks).toHaveLength(2);
  const pug = gks.find((player) => player.x < 22);
  expect(pug).toBeTruthy();
  expect(pug!.y).toBeGreaterThan(40);
  expect(pug!.y).toBeLessThan(60);
  const b3 = FIRST_PASS_FIXTURES.find((f) => f.id === "B3")!;
  const picture = scorePicture(params, { ...b3, expectedFullGoals: 1 });
  expect(picture.issues.join(" ")).not.toMatch(/mini-goal end/);
});

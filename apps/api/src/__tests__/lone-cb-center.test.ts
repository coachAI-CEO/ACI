import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { isCenterBackRole } from "../data/field-dimensions";
import { scorePicture } from "../scripts/first-pass-diagrams/score";
import { FIRST_PASS_FIXTURES } from "../scripts/first-pass-diagrams/fixtures";

test("isCenterBackRole matches CB/LCB/RCB/CCB only", () => {
  expect(isCenterBackRole("CB")).toBe(true);
  expect(isCenterBackRole("RCB")).toBe(true);
  expect(isCenterBackRole("LCB_DEF")).toBe(true);
  expect(isCenterBackRole("CCB")).toBe(true);
  expect(isCenterBackRole("LB")).toBe(false);
  expect(isCenterBackRole("RB")).toBe(false);
  expect(isCenterBackRole("CM")).toBe(false);
});

test("technical finishing with one RCB puts that CB on the center axis", () => {
  const params = drillToDrawerParams({
    title: "Finishing",
    json: {
      fieldFormat: "9V9",
      spaceConstraint: "THIRD",
      goalsAvailable: 1,
      formationAttacking: "2-3-1",
      formationDefending: "3-2-1",
      organization: { area: { lengthYards: 27, widthYards: 55 } },
      diagram: {
        players: [
          { id: "GK1", team: "ATT", role: "GK", x: 12, y: 50 },
          { id: "RCB", team: "ATT", role: "RCB", x: 25, y: 70 },
          { id: "LM", team: "ATT", role: "LM", x: 45, y: 20 },
          { id: "CM", team: "ATT", role: "CM", x: 45, y: 50 },
          { id: "RM", team: "ATT", role: "RM", x: 45, y: 80 },
          { id: "ST", team: "ATT", role: "ST", x: 70, y: 50 },
          { id: "GK2", team: "DEF", role: "GK", x: 94, y: 50 },
          { id: "LCB", team: "DEF", role: "LCB", x: 80, y: 70 },
          { id: "CCB", team: "DEF", role: "CCB", x: 85, y: 50 },
          { id: "RCB2", team: "DEF", role: "RCB", x: 80, y: 30 },
          { id: "LDM", team: "DEF", role: "LDM", x: 65, y: 65 },
          { id: "RDM", team: "DEF", role: "RDM", x: 65, y: 35 },
          { id: "DST", team: "DEF", role: "ST", x: 55, y: 50 },
        ],
        goals: [
          { id: "FULL", type: "full", x: 100, y: 50, width: 8 },
          { id: "M1", type: "mini", x: 6, y: 38, width: 5 },
          { id: "M2", type: "mini", x: 6, y: 62, width: 5 },
        ],
      },
    },
    drillType: "TECHNICAL",
    durationMin: 20,
    rpeMin: 4,
    rpeMax: 7,
    numbersMin: 10,
    numbersMax: 14,
    spaceConstraint: "THIRD",
  } as any);

  const attCbs = params.players.filter((p) => p.team === "home" && isCenterBackRole(p.role));
  expect(attCbs).toHaveLength(1);
  expect(attCbs[0].role).toBe("CB");
  expect(attCbs[0].y).toBe(50);

  // Technical finishing to a full goal with no stated opposition drops the DEF
  // side (see drill-shape-lock "technical one-goal drops opposition"). The lone
  // CB that must not be left off-axis is the ATT one, asserted above.
  const defCbs = params.players.filter((p) => p.team === "away" && isCenterBackRole(p.role));
  expect(defCbs.length).toBe(0);

  const b6 = FIRST_PASS_FIXTURES.find((f) => f.id === "B6")!;
  const scored = scorePicture(params, b6);
  expect(scored.issues.filter((issue) => /lone CB/.test(issue))).toEqual([]);
});

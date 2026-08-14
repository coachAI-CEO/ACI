import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import {
  enforceDiagramGoalAvailability,
} from "../services/diagram-goals";
import { normalizeGoalkeeperPositions } from "../services/session";

function miniGoalDrill() {
  return {
    goalsAvailable: 2,
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
  enforceDiagramGoalAvailability(drill, { goalsAvailable: 2 });
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

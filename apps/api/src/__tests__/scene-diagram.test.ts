import { buildSceneCard, inferScenePicture } from "../services/scene-card";
import { extractScene } from "../services/scene-document";
import { pinGoalsToEnds } from "../services/scene-space";
import {
  generateDrillDiagramSvg,
  placementForStoredPicture,
  resolveDiagramPlacement,
} from "../services/drill-diagram-svg";

const originalPlacement = process.env.DIAGRAM_PLACEMENT;
const originalEngine = process.env.DIAGRAM_SVG_ENGINE;

afterEach(() => {
  if (originalPlacement === undefined) delete process.env.DIAGRAM_PLACEMENT;
  else process.env.DIAGRAM_PLACEMENT = originalPlacement;
  if (originalEngine === undefined) delete process.env.DIAGRAM_SVG_ENGINE;
  else process.env.DIAGRAM_SVG_ENGINE = originalEngine;
});

test("buildSceneCard omits json.diagram coordinates", () => {
  const card = buildSceneCard({
    title: "2v1 on the right flank",
    drillType: "TECHNICAL",
    coachLevel: "USSF_C",
    numbersMin: 3,
    numbersMax: 4,
    json: {
      description: "2v1 to a mini goal on the right flank. Named 2v1, not a leftover squad.",
      goalsAvailable: 0,
      diagram: {
        players: [
          { id: "A1", x: 12.5, y: 81, role: "ST" },
          { id: "D1", x: 40, y: 20, role: "CB" },
        ],
      },
    },
  });
  expect(card.card).toMatch(/2v1/);
  expect(card.card).not.toMatch(/12\.5/);
  expect(card.card).not.toMatch(/"x"\s*:/);
  expect(card.picture).toBe("center");
});

test("inferScenePicture tags rondo, channel, and switch — not press-as-unit", () => {
  expect(inferScenePicture("4v1 rondo in a square", "WARMUP")).toBe("rondo");
  expect(inferScenePicture("1v1 to a mini goal", "TECHNICAL")).toBe("center");
  expect(inferScenePicture("2v1 on the right flank", "TECHNICAL")).toBe("center");
  expect(inferScenePicture("3v2 channel to mini goals", "TECHNICAL")).toBe("center");
  expect(inferScenePicture("3v2 in the final third", "TECHNICAL")).toBeUndefined();
  expect(inferScenePicture("Switch the point of attack to the weak-side", "SSG")).toBe("matchup");
  expect(inferScenePicture("Press as a unit after the trigger", "SSG")).toBeUndefined();
});

test("extractScene reads fenced JSON with at least two players", () => {
  const scene = extractScene(`\`\`\`json
{"note":"2v1","players":[{"id":"A1","x":40,"y":50},{"id":"D1","x":60,"y":50}]}
\`\`\``);
  expect(scene.players).toHaveLength(2);
  expect(scene.note).toBe("2v1");
});

test("extractScene rejects a dump with no players", () => {
  expect(() => extractScene(`{"note":"empty","players":[]}`)).toThrow(/players/);
});

test("pinGoalsToEnds parks full nets on the left and right at y=50", () => {
  const pinned = pinGoalsToEnds([
    { id: "g1", type: "full", x: 10, y: 12, width: 8 },
    { id: "g2", type: "full", x: 90, y: 88, width: 8 },
  ]);
  expect(pinned.map((g) => ({ x: g.x, y: g.y, type: g.type }))).toEqual([
    { x: 0, y: 50, type: "full" },
    { x: 100, y: 50, type: "full" },
  ]);
});

test("resolveDiagramPlacement defaults to scene even if Render still has deterministic engine", () => {
  delete process.env.DIAGRAM_PLACEMENT;
  process.env.DIAGRAM_SVG_ENGINE = "deterministic";
  expect(resolveDiagramPlacement()).toBe("scene");
  process.env.DIAGRAM_PLACEMENT = "compiler";
  expect(resolveDiagramPlacement()).toBe("compiler");
  expect(resolveDiagramPlacement("scene")).toBe("scene");
});

test("placementForStoredPicture keeps implicit vault redraws on the compiler", () => {
  expect(placementForStoredPicture(false, true)).toBe("compiler");
  expect(placementForStoredPicture(true, true)).toBeUndefined();
  expect(placementForStoredPicture(false, false)).toBeUndefined();
});

test("compiler placement paints without calling the scene model", async () => {
  const result = await generateDrillDiagramSvg(
    {
      title: "Back line passing",
      drillType: "TECHNICAL",
      durationMin: 12,
      rpeMin: 4,
      rpeMax: 6,
      numbersMin: 8,
      numbersMax: 10,
      spaceConstraint: "HALF",
      coachLevel: "USSF_D",
      json: {
        description: "Pass along the back line.",
        goalsAvailable: 0,
        fieldFormat: "9V9",
        diagram: {
          players: [
            { id: "A1", team: "ATT", role: "CB", x: 30, y: 40 },
            { id: "A2", team: "ATT", role: "CB", x: 30, y: 60 },
            { id: "D1", team: "DEF", role: "ST", x: 55, y: 50 },
          ],
          goals: [],
        },
      },
    },
    { placement: "compiler" }
  );
  expect(result.model).toBe("deterministic");
  expect(result.modelFallback).toBe(false);
  expect(result.scene).toBeUndefined();
  expect(result.svg).toMatch(/<svg/i);
});

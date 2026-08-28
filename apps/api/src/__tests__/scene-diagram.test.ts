import {
  buildSceneCard,
  inferScenePicture,
  isSubSquadPicture,
  namedRoster,
  reconcileCardCounts,
} from "../services/scene-card";
import { extractScene, isUsableSceneZone, sceneToDrawerParams } from "../services/scene-document";
import { renderSceneSvg } from "../services/scene-diagram";
import { enforceSceneKit, fixRoleSides, reassignArrowOwners, relabelFromRoster } from "../services/scene-kit";
import { normalizePositionLabel } from "../services/deterministic-drawer-svg";
import { pinGoalsToEnds } from "../services/scene-space";
import { warmupSvgStillHasMatchKit } from "../data/field-dimensions";
import {
  generateDrillDiagramSvg,
  isPlaceholderDiagramSvg,
  isSceneStoredPicture,
  placementForStoredPicture,
  resolveDiagramPlacement,
  storedDiagramNeedsRedraw,
} from "../services/drill-diagram-svg";


/** Coerce a loose scene literal to a validated SceneDiagram, same as the
 * production path (extractScene runs toWebDiagramV1 + parseWebDiagramV1). */
function sd(obj: unknown) {
  return extractScene(JSON.stringify(obj));
}

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

test("technical circuit card draws one grid, not a leftover 9v9", () => {
  const card = buildSceneCard({
    title: "Defensive Third Receiving and Forward Passing Technical Circuit",
    drillType: "TECHNICAL",
    numbersMin: 18,
    numbersMax: 18,
    goalsAvailable: 2,
    json: {
      goalsAvailable: 2,
      fieldFormat: "9V9",
      formationAttacking: "4-3-3",
      description: "Passing circuit from a center-back into mini-goal target gates.",
      organization: {
        setupSteps: [
          "Set up two 25x25 yard technical grids side-by-side.",
          "Divide the squad of 18 players into two groups of 9, with each group assigned to one grid.",
          "In each grid: three players at the deep starting cone, three central linking players, and three target receivers.",
        ],
      },
    },
  });
  expect(card.card).toMatch(/ONE working group/);
  expect(card.card).toMatch(/25x25/);
  expect(card.card).not.toMatch(/3-2-3/);
  expect(card.card).not.toMatch(/About 18-18/);
  expect(card.card).toMatch(/Mini-goals/);
  expect(card.formationAttacking).toBe("");
});

test("extractScene reads fenced JSON with at least two players", () => {
  const scene = extractScene(`\`\`\`json
{"note":"2v1","players":[{"id":"A1","x":40,"y":50},{"id":"D1","x":60,"y":50}]}
\`\`\``);
  expect(scene.players).toHaveLength(2);
});

test("extractScene rejects a dump with no players", () => {
  expect(() => extractScene(`{"note":"empty","players":[]}`)).toThrow(/players/);
});

test("sceneToDrawerParams guarantees one ball and starts the first arrow on it", () => {
  const card = {
    title: "Press",
    card: "TACTICAL. 3-1 vs 2-1.",
    drillType: "TACTICAL",
    fieldFormat: "7V7" as const,
    spaceConstraint: "FULL",
    formationAttacking: "",
    formationDefending: "",
    goalsAvailable: 0,
  };
  // model gave no ball
  const noBall = sceneToDrawerParams(
    card,
    sd({
      players: [
        { id: "b1", team: "home", role: "CM", x: 30, y: 50 },
        { id: "b2", team: "home", role: "LM", x: 35, y: 30 },
        { id: "r1", team: "away", role: "CB", x: 60, y: 50 },
      ],
      arrows: [{ type: "pass", order: 1, from: { playerId: "b1" }, to: { x: 40, y: 30 } }],
    })
  );
  expect(noBall.ball).toBeDefined();
  expect(noBall.ball).toEqual(noBall.arrows[0].from);

  // model placed a ball → arrow snaps to it
  const withBall = sceneToDrawerParams(
    card,
    sd({
      players: [
        { id: "b1", team: "home", role: "CM", x: 30, y: 50 },
        { id: "r1", team: "away", role: "CB", x: 60, y: 50 },
      ],
      balls: [{ x: 28, y: 52 }],
      arrows: [{ type: "pass", order: 1, from: { x: 99, y: 1 }, to: { x: 40, y: 30 } }],
    })
  );
  expect(withBall.ball).toEqual(withBall.arrows[0].from);
});

test("renderSceneSvg draws a WebDiagramV1 end to end, ball included", () => {
  const svg = renderSceneSvg(
    {
      title: "Build out 3-1 vs 2-1",
      card: "TACTICAL. 3-1 build-up vs a 2-1 press. Mini-goals both ends.",
      drillType: "TACTICAL",
      fieldFormat: "7V7",
      spaceConstraint: "FULL",
      formationAttacking: "",
      formationDefending: "",
      goalsAvailable: 0,
      twoTeamGame: true,
    },
    sd({
      players: [
        { id: "b1", team: "home", role: "LM", x: 25, y: 32 },
        { id: "b2", team: "home", role: "CM", x: 25, y: 50 },
        { id: "b3", team: "home", role: "RM", x: 25, y: 68 },
        { id: "b4", team: "home", role: "ST", x: 45, y: 50 },
        { id: "r1", team: "away", role: "LCB", x: 62, y: 40 },
        { id: "r2", team: "away", role: "RCB", x: 62, y: 60 },
        { id: "r3", team: "away", role: "CM", x: 72, y: 50 },
      ],
      goals: [{ id: "m1", type: "mini", x: 97, y: 38, width: 5 }, { id: "m2", type: "mini", x: 97, y: 62, width: 5 }],
      balls: [{ x: 25, y: 50 }],
      arrows: [
        { type: "pass", order: 1, from: { playerId: "b2" }, to: { playerId: "b4" } },
        { type: "press", order: 2, from: { playerId: "r1" }, to: { x: 40, y: 45 } },
      ],
    })
  );
  expect(svg).toMatch(/<svg/i);
  // ball token: white disc with a dark ring
  expect(svg).toMatch(/fill="#ffffff" stroke="#0f172a"/);
  // roles came through verbatim
  expect(svg).toMatch(/>LCB</);
  expect(svg).toMatch(/>ST</);
  // two arrows → numbered step badges 1 and 2
  expect(svg).toMatch(/>1<\/text>/);
  expect(svg).toMatch(/>2<\/text>/);
  // arrows take the acting team's colour: blue pass off b2 (home),
  // red press off r1 (away) — never a blue line off a red shirt
  expect(svg).toMatch(/stroke="#3b82f6"[^>]*marker-end="url\(#mHome\)"/);
  expect(svg).toMatch(/stroke="#ef4444"[^>]*marker-end="url\(#mAway\)"/);
});

test("reassignArrowOwners rebinds a red-shirt forward pass into blue's final third", () => {
  const players = [
    { id: "b_rcb", team: "home" as const, role: "RCB", x: 20, y: 62, number: 3 },
    { id: "b_cm", team: "home" as const, role: "CM", x: 35, y: 50, number: 8 },
    { id: "b_st", team: "home" as const, role: "ST", x: 50, y: 50, number: 9 },
    { id: "r_dm1", team: "away" as const, role: "DM", x: 50, y: 38, number: 6 },
    { id: "r_cb", team: "away" as const, role: "CB", x: 62, y: 50, number: 5 },
  ];
  // home avg x (35) < away avg x (56) → home attacks right
  const fixed = reassignArrowOwners(
    [
      { type: "pass", order: 1, from: { playerId: "b_rcb" }, to: { playerId: "b_cm" } } as any,
      { type: "pass", order: 5, from: { playerId: "r_dm1" }, to: { x: 88, y: 38 } } as any,
    ],
    players
  );
  // step 1 (blue→blue, short) untouched
  expect((fixed[0].from as any).playerId).toBe("b_rcb");
  // step 5: red DM making a forward pass into blue's final third → nearest blue shirt (b_st, 12 away)
  expect((fixed[1].from as any).playerId).toBe("b_st");
});

test("reassignArrowOwners leaves a legit backward pass and a press alone", () => {
  const players = [
    { id: "b1", team: "home" as const, role: "CM", x: 60, y: 50, number: 8 },
    { id: "b2", team: "home" as const, role: "CB", x: 30, y: 50, number: 5 },
    { id: "r1", team: "away" as const, role: "ST", x: 62, y: 50, number: 9 },
    { id: "r2", team: "away" as const, role: "CM", x: 70, y: 50, number: 8 },
  ];
  const fixed = reassignArrowOwners(
    [
      // blue recycles backward — not into anyone's final third, untouched
      { type: "pass", from: { playerId: "b1" }, to: { playerId: "b2" } } as any,
      // red presses toward the ball — press type is never reassigned
      { type: "press", from: { playerId: "r1" }, to: { x: 40, y: 50 } } as any,
    ],
    players
  );
  expect((fixed[0].from as any).playerId).toBe("b1");
  expect((fixed[1].from as any).playerId).toBe("r1");
});

test("arrow order is renumbered contiguously and a lone arrow gets no badge", () => {
  const card = {
    title: "Combo",
    card: "TACTICAL. Third-man combination.",
    drillType: "TACTICAL",
    fieldFormat: "9V9" as const,
    spaceConstraint: "FULL",
    formationAttacking: "",
    formationDefending: "",
    goalsAvailable: 1,
  };
  // model gave gappy / out-of-order values (5, 2, 2) → expect 1,2,3 in sorted order
  const many = sceneToDrawerParams(
    card,
    sd({
      players: [
        { id: "b1", team: "home", role: "CM", x: 25, y: 50 },
        { id: "b2", team: "home", role: "AM", x: 45, y: 45 },
        { id: "b3", team: "home", role: "ST", x: 62, y: 52 },
        { id: "r1", team: "away", role: "CB", x: 75, y: 50 },
      ],
      balls: [{ x: 25, y: 50 }],
      arrows: [
        { type: "run", order: 5, from: { playerId: "b3" }, to: { x: 78, y: 40 } },
        { type: "pass", order: 2, from: { playerId: "b1" }, to: { playerId: "b2" } },
        { type: "pass", order: 2, from: { playerId: "b2" }, to: { playerId: "b3" } },
      ],
    })
  );
  expect(many.arrows.map((a) => a.order)).toEqual([1, 2, 3]);

  const lone = sceneToDrawerParams(
    card,
    sd({
      players: [
        { id: "b1", team: "home", role: "CM", x: 25, y: 50 },
        { id: "r1", team: "away", role: "CB", x: 70, y: 50 },
      ],
      balls: [{ x: 25, y: 50 }],
      arrows: [{ type: "pass", order: 1, from: { playerId: "b1" }, to: { x: 55, y: 50 } }],
    })
  );
  expect(lone.arrows[0].order).toBeUndefined();
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

test("one full goal gets two mini-goals on the opposite end, not stacked", () => {
  const pinned = pinGoalsToEnds([{ id: "g1", type: "full", x: 8, y: 50, width: 8 }]);
  const minis = pinned.filter((g) => g.type === "mini");
  expect(pinned.filter((g) => g.type === "full")).toEqual([{ id: "g1", type: "full", x: 0, y: 50, width: 8 }]);
  expect(minis).toHaveLength(2);
  expect(minis.map((g) => g.x)).toEqual([97, 97]);
  expect(minis.map((g) => g.y).sort((a, b) => a - b)).toEqual([38, 62]);
});

test("resolveDiagramPlacement defaults to scene even if Render still has deterministic engine", () => {
  delete process.env.DIAGRAM_PLACEMENT;
  process.env.DIAGRAM_SVG_ENGINE = "deterministic";
  expect(resolveDiagramPlacement()).toBe("scene");
  process.env.DIAGRAM_PLACEMENT = "compiler";
  expect(resolveDiagramPlacement()).toBe("compiler");
  expect(resolveDiagramPlacement("scene")).toBe("scene");
});

test("placementForStoredPicture forces compiler only on force; stored pictures stay scene", () => {
  expect(placementForStoredPicture(true)).toBe("compiler");
  expect(placementForStoredPicture(false)).toBeUndefined();
});

test("stored diagrams are not redrawn on fetch without force", () => {
  expect(isPlaceholderDiagramSvg(null)).toBe(true);
  expect(isPlaceholderDiagramSvg("<svg>Diagram generating...</svg>")).toBe(true);
  expect(isPlaceholderDiagramSvg("<svg><circle /></svg>")).toBe(false);
  expect(isSceneStoredPicture("scene-xy-v1")).toBe(true);
  expect(isSceneStoredPicture("drawer-v3")).toBe(false);
  expect(storedDiagramNeedsRedraw(false, "<svg><circle /></svg>")).toBe(false);
  expect(storedDiagramNeedsRedraw(true, "<svg><circle /></svg>")).toBe(true);
  expect(storedDiagramNeedsRedraw(false, null)).toBe(true);
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
  expect(result.sceneDiagram).toBeUndefined();
  expect(result.svg).toMatch(/<svg/i);
});

test("warmup mini-goal overlay is not match kit; GK and white full nets are", () => {
  const mini =
    `<svg><g id="api-goal-overlay"><path stroke="#f97316"/></g></svg>`;
  const full =
    `<svg><g id="api-goal-overlay"><path stroke="#f8fafc"/></g></svg>`;
  const gk = `<svg><text fill="#ffffff">GK</text></svg>`;
  expect(warmupSvgStillHasMatchKit("WARMUP", mini)).toBe(false);
  expect(warmupSvgStillHasMatchKit("WARMUP", full)).toBe(true);
  expect(warmupSvgStillHasMatchKit("WARMUP", gk)).toBe(true);
  expect(warmupSvgStillHasMatchKit("TECHNICAL", full)).toBe(false);
});

test("scene warmup drops full goals and keepers", () => {
  const params = sceneToDrawerParams(
    {
      title: "Passing activation",
      card: "WARMUP. Passing rondo.",
      drillType: "WARMUP",
      fieldFormat: "9V9",
      spaceConstraint: "HALF",
      formationAttacking: "3-2-3",
      formationDefending: "3-2-3",
      coachLevel: "USSF_D",
    },
    sd({
      players: [
        { id: "A1", team: "home", role: "CM", x: 40, y: 50 },
        { id: "G1", team: "gk", role: "GK", x: 8, y: 50 },
      ],
      goals: [
        { id: "F1", type: "full", x: 5, y: 50, width: 8 },
        { id: "M1", type: "mini", x: 90, y: 50, width: 4 },
      ],
    })
  );
  expect(params.players.some((p) => p.team === "gk" || p.role === "GK")).toBe(false);
  expect(params.goals.some((g) => g.type === "full")).toBe(false);
  expect(params.goals.some((g) => g.type === "mini")).toBe(true);
});

test("scene tactical one-full picture keeps two opposite minis", () => {
  const params = sceneToDrawerParams(
    {
      title: "Play forward on first touch",
      card: "TACTICAL. One full goal + two minis opposite.",
      drillType: "TACTICAL",
      fieldFormat: "9V9",
      spaceConstraint: "FULL",
      formationAttacking: "3-2-3",
      formationDefending: "3-2-3",
      coachLevel: "USSF_D",
    },
    sd({
      players: [
        { id: "A1", team: "home", role: "CB", x: 20, y: 50 },
        { id: "G1", team: "gk", role: "GK", x: 5, y: 50 },
      ],
      goals: [{ id: "F1", type: "full", x: 5, y: 50, width: 8 }],
    })
  );
  const minis = params.goals.filter((g) => g.type === "mini");
  expect(params.goals.filter((g) => g.type === "full")).toHaveLength(1);
  expect(minis).toHaveLength(2);
  expect(minis.every((g) => g.x === 97)).toBe(true);
  expect(minis.map((g) => g.y).sort((a, b) => a - b)).toEqual([38, 62]);
});

test("9v9 conditioned card uses a 9v9 shape and two full goals, not leftover 4-3-3 or mini-goals", () => {
  const card = buildSceneCard({
    title: "Conditioned Build-Up Game",
    drillType: "CONDITIONED_GAME",
    numbersMin: 18,
    numbersMax: 18,
    goalsAvailable: 2,
    json: {
      goalsAvailable: 2,
      fieldFormat: "9V9",
      formationAttacking: "4-3-3",
      organization: {
        setupSteps: [
          "9v9 reduced game using 9v9 roles.",
          "Place two mini-goals on the opposite end line with no full-size GKs.",
        ],
      },
    },
  });
  expect(card.formationAttacking).toBe("3-2-3");
  expect(card.formationDefending).toBe("3-3-2");
  expect(card.card).toMatch(/TWO full-size goals/);
  expect(card.card).not.toMatch(/mini-goals on the opposite/);
  expect(card.card).toMatch(/GAME picture/);
});

test("oversized third-of-pitch zones are dropped", () => {
  expect(isUsableSceneZone({ width: 35, height: 100 })).toBe(false);
  expect(isUsableSceneZone({ width: 30, height: 50 })).toBe(false);
  expect(isUsableSceneZone({ width: 20, height: 25 })).toBe(true);
  const params = sceneToDrawerParams(
    {
      title: "Conditioned game",
      card: "9v9",
      drillType: "CONDITIONED_GAME",
      fieldFormat: "9V9",
      spaceConstraint: "HALF",
      formationAttacking: "3-2-3",
      formationDefending: "3-3-2",
    },
    sd({
      players: [
        { id: "A1", team: "home", role: "CB", x: 20, y: 50 },
        { id: "D1", team: "away", role: "ST", x: 70, y: 50 },
      ],
      areas: [
        { x: 0, y: 0, width: 35, height: 100, label: "Defensive Build-Up Third" },
        { x: 40, y: 30, width: 20, height: 25, label: "Lane" },
      ],
    })
  );
  expect(params.zones.map((z) => z.label)).toEqual(["Lane"]);
});

test("sub-squad tactical card drops the full-team formation line", () => {
  const card = buildSceneCard({
    title: "Middle Third Pressing 3-1 vs 2-1",
    drillType: "TACTICAL",
    numbersMin: 6,
    numbersMax: 8,
    goalsAvailable: 0,
    formationUsed: "3-1",
    spaceConstraint: "FULL",
    json: {
      fieldFormat: "7V7",
      goalsAvailable: 0,
      formationAttacking: "3-1",
      description: "Four attackers build in a 3-1 versus a 2-1 press.",
      organization: { setupSteps: ["Position four attacking players in a 3-1", "Three defenders in a 2-1 block"] },
    },
  });
  expect(card.card).not.toMatch(/Formations: ATT/);
  expect(card.card).toMatch(/SMALL-SIDED practice, not a full 7V7/);
  expect(card.formationAttacking).toBe("");
  expect(card.goalsAvailable).toBe(0);
});

test("full-roster conditioned game keeps its formation line", () => {
  const card = buildSceneCard({
    title: "9v9 Build-Up Game",
    drillType: "CONDITIONED_GAME",
    numbersMin: 18,
    numbersMax: 18,
    goalsAvailable: 2,
    json: { fieldFormat: "9V9", goalsAvailable: 2, formationAttacking: "3-2-3", formationDefending: "3-3-2" },
  });
  expect(card.card).toMatch(/Formations: ATT 3-2-3 \/ DEF 3-3-2/);
});

test("isSubSquadPicture flags a named small-sided game, not the full format", () => {
  expect(
    isSubSquadPicture({
      description: "",
      numbersMax: 8,
      spaceConstraint: "FULL",
      rawFormationAttacking: "3-1",
      setup: ["Play a 4v3 to the gates"],
      fieldFormat: "7V7",
    })
  ).toBe(true);
  expect(
    isSubSquadPicture({
      description: "",
      numbersMax: 18,
      spaceConstraint: "FULL",
      rawFormationAttacking: "3-2-3",
      setup: ["9v9 reduced game using 9v9 roles"],
      fieldFormat: "9V9",
    })
  ).toBe(false);
});

test("reconcileCardCounts strips a formation line that overshoots the player count", () => {
  const card = [
    "USSF_D DIAGRAM. TACTICAL. Test.",
    "Pitch 7V7, space FULL. About 6-8 players. Mini-goals / gates only. No full-size goal. No GK.",
    "Formations: ATT 2-3-1 / DEF 3-2-1. 7V7 outfield shape — not an 11v11 leftover.",
  ].join("\n");
  expect(reconcileCardCounts(card)).not.toMatch(/Formations: ATT/);
});

test("namedRoster pulls an explicit per-side role list, and a card carries it as a ROSTER line", () => {
  const setup = [
    "Position 4 attacking players in a 3-1 shape (1 LC, 1 RC, 1 LM, 1 ST)",
    "Position 3 defending players in a 2-1 shape (1 LCB, 1 RCB, 1 CM) facing left",
  ];
  expect(namedRoster(setup, "")).toEqual({ home: ["LC", "RC", "LM", "ST"], away: ["LCB", "RCB", "CM"] });
  // spelled-out roles map to codes
  expect(
    namedRoster(
      ["Position 4 attacking players in a 3-1 (1 central midfielder, 1 left midfielder, 1 right midfielder, 1 central forward)"],
      ""
    )
  ).toEqual({ home: ["CM", "LM", "RM", "CF"], away: [] });
  // "with roles X, Y, Z" phrasing, no brackets
  expect(
    namedRoster(
      ["Position attacking team in a 3-1 formation with roles LM, CM, RM, and ST", "Position defending team with roles LCB, RCB, CM"],
      ""
    )
  ).toEqual({ home: ["LM", "CM", "RM", "ST"], away: ["LCB", "RCB", "CM"] });
  // no list named → null
  expect(namedRoster(["4 attackers in a 3-1 and 3 defenders in a 2-1 block"], "")).toBeNull();

  const card = buildSceneCard({
    title: "Press 3-1 vs 2-1",
    drillType: "TACTICAL",
    numbersMin: 6,
    numbersMax: 8,
    goalsAvailable: 0,
    json: { fieldFormat: "7V7", goalsAvailable: 0, formationAttacking: "3-1", organization: { setupSteps: setup } },
  });
  expect(card.card).toMatch(/ROSTER — draw exactly these shirts.*home LC, RC, LM, ST\. away LCB, RCB, CM\./);
});

test("normalizePositionLabel keeps LC/RC verbatim and still resolves compound codes", () => {
  const at = (role: string) => normalizePositionLabel({ id: "x", team: "home", role, x: 40, y: 50, number: 2 });
  const df = (role: string) => normalizePositionLabel({ id: "y", team: "away", role, x: 60, y: 50, number: 3 });
  expect(at("LC")).toBe("LC");
  expect(at("RC")).toBe("RC");
  expect(df("LCB")).toBe("LCB");
  expect(df("RCB")).toBe("RCB");
  expect(at("LCM")).toBe("LCM");
  expect(df("CB")).toBe("CB");
  expect(at("nonsense")).toBe("AT"); // unknown still falls back
});

test("relabelFromRoster assigns generic shirts to their fitting roster label", () => {
  const out = relabelFromRoster(
    [
      { id: "h1", team: "home", role: "FW", x: 28, y: 30, number: 2 },
      { id: "h2", team: "home", role: "CM", x: 25, y: 50, number: 3 },
      { id: "h3", team: "home", role: "FW", x: 30, y: 70, number: 4 },
      { id: "h4", team: "home", role: "FW", x: 55, y: 50, number: 5 },
      { id: "a1", team: "away", role: "CB", x: 62, y: 40, number: 6 },
      { id: "a2", team: "away", role: "CB", x: 62, y: 60, number: 7 },
      { id: "a3", team: "away", role: "CB", x: 74, y: 50, number: 8 },
    ],
    { home: ["LM", "CM", "RM", "ST"], away: ["LCB", "RCB", "CM"] }
  );
  const at = (id: string) => out.find((p) => p.id === id)!.role;
  expect(at("h1")).toBe("LM"); // top-left home → LM
  expect(at("h3")).toBe("RM"); // bottom home → RM
  expect(at("h4")).toBe("ST"); // furthest forward → ST
  expect(at("a3")).toBe("CM"); // deepest away → CM
  // away L → bottom, away R → top (mirrored)
  expect(at("a2")).toBe("LCB");
  expect(at("a1")).toBe("RCB");
});

test("enforceSceneKit adds a keeper to a full goal that has none, and a defensive gate", () => {
  const { players, goals } = enforceSceneKit(
    [
      { id: "gk1", team: "gk", role: "GK", x: 4, y: 50, number: 1 },
      { id: "a1", team: "home", role: "CM", x: 40, y: 50, number: 2 },
    ],
    [
      { id: "gl", type: "full", x: 0, y: 50, width: 8 },
      { id: "gr", type: "full", x: 100, y: 50, width: 8 },
    ],
    { goalsAvailable: 2, drillType: "CONDITIONED_GAME", defensiveTarget: true }
  );
  expect(players.filter((p) => p.team === "gk" || p.role === "GK")).toHaveLength(2);
  expect(players.some((p) => p.role === "GK" && p.x === 96)).toBe(true);
  // two full goals already exist on both ends — no extra gate needed
  expect(goals.filter((g) => g.type === "gate")).toHaveLength(0);
});

test("enforceSceneKit adds a left counter-gate for a minis-right pressing drill", () => {
  const { goals } = enforceSceneKit(
    [{ id: "a1", team: "home", role: "CM", x: 40, y: 50, number: 2 }],
    [
      { id: "m1", type: "mini", x: 97, y: 38, width: 5 },
      { id: "m2", type: "mini", x: 97, y: 62, width: 5 },
    ],
    { goalsAvailable: 0, drillType: "TACTICAL", defensiveTarget: true }
  );
  expect(goals.some((g) => g.type === "gate" && g.x <= 10)).toBe(true);
});

test("fixRoleSides mirrors away L/R and leaves home + central shirts alone", () => {
  const out = fixRoleSides([
    { id: "1", team: "away", role: "LCB", x: 62, y: 40, number: 4 }, // away L → wants bottom
    { id: "2", team: "away", role: "RCB", x: 62, y: 60, number: 5 }, // away R → wants top
    { id: "3", team: "away", role: "CM", x: 72, y: 50, number: 6 }, // central → untouched
    { id: "4", team: "home", role: "LM", x: 30, y: 30, number: 7 }, // home L → top, already right
    { id: "5", team: "home", role: "RW", x: 30, y: 30, number: 11 }, // home R → wants bottom
  ]);
  const y = (id: string) => out.find((p) => p.id === id)!.y;
  expect(y("1")).toBe(60); // LCB reflected to bottom
  expect(y("2")).toBe(40); // RCB reflected to top
  expect(y("3")).toBe(50); // CM untouched
  expect(y("4")).toBe(30); // home LM already correct
  expect(y("5")).toBe(70); // home RW reflected to bottom
});

test("enforceSceneKit strips keepers and full goals when goalsAvailable is 0", () => {
  const { players, goals } = enforceSceneKit(
    [
      { id: "b1", team: "gk", role: "GK", x: 15, y: 50, number: 1 },
      { id: "b2", team: "home", role: "CM", x: 40, y: 40, number: 2 },
    ],
    [{ id: "g1", type: "full", x: 0, y: 50, width: 8 }],
    { goalsAvailable: 0, drillType: "TACTICAL" }
  );
  expect(players.some((p) => p.team === "gk" || p.role === "GK")).toBe(false);
  expect(goals.some((g) => g.type === "full")).toBe(false);
  expect(players).toHaveLength(2);
});

test("enforceSceneKit snaps one keeper to the post and demotes the extra", () => {
  const input = {
    players: [
      { id: "gk1", team: "gk" as const, role: "GK", x: 10, y: 50, number: 1 },
      { id: "gk2", team: "gk" as const, role: "GK", x: 80, y: 55, number: 1 },
      { id: "a1", team: "home" as const, role: "CB", x: 40, y: 50, number: 2 },
    ],
    goals: [
      { id: "g1", type: "full" as const, x: 0, y: 50, width: 8 },
      { id: "m1", type: "mini" as const, x: 97, y: 38, width: 5 },
      { id: "m2", type: "mini" as const, x: 97, y: 62, width: 5 },
    ],
  };
  const out = enforceSceneKit(input.players, input.goals, { goalsAvailable: 1, drillType: "TACTICAL" });
  expect(out.players.filter((p) => p.team === "gk" || p.role === "GK")).toHaveLength(1);
  expect(out.players).toHaveLength(3);
  const gk = out.players.find((p) => p.team === "gk")!;
  expect(gk.x === 4 || gk.x === 96).toBe(true);
  // idempotent
  const twice = enforceSceneKit(out.players, out.goals, { goalsAvailable: 1, drillType: "TACTICAL" });
  expect(twice.players).toEqual(out.players);
  expect(twice.goals).toEqual(out.goals);
});

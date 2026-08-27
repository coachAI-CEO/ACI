// NOTE (2026-08-26): this test cannot currently run under `pnpm --filter api
// exec jest` -- session.ts (which owns buildCoachLevelVariantFromSession) has
// a pre-existing, unrelated Prisma-schema-drift type error (`clubId` on
// Session.create) that ts-jest's type-check trips on for ANY file that
// imports session.ts, the same issue already blocking ~17 other test suites
// in this repo. This is not introduced by this change and is out of scope
// here; this test is written to be correct once that environment issue is
// resolved separately.

jest.mock("../services/drill-diagram-svg", () => ({
  generateDrillDiagramSvg: jest.fn(),
  omitDiagramSvgFromDrill: jest.fn((drill: any) => drill),
  persistDrillDiagramSvg: jest.fn(),
  attachSceneToDrillJson: jest.fn((drill: any, result: any) => {
    if (!result?.scene) return;
    drill.sceneDocument = result.scene;
    drill.scenePromptVersion = result.promptVersion;
    if (result.sceneCard) drill.sceneCard = result.sceneCard;
  }),
  isSceneDiagramPlacement: jest.fn(() => true),
}));

import { buildCoachLevelVariantFromSession } from "../services/session";
import { generateDrillDiagramSvg } from "../services/drill-diagram-svg";

const mockGenerateDrillDiagramSvg = generateDrillDiagramSvg as jest.Mock;

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    refCode: "S-ABC123",
    title: "U12 Possession Session",
    gameModelId: "POSSESSION",
    phase: "ATTACKING",
    zone: "MIDDLE_THIRD",
    ageGroup: "U12",
    durationMin: 90,
    numbersMin: 12,
    numbersMax: 16,
    goalsAvailable: 1,
    spaceConstraint: "HALF",
    formationUsed: "3-2-3",
    playerLevel: "INTERMEDIATE",
    coachLevel: "USSF_D",
    approved: true,
    principleIds: ["p1"],
    psychThemeIds: ["t1"],
    user: { id: "u1", name: "Dale", email: "dale@example.com" },
    json: {
      formationAttacking: "3-2-3",
      qa: { pass: true, summary: "Great session", scores: { realism: 5 } },
      drills: [
        { refCode: "D-1", title: "Warmup", drillType: "WARMUP", coachLevel: "USSF_D" },
        { refCode: "D-2", title: "Technical", drillType: "TECHNICAL", coachLevel: "USSF_D" },
        { refCode: null, title: "Tactical (no refCode)", drillType: "TACTICAL", coachLevel: "USSF_D" },
        { refCode: "D-4", title: "Cooldown", drillType: "COOLDOWN", coachLevel: "USSF_D" },
      ],
    },
    ...overrides,
  };
}

describe("buildCoachLevelVariantFromSession", () => {
  beforeEach(() => {
    mockGenerateDrillDiagramSvg.mockReset();
    mockGenerateDrillDiagramSvg.mockResolvedValue({ svg: "<svg>mock</svg>" });
  });

  test("throws when coachLevel is missing", async () => {
    await expect(buildCoachLevelVariantFromSession(baseRow() as any, "")).rejects.toThrow(
      "coachLevel is required"
    );
  });

  test("throws when the session has no drills", async () => {
    const row = baseRow({ json: { drills: [] } });
    await expect(buildCoachLevelVariantFromSession(row as any, "USSF_C")).rejects.toThrow(
      "Session has no drills to adapt"
    );
  });

  test("propagates the new coachLevel onto the session and every drill", async () => {
    const row = baseRow();
    const result = await buildCoachLevelVariantFromSession(row as any, "USSF_C");
    expect(result.session.coachLevel).toBe("USSF_C");
    for (const drill of result.session.drills as any[]) {
      expect(drill.coachLevel).toBe("USSF_C");
    }
  });

  test("normalizes B+ spelling variants to USSF_B_PLUS", async () => {
    const row = baseRow();
    const result = await buildCoachLevelVariantFromSession(row as any, "USSF_B+");
    expect(result.session.coachLevel).toBe("USSF_B_PLUS");
  });

  test("regenerates diagrams only for non-COOLDOWN drills with a refCode", async () => {
    const row = baseRow();
    await buildCoachLevelVariantFromSession(row as any, "USSF_C");
    // 4 drills total: WARMUP (D-1) and TECHNICAL (D-2) qualify; the TACTICAL
    // drill has no refCode and COOLDOWN is always skipped.
    expect(mockGenerateDrillDiagramSvg).toHaveBeenCalledTimes(2);
    const calledTitles = mockGenerateDrillDiagramSvg.mock.calls.map((c: any[]) => c[0].title);
    expect(calledTitles).toEqual(expect.arrayContaining(["Warmup", "Technical"]));
  });

  test("sets diagramSvg on drills that were successfully regenerated", async () => {
    const row = baseRow();
    const result = await buildCoachLevelVariantFromSession(row as any, "USSF_C");
    const warmup = (result.session.drills as any[]).find((d) => d.refCode === "D-1");
    expect(warmup.diagramSvg).toBe("<svg>mock</svg>");
  });

  test("a failed per-drill diagram regeneration does not fail the whole variant", async () => {
    mockGenerateDrillDiagramSvg
      .mockResolvedValueOnce({ svg: "<svg>ok</svg>" })
      .mockRejectedValueOnce(new Error("LLM boom"));
    const row = baseRow();
    const result = await buildCoachLevelVariantFromSession(row as any, "USSF_C");
    expect(result.session.title).toBeDefined();
    const drills = result.session.drills as any[];
    // The drill whose regeneration rejected should simply lack diagramSvg,
    // not blow up the whole call.
    expect(drills.some((d) => d.diagramSvg === undefined)).toBe(true);
  });

  test("marks variantOnly and derives qa.pass from row.approved when present", async () => {
    const row = baseRow({ approved: true, json: { ...baseRow().json, qa: { pass: false } } });
    const result = await buildCoachLevelVariantFromSession(row as any, "USSF_C");
    expect(result.variantOnly).toBe(true);
    expect(result.qa.pass).toBe(true); // row.approved=true wins even though stored qa.pass=false
  });

  test("preserves refCode, id, and gameModelId from the source row", async () => {
    const row = baseRow();
    const result = await buildCoachLevelVariantFromSession(row as any, "USSF_C");
    expect(result.session.id).toBe("session-1");
    expect(result.session.refCode).toBe("S-ABC123");
    expect(result.session.gameModelId).toBe("POSSESSION");
  });
});

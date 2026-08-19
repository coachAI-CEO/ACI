import { extraPromptForPack } from "../scripts/first-pass-diagrams/prompt-packs";
import { FIRST_PASS_FIXTURES } from "../scripts/first-pass-diagrams/fixtures";
import { frozenConfidence, sceneConfidence } from "../scripts/first-pass-diagrams/visual-qa";
import { matchupWithKeepers } from "../data/field-dimensions";

describe("first-pass prompt packs", () => {
  it("leaves the base pack empty so we can measure the current prompt", () => {
    const b5 = FIRST_PASS_FIXTURES.find((f) => f.id === "B5")!;
    expect(extraPromptForPack("base", b5)).toBe("");
  });

  it("locks 11v11 to one full goal as two GKs including the pug-end keeper", () => {
    const b5 = FIRST_PASS_FIXTURES.find((f) => f.id === "B5")!;
    const extra = extraPromptForPack("scene-lock", b5);
    expect(extra).toMatch(/TWO green GK/);
    expect(extra).toMatch(/40×80/);
    expect(extra).toMatch(/11v11/);
  });

  it("locks 7v7 one-full as 7v7, not 6v6", () => {
    const b1 = FIRST_PASS_FIXTURES.find((f) => f.id === "B1")!;
    expect(extraPromptForPack("scene-lock", b1)).toMatch(/7v7/);
    expect(extraPromptForPack("scene-lock", b1)).not.toMatch(/6v6\+2GK/);
  });

  it("locks even-sided 0-full as opposite minis", () => {
    const a4 = FIRST_PASS_FIXTURES.find((f) => f.id === "A4")!;
    expect(extraPromptForPack("scene-lock", a4)).toMatch(/one pug on each end/);
  });

  it("locks defending C3 so the protected goal stays on the right", () => {
    const d1 = FIRST_PASS_FIXTURES.find((f) => f.id === "D1")!;
    expect(d1.input.phase).toBe("DEFENDING");
    expect(d1.input.zone).toBe("DEFENSIVE_THIRD");
    expect(extraPromptForPack("scene-lock", d1)).toMatch(/RIGHT/);
    expect(FIRST_PASS_FIXTURES.find((f) => f.id === "D3")!.input.coachLevel).toBe("USSF_D");
    expect(FIRST_PASS_FIXTURES.find((f) => f.id === "D4")!.input.coachLevel).toBe("USSF_B_PLUS");
  });
});

describe("visual confidence helpers", () => {
  it("counts each GK with their side so 6v6+2GK reads as 7v7", () => {
    expect(matchupWithKeepers(6, 6, 2)).toBe("7v7");
    expect(matchupWithKeepers(10, 10, 2)).toBe("11v11");
    expect(matchupWithKeepers(4, 4, 0)).toBe("4v4");
  });
  it("averages per-card visual scores", () => {
    expect(
      sceneConfidence([{ visual: { confidence: 80, verdict: "pass", issues: [], summary: "" } }, { visual: { confidence: 60, verdict: "review", issues: [], summary: "" } }])
    ).toBe(70);
  });

  it("maps frozen checks to a 0-100 score", () => {
    expect(
      frozenConfidence({
        schema: { ok: true, issues: [] },
        space: { ok: true, issues: [] },
        roster: { ok: true, issues: [] },
        gk: { ok: true, issues: [] },
        layout: { ok: true, issues: [] },
        picture: { ok: false, issues: ["leftover"] },
        chrome: { ok: true, issues: [] },
      })
    ).toBe(86);
  });

  it("requires the field to be centered on the players", () => {
    const { VISUAL_FRAME_RULE } = require("../scripts/first-pass-diagrams/visual-qa");
    expect(VISUAL_FRAME_RULE).toMatch(/CENTERED on the players/i);
  });
});

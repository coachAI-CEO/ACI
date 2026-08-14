import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { buildDrawerPrompt, DRAWER_PROMPT_VERSION } from "../prompts/gemini-drawer-prompt";

// Regression: ISSUE-004 — D-PVG7 drew a second labeled player at each pass end
// and a red outfield GK next to the real green keepers.
// Found by /qa on 2026-08-14
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-14.md

function nineVNine() {
  return {
    title: "9v9 Conditioned Game - Attacking Third Dominance",
    drillType: "CONDITIONED_GAME",
    durationMin: 25,
    rpeMin: 6,
    rpeMax: 8,
    numbersMin: 18,
    numbersMax: 18,
    json: {
      organization: { area: { widthYards: 80, lengthYards: 55 } },
      diagram: {
        players: [
          { id: "GK1", team: "ATT", role: "GK", number: 1, x: 94, y: 27 },
          { id: "CB1", team: "ATT", role: "CB", number: 4, x: 25, y: 27 },
          { id: "LB1", team: "ATT", role: "LB", number: 3, x: 25, y: 12 },
          { id: "RB1", team: "ATT", role: "RB", number: 2, x: 25, y: 42 },
          { id: "CM1", team: "ATT", role: "CM", number: 6, x: 45, y: 20 },
          { id: "CM2", team: "ATT", role: "CM", number: 8, x: 45, y: 35 },
          { id: "LW1", team: "ATT", role: "LW", number: 11, x: 65, y: 12 },
          { id: "ST1", team: "ATT", role: "ST", number: 9, x: 65, y: 27 },
          { id: "RW1", team: "ATT", role: "RW", number: 7, x: 65, y: 42 },
          { id: "DEF_GK", team: "DEF", role: "GK", number: 1, x: 6, y: 27 },
          { id: "DEF_CB1", team: "DEF", role: "CB", number: 4, x: 75, y: 20 },
          { id: "DEF_CB2", team: "DEF", role: "CB", number: 5, x: 75, y: 35 },
          { id: "DEF_LB", team: "DEF", role: "LB", number: 3, x: 75, y: 8 },
          { id: "DEF_RB", team: "DEF", role: "RB", number: 2, x: 75, y: 48 },
          { id: "DEF_CM1", team: "DEF", role: "CM", number: 6, x: 55, y: 20 },
          { id: "DEF_CM2", team: "DEF", role: "CM", number: 8, x: 55, y: 35 },
          { id: "DEF_ST1", team: "DEF", role: "ST", number: 9, x: 35, y: 20 },
          { id: "DEF_ST2", team: "DEF", role: "ST", number: 10, x: 35, y: 35 },
        ],
        goals: [
          { id: "G_ATT", type: "BIG", width: 8, x: 0, y: 27 },
          { id: "G_DEF", type: "BIG", width: 8, x: 100, y: 27 },
        ],
        arrows: [
          { type: "pass", from: { x: 25, y: 27 }, to: { x: 45, y: 20 } },
          { type: "pass", from: { x: 45, y: 20 }, to: { x: 65, y: 12 } },
        ],
      },
    },
  };
}

function playerLines(prompt: string): string[] {
  return prompt
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(home|away|gk|neutral)\s+pos=/.test(line));
}

test("v46 prompt forbids cloning a player at an arrow endpoint", () => {
  expect(DRAWER_PROMPT_VERSION).toBe("v46-one-token");
  const prompt = buildDrawerPrompt(drillToDrawerParams(nineVNine() as any));
  expect(prompt).toMatch(/ONE TOKEN PER PLAYER LINE/);
  expect(prompt).toMatch(/Never clone a player at an arrow endpoint/);
});

test("two-goal 9v9 with explicit keepers does not relabel an outfield player as GK", () => {
  const prompt = buildDrawerPrompt(drillToDrawerParams(nineVNine() as any));
  const lines = playerLines(prompt);
  expect(lines).toHaveLength(18);
  const gk = lines.filter((line) => line.includes("pos=GK"));
  expect(gk).toHaveLength(2);
  expect(gk.every((line) => line.startsWith("gk "))).toBe(true);
  expect(lines.filter((line) => line.startsWith("home ") && line.includes("pos=GK"))).toHaveLength(0);
  expect(lines.filter((line) => line.startsWith("away ") && line.includes("pos=GK"))).toHaveLength(0);
});

test("stored 9v9 roles are kept instead of collapsing into duplicate LB/LM labels", () => {
  const prompt = buildDrawerPrompt(drillToDrawerParams(nineVNine() as any));
  const lines = playerLines(prompt);
  const home = lines.filter((line) => line.startsWith("home "));
  const labels = home.map((line) => line.match(/pos=([A-Z]{2})/)?.[1]);
  expect(labels).toEqual(["CB", "LB", "RB", "CM", "CM", "LW", "ST", "RW"]);
});

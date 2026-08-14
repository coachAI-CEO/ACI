import { buildSessionPrompt, type SessionPromptInput } from "../../prompts/session";
import { buildDescriptionExpansionPrompt } from "../../services/description-enrichment";
import { buildDrawerPrompt } from "../../prompts/gemini-drawer-prompt";
import { validateAndCleanSVG } from "../../services/gemini-drawer";
import type { DrawerParams } from "../../types/drawer";
import type { Scenario } from "./harness";

function parseJsonSafe(text: string): any {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

// Same fixed base input used by session-quality-sandbox.ts, so results from
// both tools stay comparable. Only meant as a representative real prompt --
// swap fields here for a specific scenario you're investigating.
const SESSION_INPUT: SessionPromptInput = {
  gameModelId: "POSSESSION",
  ageGroup: "U12",
  phase: "ATTACKING",
  zone: "MIDDLE_THIRD",
  numbersMin: 10,
  numbersMax: 14,
  goalsAvailable: 1,
  spaceConstraint: "HALF",
  durationMin: 90,
  formationAttacking: "3-2-3",
  formationDefending: "3-2-3",
  playerLevel: "INTERMEDIATE",
  coachLevel: "USSF_C",
};

const SAMPLE_DRILL_FOR_EXPANSION = {
  title: "Third-Man Combination Rondo",
  description:
    "This tactical drill integrates our complete possession model to master playing out under pressure within the defensive third.",
  organization: {
    setupSteps: [
      "Set up a 20x20 yard grid with 4 corner cones.",
      "8 attackers positioned around the perimeter, 4 defenders inside.",
    ],
  },
  constraints: ["Maximum 2 touches per player.", "Defenders must win the ball 3 times to rotate out."],
  coachingPoints: ["Scan before receiving.", "Support at an angle, not directly behind the ball carrier."],
};

// Representative CONDITIONED_GAME diagram: one full-size goal (with GK) at
// one end, matches the exact goal/GK shape that diagram-goals.ts enforces
// downstream in production, so this scenario exercises the same case that's
// been the source of real bugs this week.
const SAMPLE_DRAWER_PARAMS: DrawerParams = {
  title: "Conditioned Possession Game",
  drillType: "CONDITIONED_GAME",
  format: "9v9",
  fieldFormat: "9V9",
  phase: "ATTACKING",
  zone: "MIDDLE_THIRD",
  gameModelId: "POSSESSION",
  formationAttacking: "3-2-3",
  formationDefending: "3-2-3",
  durationMin: 15,
  rpeMin: 6,
  rpeMax: 8,
  widthYards: 50,
  lengthYards: 60,
  players: [
    { id: "H1", number: 1, team: "gk", role: "GK", x: 9, y: 50 },
    { id: "H2", number: 2, team: "home", role: "CB", x: 22, y: 35 },
    { id: "H3", number: 3, team: "home", role: "CB", x: 22, y: 65 },
    { id: "H4", number: 4, team: "home", role: "CM", x: 38, y: 50 },
    { id: "H5", number: 5, team: "home", role: "CM", x: 55, y: 35 },
    { id: "H6", number: 6, team: "home", role: "CM", x: 55, y: 65 },
    { id: "H7", number: 7, team: "home", role: "ST", x: 70, y: 40 },
    { id: "H8", number: 8, team: "home", role: "ST", x: 70, y: 60 },
    { id: "H9", number: 9, team: "home", role: "ST", x: 80, y: 50 },
    { id: "A1", number: 2, team: "away", role: "CB", x: 62, y: 35 },
    { id: "A2", number: 3, team: "away", role: "CB", x: 62, y: 65 },
    { id: "A3", number: 4, team: "away", role: "CM", x: 48, y: 50 },
    { id: "A4", number: 5, team: "away", role: "CM", x: 35, y: 35 },
    { id: "A5", number: 6, team: "away", role: "CM", x: 35, y: 65 },
    { id: "A6", number: 7, team: "away", role: "ST", x: 20, y: 40 },
    { id: "A7", number: 8, team: "away", role: "ST", x: 20, y: 60 },
  ],
  goals: [
    { id: "G1", x: 6, y: 50, width: 8, type: "full" },
    { id: "MG1", x: 94, y: 38, width: 5, type: "mini" },
    { id: "MG2", x: 94, y: 62, width: 5, type: "mini" },
  ],
  arrows: [],
  zones: [],
  annotations: [],
  coachingPoints: ["Scan before receiving.", "Switch play when the far side is overloaded."],
  primaryCoachingPicture: "Attack builds through midfield to break the press and finish on the full-size goal.",
  coach: { x: 50, y: 90, label: "Coach" },
};

export const SCENARIOS: Record<string, Scenario> = {
  session: {
    name: "session",
    buildPrompt: () => buildSessionPrompt(SESSION_INPUT),
    validate: (text) => {
      const parsed = parseJsonSafe(text);
      if (!parsed) return { ok: false, note: "not valid JSON" };
      if (!Array.isArray(parsed.drills) || parsed.drills.length === 0) {
        return { ok: false, note: "missing drills[]" };
      }
      return { ok: true, note: `${parsed.drills.length} drills` };
    },
  },
  description: {
    name: "description",
    buildPrompt: () => buildDescriptionExpansionPrompt(SAMPLE_DRILL_FOR_EXPANSION, "USSF_C"),
    validate: (text) => {
      const parsed = parseJsonSafe(text);
      const description = parsed?.description;
      if (typeof description !== "string" || !description.trim()) {
        return { ok: false, note: "missing description field" };
      }
      const words = description.trim().split(/\s+/).filter(Boolean).length;
      return { ok: words >= 80 && words <= 120, note: `${words} words` };
    },
  },
  drawer: {
    name: "drawer",
    buildPrompt: () => buildDrawerPrompt(SAMPLE_DRAWER_PARAMS),
    validate: (text) => {
      const result = validateAndCleanSVG(text);
      if (!result.ok) return { ok: false, note: `invalid SVG: ${result.reason}` };
      return { ok: true, note: `${result.svg.length} chars` };
    },
  },
};

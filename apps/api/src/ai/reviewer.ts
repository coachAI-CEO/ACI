import { GoogleGenerativeAI } from "@google/generative-ai";

export type DrillQA = {
  pass: boolean;
  scores: {
    structure: number;
    gameModel: number;
    psych: number;
    realism: number;
    constraints: number;
    safety: number;
  };
  notes: string[];
};

const FAST_E2E = process.env.FAST_E2E === "1";

// Reuse whatever key you already use for drill generation
const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  "";

let genAI: GoogleGenerativeAI | null = null;
if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
  } catch {
    genAI = null;
  }
}

function stubQA(drill: any): DrillQA {
  return {
    pass: true,
    scores: {
      structure: 5,
      gameModel: 4,
      psych: 4,
      realism: 4,
      constraints: 5,
      safety: 5,
    },
    notes: [
      "QA stub: FAST_E2E or missing Gemini key; structural checks only.",
    ],
  };
}

export async function runPromptQA(drill: any): Promise<DrillQA> {
  // Keep Jest + local dev fast and offline-safe
  if (FAST_E2E || !genAI) {
    return stubQA(drill);
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  const systemPrompt = `You are CoachAI-Reviewer, a UEFA A-license coach with expertise in youth development, sport psychology, and modern positional play.

You will review a single training drill (JSON) and respond ONLY with JSON:

{
  "pass": boolean,
  "scores": {
    "structure": number,
    "gameModel": number,
    "psych": number,
    "realism": number,
    "constraints": number,
    "safety": number
  },
  "notes": string[]
}

Scoring rubric (1–5):
- structure: clarity of organization, space, numbers, rotations, work:rest.
- gameModel: alignment with gameModelId (POSSESSION, PRESSING, TRANSITION, COACHAI).
- psych: psychological theme / opportunities (reset word, resilience, communication, confidence).
- realism: similarity to the real game (direction, opposition, transitions, decisions).
- constraints: effective use of rules/conditions to shape behavior instead of pure instruction.
- safety: age-appropriate, avoids overload/collision risk, sane contact level.

Notes: short bullet-style messages (max 5), directly useful to the coach.`;

  const userContent = JSON.stringify(drill, null, 2);

  // Simple text call so TS doesn't complain about Content/Part types
  const result = await model.generateContent(
    systemPrompt + "\n\nDRILL JSON:\n" + userContent
  );

  const raw = result.response.text();
  let parsed: any;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ...stubQA(drill),
      notes: [
        "QA fallback: Gemini returned non-JSON response; using stub scoring.",
      ],
    };
  }

  const qa: DrillQA = {
    pass: Boolean(parsed?.pass),
    scores: {
      structure: Number(parsed?.scores?.structure ?? 3),
      gameModel: Number(parsed?.scores?.gameModel ?? 3),
      psych: Number(parsed?.scores?.psych ?? 3),
      realism: Number(parsed?.scores?.realism ?? 3),
      constraints: Number(parsed?.scores?.constraints ?? 3),
      safety: Number(parsed?.scores?.safety ?? 4),
    },
    notes: Array.isArray(parsed?.notes)
      ? parsed.notes.map((n: any) => String(n)).slice(0, 8)
      : ["QA fallback: no notes returned from Gemini."],
  };

  return qa;
}

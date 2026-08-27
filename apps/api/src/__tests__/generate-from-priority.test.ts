jest.mock("../gemini", () => ({
  generateText: jest.fn(),
}));
jest.mock("../prisma", () => ({
  prisma: {
    trainingPriority: { findUniqueOrThrow: jest.fn() },
  },
}));

import { generateText } from "../gemini";
import { prisma } from "../prisma";
import {
  deriveTrainingIntent,
  generateDrillFromIntent,
  generateDrillForTrainingPriority,
  LlmResponseParseError,
} from "../services/generate-from-priority";

const mockGenerateText = generateText as jest.Mock;
const mockPriorityFind = prisma.trainingPriority.findUniqueOrThrow as jest.Mock;

describe("deriveTrainingIntent", () => {
  beforeEach(() => mockGenerateText.mockReset());

  test("parses a JSON intent response, stripping markdown fences", async () => {
    mockGenerateText.mockResolvedValue(
      '```json\n{"tacticalProblem": "p", "mustBeAvailable": "a", "mustBeAvoided": "b"}\n```'
    );
    const intent = await deriveTrainingIntent(
      { trigger: "t", response: "r", antiPattern: "ap" },
      { ageGroup: "U16", playerLevel: "ADVANCED" }
    );
    expect(intent).toEqual({ tacticalProblem: "p", mustBeAvailable: "a", mustBeAvoided: "b" });
  });
});

describe("deriveTrainingIntent -- malformed model response", () => {
  beforeEach(() => mockGenerateText.mockReset());

  // Regression guard for the eng-review finding: a truncated/garbled model
  // response must throw a distinguishable error, not a bare JSON.parse crash.
  test("throws LlmResponseParseError (not a raw SyntaxError) on unparseable output", async () => {
    mockGenerateText.mockResolvedValue('{"tacticalProblem": "p", "mustBeAvailable"');

    await expect(
      deriveTrainingIntent(
        { trigger: "t", response: "r", antiPattern: "ap" },
        { ageGroup: "U16", playerLevel: "ADVANCED" }
      )
    ).rejects.toBeInstanceOf(LlmResponseParseError);
  });
});

describe("generateDrillFromIntent", () => {
  beforeEach(() => mockGenerateText.mockReset());

  test("includes the coach-level language profile and the intent fields in the prompt", async () => {
    mockGenerateText.mockResolvedValue(
      '{"title": "t", "drillType": "TACTICAL", "organization": {"area": {"lengthYards": 40, "widthYards": 30}, "setupSteps": [], "rotation": "", "restarts": "", "scoring": ""}, "constraints": [], "coachingPoints": []}'
    );
    await generateDrillFromIntent(
      { tacticalProblem: "the tactical problem", mustBeAvailable: "must be available", mustBeAvoided: "must be avoided" },
      { ageGroup: "U16", playerLevel: "ADVANCED", coachLevel: "USSF_B_PLUS" }
    );
    const prompt = mockGenerateText.mock.calls[0][0] as string;
    expect(prompt).toContain("USSF_B_PLUS");
    expect(prompt).toContain("the tactical problem");
    expect(prompt).toContain("must be available");
    expect(prompt).toContain("must be avoided");
  });
});

describe("generateDrillForTrainingPriority — full chain wiring", () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockPriorityFind.mockReset();
    mockPriorityFind.mockResolvedValue({
      id: "priority-1",
      subprinciple: {
        trigger: "Opponent ball carrier turns toward the sideline under heavy pressure.",
        response: "Lock the opponent against the touchline, eliminate the backward escape pass, and execute an aggressive double-team tackle.",
        antiPattern: "Over-committing centrally and opening up an easy diagonal switch of play.",
      },
      team: { ageGroup: "U16", playerLevel: null },
    });
  });

  const intentResponse = '{"tacticalProblem": "p", "mustBeAvailable": "a", "mustBeAvoided": "b"}';
  const drillResponse =
    '{"title": "Test Drill", "drillType": "TACTICAL", "organization": {"area": {"lengthYards": 40, "widthYards": 30}, "setupSteps": [], "rotation": "", "restarts": "", "scoring": ""}, "constraints": ["c1"], "coachingPoints": ["cp1"]}';

  // Real, previously-recorded model output from this session's manual
  // testing (a genuine contradiction: rewards the attacking team for
  // achieving the anti-pattern's outcome unconditionally).
  const qaResponseContradicted = JSON.stringify({
    pass: false,
    scores: { structure: 1, gameModel: 1, phase: 1, psych: 2, clarity: 1, realism: 1, constraints: 1, safety: 3, progression: 1 },
    principleAlignment: {
      contradicted: true,
      contradictingConstraint: "The attacking team is awarded 3 points for successfully completing a diagonal switch of play out of the wide trap zone.",
      explanation: "Awarding 3 points for completing this switch without any failure condition attached pays the attacking team for achieving the anti-pattern's outcome.",
    },
    summary: "s",
    notes: [],
  });

  // Real, previously-recorded model output: a legitimate disincentive
  // (opponent's reward is explicitly conditioned on the defending side's
  // named failure) -- must NOT be flagged as a contradiction.
  const qaResponseLegitimate = JSON.stringify({
    pass: false,
    scores: { structure: 1, gameModel: 2, phase: 2, psych: 3, clarity: 1, realism: 2, constraints: 3, safety: 3, progression: 1 },
    principleAlignment: {
      contradicted: false,
      contradictingConstraint: null,
      explanation: "Properly frames the opponent's reward as a cost imposed on Red for their structural failure -- a legitimate disincentive rather than a contradiction.",
    },
    summary: "s",
    notes: [],
  });

  test("surfaces a genuine contradiction: qa.pass=false, contradicted=true", async () => {
    mockGenerateText
      .mockResolvedValueOnce(intentResponse)
      .mockResolvedValueOnce(drillResponse)
      .mockResolvedValueOnce(qaResponseContradicted);

    const result = await generateDrillForTrainingPriority("priority-1");

    expect(result.qa.pass).toBe(false);
    expect(result.qa.principleAlignment?.contradicted).toBe(true);
    expect(result.qa.principleAlignment?.contradictingConstraint).toContain("diagonal switch");
  });

  test("does not flag a legitimate disincentive as a contradiction", async () => {
    mockGenerateText
      .mockResolvedValueOnce(intentResponse)
      .mockResolvedValueOnce(drillResponse)
      .mockResolvedValueOnce(qaResponseLegitimate);

    const result = await generateDrillForTrainingPriority("priority-1");

    expect(result.qa.principleAlignment?.contradicted).toBe(false);
    expect(result.qa.principleAlignment?.contradictingConstraint).toBeNull();
  });

  // Regression guard for the level-defaulting bug found in eng review.
  test("derives playerLevel/coachLevel from ageGroup when the team has none set", async () => {
    mockGenerateText
      .mockResolvedValueOnce(intentResponse)
      .mockResolvedValueOnce(drillResponse)
      .mockResolvedValueOnce(qaResponseLegitimate);

    await generateDrillForTrainingPriority("priority-1");

    // Call 2 (generateDrillFromIntent) is the second generateText call and
    // is the one that receives the language profile.
    const call2Prompt = mockGenerateText.mock.calls[1][0] as string;
    // team.ageGroup is U16 (11v11 band) -> USSF_B_PLUS, not the old hardcoded USSF_C.
    expect(call2Prompt).toContain("USSF_B_PLUS");
  });
});

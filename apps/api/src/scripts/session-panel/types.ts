import type { SessionPromptInput } from "../../prompts/session";

export type WouldRun = "yes" | "rewrite" | "no";
export type PanelVerdict = "proud" | "review" | "fail";

export type PanelFixture = {
  id: string;
  /** Short label for the HTML board. */
  label: string;
  input: SessionPromptInput;
  /** Plain-English meaning of today's topic, for the judges (not a keyword dump). */
  topicMeaning: string;
  /**
   * At least one of these must match the tactical + conditioned-game text.
   * If you can swap the topic name and the session still reads as true, these
   * should fail.
   */
  topicSignals: RegExp[];
};

export type DrillPacket = {
  drillType: string;
  title: string;
  duration: number | null;
  rpe: number | string | null;
  description: string;
  organization: {
    setupSteps: string[];
    area: unknown;
    rotation: string;
    restarts: string;
    scoring: string;
  };
  coachingPoints: string[];
  progressions: string[];
  constraints: string[];
  coachingNotes: string;
  debrief: unknown | null;
  diagramCounts: {
    players: number;
    goals: number;
    arrows: number;
    annotations: number;
  };
};

export type SessionPacket = {
  title: string;
  summary: string;
  ageGroup: string;
  coachLevel: string;
  playerLevel: string;
  gameModelId: string;
  phase: string;
  zone: string;
  topic: string;
  durationMin: number;
  numbersMin: number;
  numbersMax: number;
  spaceConstraint: string;
  coachingNotes: string;
  principleIds: string[];
  drills: DrillPacket[];
};

export type GateIssue = {
  code: string;
  detail: string;
};

export type FrozenGates = {
  ok: boolean;
  issues: GateIssue[];
};

export type AgentId = "development" | "instructor" | "designer";

export type AgentEvidence = {
  quote: string;
  drillTitle: string;
  why: string;
};

export type AgentScores = Record<string, number>;

export type AgentReview = {
  agentId: AgentId;
  agentName: string;
  scores: AgentScores;
  topicTaught: number;
  trainingQuality: number;
  /** 1-5 vs prior practice form. Null on the first session for this cell. */
  variety: number | null;
  wouldRun: WouldRun;
  evidence: AgentEvidence[];
  notes: string;
  parseError: string | null;
  /** True when we overrode the model's wouldRun because topic/quality were too low. */
  wouldRunOverridden: boolean;
};

export type PanelResult = {
  verdict: PanelVerdict;
  reasons: string[];
  disagreement: boolean;
};

export type SampleRun = {
  fixtureId: string;
  label: string;
  generateModel: string;
  judgeModel: string;
  sampleIdx: number;
  latencyMs: number | null;
  error: string | null;
  title: string | null;
  packet: SessionPacket | null;
  gates: FrozenGates | null;
  agents: AgentReview[];
  panel: PanelResult | null;
  /** Rough input tokens sent to the three judges (chars/4). Null if judges skipped. */
  judgeInputTokensApprox: number | null;
  /** Lesson ids that were in the generator prompt for this sample. */
  appliedLessonIds: string[];
  /** Jaccard similarity to the closest prior on this cell. Null = first session. */
  varietySim: number | null;
};

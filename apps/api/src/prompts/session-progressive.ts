import type { SessionPromptInput } from "./session";
import { buildSessionPrompt } from "./session";

export type ProgressiveSessionPromptInput = SessionPromptInput & {
  sessionNumber: number;
  totalSessions: number;
  previousSessions?: any[];
};

export function buildProgressiveSessionPrompt(input: ProgressiveSessionPromptInput): string {
  const { sessionNumber, totalSessions, previousSessions = [], ...base } = input;
  const basePrompt = buildSessionPrompt(base);
  const previousContext = previousSessions.length
    ? JSON.stringify(previousSessions.map((s) => ({
        title: s.title,
        summary: s.summary || s.sessionSummary,
        drills: Array.isArray(s.drills)
          ? s.drills.map((d: any) => ({
              drillType: d.drillType,
              title: d.title,
              focus: d.focus || d.coachingFocus || d.objective,
            }))
          : [],
      })), null, 2)
    : "[]";

  return [
    "SYSTEM: You are creating a progressive training series.",
    `This is session ${sessionNumber} of ${totalSessions}.`,
    "Each session should build on previous sessions with progressive complexity and challenge.",
    "",
    "Previous sessions (for continuity):",
    previousContext,
    "",
    "BASE SESSION PROMPT:",
    basePrompt,
  ].join("\n");
}

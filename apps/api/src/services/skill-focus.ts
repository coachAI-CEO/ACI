import { prisma } from "../prisma";
import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import { buildSkillFocusPrompt, SkillFocusContext } from "../prompts/skill-focus";

function parseJsonSafe(text: string) {
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

function buildSessionContext(session: any): SkillFocusContext {
  const json = session.json || {};
  const coachLevel = String(session.coachLevel || json.coachLevel || "").toUpperCase() || null;
  const playerLevelRaw = String(session.playerLevel || json.playerLevel || "").toUpperCase();
  const playerLevel =
    coachLevel === "GRASSROOTS" ? "BEGINNER" : playerLevelRaw || null;
  return {
    title: session.title,
    ageGroup: session.ageGroup,
    gameModelId: session.gameModelId,
    coachLevel,
    playerLevel,
    phase: session.phase || null,
    zone: session.zone || null,
    durationMin: session.durationMin,
    sessionSummary: json.summary || null,
    drills: Array.isArray(json.drills)
      ? json.drills.map((d: any) => ({
          title: d.title,
          drillType: d.drillType,
          focus: d.focus || d.coachingFocus || d.objective,
        }))
      : [],
  };
}

function buildSeriesContext(sessions: any[]): SkillFocusContext {
  if (sessions.length === 0) return {};
  const first = sessions[0];
  const firstJson = first.json || {};
  const coachLevel = String(first.coachLevel || firstJson.coachLevel || "").toUpperCase() || null;
  const playerLevelRaw = String(first.playerLevel || firstJson.playerLevel || "").toUpperCase();
  const playerLevel =
    coachLevel === "GRASSROOTS" ? "BEGINNER" : playerLevelRaw || null;
  return {
    title: `Series: ${first.title}`,
    ageGroup: first.ageGroup,
    gameModelId: first.gameModelId,
    coachLevel,
    playerLevel,
    phase: first.phase || null,
    zone: first.zone || null,
    durationMin: first.durationMin,
    series: sessions.map((s) => {
      const json = s.json || {};
      return {
        title: s.title,
        sessionSummary: json.summary || null,
        drills: Array.isArray(json.drills)
          ? json.drills.map((d: any) => ({
              title: d.title,
              drillType: d.drillType,
              focus: d.focus || d.coachingFocus || d.objective,
            }))
          : [],
      };
    }),
  };
}

async function generateSkillFocus(context: SkillFocusContext) {
  // Set metrics context for tracking
  setMetricsContext({
    operationType: "skill_focus",
    ageGroup: context.ageGroup,
    gameModelId: context.gameModelId,
    phase: context.phase || undefined,
  });
  
  try {
    const prompt = buildSkillFocusPrompt(context);
    const raw = await generateText(prompt, { timeout: 45000, retries: 0 });
    const parsed = parseJsonSafe(raw);
    if (!parsed) {
      throw new Error("LLM returned non-JSON coaching emphasis");
    }
    return parsed;
  } finally {
    clearMetricsContext();
  }
}

export async function generateSkillFocusForSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    throw new Error("Session not found");
  }

  const context = buildSessionContext(session);
  const focus = await generateSkillFocus(context);

  const created = await prisma.skillFocus.create({
    data: {
      sessionId,
      title: focus.title || "Coaching Emphasis",
      summary: focus.summary || null,
      keySkills: focus.keySkills || [],
      coachingPoints: focus.coachingPoints || [],
      psychologyGood: focus.psychology?.good || [],
      psychologyBad: focus.psychology?.bad || [],
      sectionPhrases: focus.sectionPhrases || null,
    },
  });

  // Persist coaching emphasis into the session JSON for easy retrieval
  const sessionJson = (session.json as any) || {};
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      json: {
        ...sessionJson,
        skillFocus: {
          id: created.id,
          title: created.title,
          summary: created.summary,
          keySkills: created.keySkills,
          coachingPoints: created.coachingPoints,
          psychology: {
            good: created.psychologyGood || [],
            bad: created.psychologyBad || [],
          },
          sectionPhrases: created.sectionPhrases || null,
          createdAt: created.createdAt,
        },
      },
    },
  });

  return { focus: created };
}

export async function generateSkillFocusForSeries(input: { seriesId?: string; sessionIds?: string[] }) {
  const { seriesId, sessionIds } = input;
  let sessions: any[] = [];
  let resolvedSeriesId = seriesId || null;

  if (sessionIds && sessionIds.length > 0) {
    sessions = await prisma.session.findMany({
      where: { id: { in: sessionIds } },
      orderBy: { createdAt: "asc" },
    });
  } else if (seriesId) {
    sessions = await prisma.session.findMany({
      where: { seriesId },
      orderBy: { seriesNumber: "asc" },
    });
  }

  if (sessions.length === 0) {
    throw new Error("No sessions found for series");
  }

  if (!resolvedSeriesId) {
    const seriesIds = Array.from(new Set(sessions.map((s) => s.seriesId).filter(Boolean)));
    if (seriesIds.length === 1) {
      resolvedSeriesId = seriesIds[0];
    }
  }

  const context = buildSeriesContext(sessions);
  const focus = await generateSkillFocus(context);

  const created = await prisma.skillFocus.create({
    data: {
      seriesId: resolvedSeriesId,
      sessionIds: sessions.map((s) => s.id),
      title: focus.title || "Series Coaching Emphasis",
      summary: focus.summary || null,
      keySkills: focus.keySkills || [],
      coachingPoints: focus.coachingPoints || [],
      psychologyGood: focus.psychology?.good || [],
      psychologyBad: focus.psychology?.bad || [],
      sectionPhrases: focus.sectionPhrases || null,
    },
  });

  return { focus: created };
}

export async function getSkillFocusForSession(sessionId: string) {
  return prisma.skillFocus.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSkillFocusForSeries(seriesId: string) {
  return prisma.skillFocus.findFirst({
    where: { seriesId },
    orderBy: { createdAt: "desc" },
  });
}

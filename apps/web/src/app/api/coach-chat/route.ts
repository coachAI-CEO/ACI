import { NextRequest, NextResponse } from "next/server";

const CHAT_TIMEOUT = 60000; // 1 minute
const API_BASE =
  process.env.API_URL && !process.env.API_URL.includes("localhost")
    ? process.env.API_URL
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ClubPhilosophy = {
  attackingOrganization?: string | null;
  defensiveTransition?: string | null;
  defensiveOrganization?: string | null;
  attackingTransition?: string | null;
};

type ClubChatScope = {
  enforcedGameModelId: string | null;
  clubName: string | null;
  philosophy: ClubPhilosophy | null;
};

const GAME_MODEL_LABELS: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING: "Pressing",
  TRANSITION: "Transition",
  COACHAI: "Balanced (CoachAI)",
  ROCKLIN_FC: "Rocklin FC",
};

function philosophyHasContent(philosophy?: ClubPhilosophy | null): boolean {
  if (!philosophy) return false;
  return Boolean(
    philosophy.attackingOrganization ||
      philosophy.defensiveTransition ||
      philosophy.defensiveOrganization ||
      philosophy.attackingTransition
  );
}

function buildSystemPrompt(scope: ClubChatScope): string {
  const lockedModel = scope.enforcedGameModelId;
  const modelLabel = lockedModel
    ? GAME_MODEL_LABELS[lockedModel] || lockedModel
    : null;

  const gameModelSection = lockedModel
    ? [
        "**REQUIRED - Always ask if missing:**",
        "- ageGroup: U8, U9, U10, U11, U12, U13, U14, U15, U16, U17, U18",
        "",
        `**LOCKED GAME MODEL (MANDATORY):** gameModelId must ALWAYS be "${lockedModel}" (${modelLabel}).`,
        "- Do NOT ask which style/game model they want.",
        "- Do NOT suggest POSSESSION / PRESSING / TRANSITION / COACHAI / ROCKLIN_FC alternatives.",
        "- Do NOT change gameModelId even if the coach mentions another style.",
        "- Frame every idea, search, and generate recommendation inside this locked model.",
        `- extractedParams.gameModelId must always be "${lockedModel}".`,
        `- needsClarification must NEVER include "gameModelId".`,
      ].join("\n")
    : [
        "**REQUIRED - Always ask if missing:**",
        "- ageGroup: U8, U9, U10, U11, U12, U13, U14, U15, U16, U17, U18",
        "- gameModelId: What style of play?",
        "  - POSSESSION: Build-up play, keeping the ball, patient attacking",
        "  - PRESSING: High press, counter-pressing, winning ball back quickly",
        "  - TRANSITION: Quick switches between attack/defense, counter-attacks",
        "  - ROCKLIN_FC: Vertical possession, final-third intensity, immediate counterpress then compact recovery",
        "  - COACHAI: General/mixed approach",
      ].join("\n");

  const dnaLines: string[] = [];
  if (lockedModel && philosophyHasContent(scope.philosophy)) {
    dnaLines.push(
      "",
      `## CLUB DNA (${scope.clubName || "Club"} — MANDATORY IDEAS)`,
      "Use this club philosophy as the source of coaching ideas. Stay inside these four stages.",
      "When suggesting session focus, topics, coaching points, or vault matches, align to this DNA."
    );
    if (scope.philosophy?.attackingOrganization) {
      dnaLines.push(
        "",
        "Stage 1 — Attacking Organization (in possession):",
        scope.philosophy.attackingOrganization
      );
    }
    if (scope.philosophy?.defensiveTransition) {
      dnaLines.push(
        "",
        "Stage 2 — Defensive Transition (on ball loss):",
        scope.philosophy.defensiveTransition
      );
    }
    if (scope.philosophy?.defensiveOrganization) {
      dnaLines.push(
        "",
        "Stage 3 — Defensive Organization (out of possession):",
        scope.philosophy.defensiveOrganization
      );
    }
    if (scope.philosophy?.attackingTransition) {
      dnaLines.push(
        "",
        "Stage 4 — Attacking Transition (on ball regain):",
        scope.philosophy.attackingTransition
      );
    }
  }

  return `You are an expert soccer/football coaching assistant. Your job is to understand what the coach needs and help them find or create training sessions.

## YOUR ROLE
You help coaches by:
1. Understanding their training needs (even when described as problems)
2. Asking smart follow-up questions to gather missing information
3. Searching their vault for existing sessions that match
4. Helping them generate new sessions with the right parameters

## SESSION PARAMETERS TO EXTRACT
These are the parameters needed to generate a good session. Ask about important missing ones:

${gameModelSection}

**IMPORTANT - Ask if relevant:**
- phase: ATTACKING (scoring goals), DEFENDING (stopping goals), TRANSITION (switching phases)
- zone: Where on the pitch?
  - DEFENSIVE_THIRD: Own goal area, building from back
  - MIDDLE_THIRD: Midfield, central play
  - ATTACKING_THIRD: Final third, creating chances
- topic: Specific focus (e.g., "breaking low block", "switching play", "pressing triggers")
- numberOfSessions: 1 for single session, 2-5 for progressive series

**HELPFUL CONTEXT - Ask when relevant:**
- coachLevel: What's your coaching background?
  - USSF_D: D License, foundational tactics
  - USSF_C: C License, intermediate tactics
  - USSF_B_PLUS: B+ (or higher) license, advanced/high-level tactics
- playerLevel: BEGINNER, INTERMEDIATE, ADVANCED
- durationMin: 60, 75, or 90 minutes
- numbersMin/numbersMax: How many players will be at training?
- goalsAvailable: How many goals do you have? (0, 1, 2, 4 typical)
- hasGKs: Do you have goalkeepers? (true/false)
- formationAttacking: What formation do you play? e.g., "4-3-3", "4-4-2", "3-5-2", "3-2-3" (for smaller formats)
- formationDefending: Defensive shape if different
- spaceConstraint: FULL (full pitch), HALF, QUARTER
${dnaLines.join("\n")}

## CONVERSATION GUIDELINES
1. **Be conversational** - Don't interrogate. Weave questions naturally.
2. **Infer when possible** - "My U12s struggle with keeping possession" → ageGroup=U12${
    lockedModel
      ? `; keep gameModelId=${lockedModel} and translate the problem into a topic/phase inside that model`
      : ", gameModelId=POSSESSION"
  }
3. **Ask the most important missing info first** - Age group${
    lockedModel ? " is most critical (game model is already locked)" : " and game model are most critical"
  }
4. **Translate problems to training needs** inside the active game model:
   - Ball-loss / security problems → Attacking Organization + Defensive Transition cues
   - Can't create vs low block → Attacking Organization / Attacking Transition in attacking third
   - Slow recoveries → Defensive Transition
   - Played through centrally → Defensive Organization / pressing triggers

## RESPONSE FORMAT
Respond ONLY with valid JSON:
{
  "intent": "search" | "generate" | "clarify" | "chat",
  "message": "Your friendly conversational response",
  "extractedParams": {
    "ageGroup": "U14" | null,
    "gameModelId": ${lockedModel ? `"${lockedModel}"` : `"POSSESSION" | null`},
    "phase": "ATTACKING" | null,
    "zone": "MIDDLE_THIRD" | null,
    "topic": "specific focus" | null,
    "numberOfSessions": 1,
    "playerLevel": "INTERMEDIATE" | null,
    "coachLevel": "USSF_D" | "USSF_C" | "USSF_B_PLUS" | null,
    "durationMin": 90 | null,
    "numbersMin": 16 | null,
    "numbersMax": 20 | null,
    "formationAttacking": "4-3-3" | null,
    "formationDefending": "4-4-2" | null,
    "goalsAvailable": 2 | null,
    "hasGKs": true | null,
    "spaceConstraint": "FULL" | null
  },
  "searchQuery": "semantic search query for vault",
  "needsClarification": ["ageGroup"] | null,
  "readyToGenerate": false
}

Set "readyToGenerate": true only when you have at least: ageGroup, gameModelId, and either phase or topic.
Set "intent": "clarify" when you need more info.
Set "intent": "search" when you have enough to look in the vault.
Set "intent": "generate" when coach confirms they want a new session.`;
}

function hasMinimumGenerationParams(params: any): boolean {
  if (!params || typeof params !== "object") return false;
  const hasAgeGroup = Boolean(params.ageGroup);
  const hasGameModel = Boolean(params.gameModelId);
  const hasPhaseOrTopic = Boolean(params.phase || params.topic);
  return hasAgeGroup && hasGameModel && hasPhaseOrTopic;
}

async function loadClubChatScope(authHeader: string | null): Promise<ClubChatScope> {
  const empty: ClubChatScope = {
    enforcedGameModelId: null,
    clubName: null,
    philosophy: null,
  };
  if (!authHeader) return empty;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return empty;
    const data = await res.json().catch(() => ({}));
    const user = data?.user || {};
    return {
      enforcedGameModelId: String(user.enforcedGameModelId || "").trim() || null,
      clubName: String(user.clubName || "").trim() || null,
      philosophy: user.clubPhilosophy || null,
    };
  } catch {
    return empty;
  }
}

function forceScopedParams(params: any, scope: ClubChatScope): any {
  const next = { ...(params || {}) };
  if (scope.enforcedGameModelId) {
    next.gameModelId = scope.enforcedGameModelId;
  }
  return next;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [] } = body;

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const authHeader =
      request.headers.get("authorization") || request.headers.get("Authorization");
    const scope = await loadClubChatScope(authHeader);
    const systemPrompt = buildSystemPrompt(scope);

    // Build conversation context
    const conversationHistory = history
      .slice(-6)
      .map((m: any) => `${m.role === "user" ? "Coach" : "Assistant"}: ${m.content}`)
      .join("\n");

    const prompt = `${systemPrompt}

Previous conversation:
${conversationHistory || "(New conversation)"}

Coach's latest message: "${message}"

Analyze this request and respond in the JSON format specified above.`;

    const baseHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (authHeader) {
      baseHeaders.Authorization = authHeader;
    }

    // Call the backend AI endpoint
    const aiResponse = await fetch(`${API_BASE}/ai/chat`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT),
    }).catch(async () => {
      return null;
    });

    let parsed: any = null;

    if (aiResponse && aiResponse.ok) {
      const aiData = await aiResponse.json();
      try {
        const jsonMatch = aiData.text?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // AI didn't return valid JSON, use fallback
      }
    }

    // If AI call failed or didn't return valid JSON, use a simple fallback
    if (!parsed) {
      parsed = {
        intent: "search",
        message: "Let me search for sessions that might help with that...",
        extractedParams: extractBasicParams(message, scope.enforcedGameModelId),
        searchQuery: message,
      };
    }

    parsed.extractedParams = forceScopedParams(parsed.extractedParams, scope);
    if (Array.isArray(parsed.needsClarification) && scope.enforcedGameModelId) {
      parsed.needsClarification = parsed.needsClarification.filter(
        (item: string) => item !== "gameModelId"
      );
      if (parsed.needsClarification.length === 0) parsed.needsClarification = null;
    }

    // If intent is search or generate, search the vault
    let recommendations: any[] = [];
    if (parsed.intent === "search" || parsed.intent === "generate") {
      try {
        const vaultRes = await fetch(`${API_BASE}/vault/sessions/search`, {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify({
            query: parsed.searchQuery || message,
            params: parsed.extractedParams,
            limit: 5,
          }),
        });

        if (vaultRes.ok) {
          const vaultData = await vaultRes.json();
          recommendations = vaultData.results || [];
        }
      } catch {
        // Vault search failed, continue without recommendations
      }
    }

    // Build response
    let responseMessage = parsed.message;

    if (recommendations.length > 0) {
      responseMessage += `\n\nI found ${recommendations.length} session${recommendations.length > 1 ? "s" : ""} in your vault that might help:`;
    } else if (parsed.intent === "search" && parsed.readyToGenerate) {
      responseMessage += "\n\nI didn't find exact matches in your vault. Would you like me to generate a new session?";
    }

    const formatGameModel = (value: string) => GAME_MODEL_LABELS[value] || value;

    const formatPhase = (value: string) => {
      const labels: Record<string, string> = {
        ATTACKING: "Attacking",
        DEFENDING: "Defending",
        TRANSITION: "Transition",
        TRANSITION_TO_ATTACK: "Transition to Attack",
        TRANSITION_TO_DEFEND: "Transition to Defend",
      };
      return labels[value] || value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const formatZone = (value: string) => {
      const labels: Record<string, string> = {
        DEFENSIVE_THIRD: "Defensive Third",
        MIDDLE_THIRD: "Middle Third",
        ATTACKING_THIRD: "Attacking Third",
      };
      return labels[value] || value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const formatCoachLevel = (value: string) => {
      const labels: Record<string, string> = {
        USSF_D: "USSF D",
        USSF_C: "USSF C",
        USSF_B_PLUS: "USSF B+",
      };
      return labels[value] || value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
    };

    if (parsed.extractedParams && (parsed.intent === "search" || parsed.intent === "generate" || parsed.readyToGenerate)) {
      const params = parsed.extractedParams;
      const paramSummary = [];
      if (params.ageGroup) paramSummary.push(`• Age Group: ${params.ageGroup}`);
      if (params.gameModelId) {
        paramSummary.push(
          `• Style: ${formatGameModel(params.gameModelId)}${
            scope.enforcedGameModelId ? " (club locked)" : ""
          }`
        );
      }
      if (params.phase) paramSummary.push(`• Phase: ${formatPhase(params.phase)}`);
      if (params.zone) paramSummary.push(`• Zone: ${formatZone(params.zone)}`);
      if (params.topic) paramSummary.push(`• Topic: ${params.topic}`);
      if (params.numberOfSessions && params.numberOfSessions > 1) {
        paramSummary.push(`• Sessions: ${params.numberOfSessions} (series)`);
      }
      if (params.durationMin) paramSummary.push(`• Duration: ${params.durationMin} min`);
      if (params.numbersMin && params.numbersMax) {
        paramSummary.push(`• Players: ${params.numbersMin}-${params.numbersMax}`);
      }
      if (params.formationAttacking) {
        paramSummary.push(
          `• Formation: ${params.formationAttacking}${
            params.formationDefending && params.formationDefending !== params.formationAttacking
              ? ` / ${params.formationDefending}`
              : ""
          }`
        );
      }
      if (params.coachLevel) paramSummary.push(`• Coach Level: ${formatCoachLevel(params.coachLevel)}`);
      if (params.goalsAvailable !== null && params.goalsAvailable !== undefined) {
        paramSummary.push(`• Goals: ${params.goalsAvailable}`);
      }
      if (params.hasGKs !== null && params.hasGKs !== undefined) {
        paramSummary.push(`• GKs: ${params.hasGKs ? "Yes" : "No"}`);
      }

      if (paramSummary.length > 0) {
        responseMessage += `\n\n**Session Parameters:**\n${paramSummary.join("\n")}`;
      }
    }

    const readyToGenerate =
      Boolean(parsed.readyToGenerate) || hasMinimumGenerationParams(parsed.extractedParams);

    return NextResponse.json({
      ok: true,
      message: responseMessage,
      intent: parsed.intent,
      extractedParams: parsed.extractedParams,
      recommendations,
      needsClarification: parsed.needsClarification,
      readyToGenerate,
      enforcedGameModelId: scope.enforcedGameModelId,
      clubName: scope.clubName,
    });
  } catch (e: any) {
    console.error("[COACH_CHAT] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

function extractBasicParams(message: string, enforcedGameModelId?: string | null): any {
  const lower = message.toLowerCase();
  const params: any = {
    numberOfSessions: 1,
  };

  const ageMatch =
    lower.match(/u-?(\d{1,2})s?(?:\s|$|,)/i) ||
    lower.match(/under[- ]?(\d{1,2})/i) ||
    lower.match(/(\d{1,2})\s*year/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1]);
    if (age >= 6 && age <= 19) {
      params.ageGroup = `U${age}`;
    }
  }

  if (enforcedGameModelId) {
    params.gameModelId = enforcedGameModelId;
  } else if (
    lower.includes("possession") ||
    lower.includes("keep the ball") ||
    lower.includes("build up") ||
    lower.includes("build-up") ||
    lower.includes("lose the ball") ||
    lower.includes("can't keep")
  ) {
    params.gameModelId = "POSSESSION";
  } else if (
    lower.includes("press") ||
    lower.includes("high press") ||
    lower.includes("win the ball") ||
    lower.includes("recover")
  ) {
    params.gameModelId = "PRESSING";
  } else if (
    lower.includes("transition") ||
    lower.includes("counter") ||
    lower.includes("quick attack") ||
    lower.includes("fast break")
  ) {
    params.gameModelId = "TRANSITION";
  } else if (lower.includes("rocklin")) {
    params.gameModelId = "ROCKLIN_FC";
  }

  if (
    lower.includes("attack") ||
    lower.includes("offensive") ||
    lower.includes("score") ||
    lower.includes("create chance") ||
    lower.includes("final third") ||
    lower.includes("breaking")
  ) {
    params.phase = "ATTACKING";
  } else if (
    lower.includes("defend") ||
    lower.includes("defensive") ||
    lower.includes("stop") ||
    lower.includes("prevent")
  ) {
    params.phase = "DEFENDING";
  } else if (lower.includes("transition")) {
    params.phase = "TRANSITION";
  }

  if (
    lower.includes("defensive third") ||
    lower.includes("own third") ||
    lower.includes("back line") ||
    lower.includes("from the back")
  ) {
    params.zone = "DEFENSIVE_THIRD";
  } else if (
    lower.includes("middle third") ||
    lower.includes("midfield") ||
    lower.includes("central")
  ) {
    params.zone = "MIDDLE_THIRD";
  } else if (
    lower.includes("attacking third") ||
    lower.includes("final third") ||
    lower.includes("box") ||
    lower.includes("penalty area")
  ) {
    params.zone = "ATTACKING_THIRD";
  }

  const durationMatch = lower.match(/(\d+)\s*(?:min|minute)/i);
  if (durationMatch) {
    const dur = parseInt(durationMatch[1]);
    if ([60, 75, 90].includes(dur)) {
      params.durationMin = dur;
    }
  }

  const playerMatch = lower.match(/(\d+)\s*(?:player|kid|athlete)/i);
  if (playerMatch) {
    const count = parseInt(playerMatch[1]);
    if (count >= 8 && count <= 30) {
      params.numbersMin = Math.max(8, count - 2);
      params.numbersMax = count + 2;
    }
  }

  const formationMatch = lower.match(/(\d-\d-\d(?:-\d)?)/);
  if (formationMatch) {
    params.formationAttacking = formationMatch[1];
    params.formationDefending = formationMatch[1];
  }

  if (lower.includes("series") || lower.includes("progressive") || lower.includes("week")) {
    const seriesMatch = lower.match(/(\d)\s*(?:session|day|week)/i);
    if (seriesMatch) {
      const n = parseInt(seriesMatch[1]);
      if (n >= 2 && n <= 5) params.numberOfSessions = n;
    } else {
      params.numberOfSessions = 3;
    }
  }

  if (lower.includes("beginner") || lower.includes("novice")) {
    params.playerLevel = "BEGINNER";
  } else if (lower.includes("advanced") || lower.includes("elite")) {
    params.playerLevel = "ADVANCED";
  } else if (lower.includes("intermediate")) {
    params.playerLevel = "INTERMEDIATE";
  }

  if (lower.includes("d license") || lower.includes("ussf d") || lower.includes("grassroots")) {
    params.coachLevel = "USSF_D";
  } else if (lower.includes("c license") || lower.includes("ussf c")) {
    params.coachLevel = "USSF_C";
  } else if (
    lower.includes("b license") ||
    lower.includes("ussf b") ||
    lower.includes("a license")
  ) {
    params.coachLevel = "USSF_B_PLUS";
  }

  return params;
}

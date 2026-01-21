import { NextRequest, NextResponse } from "next/server";

const CHAT_TIMEOUT = 60000; // 1 minute

// System prompt for the AI to understand coaching requests
const SYSTEM_PROMPT = `You are an expert soccer/football coaching assistant. Your job is to understand what the coach needs and help them find or create training sessions.

## YOUR ROLE
You help coaches by:
1. Understanding their training needs (even when described as problems)
2. Asking smart follow-up questions to gather missing information
3. Searching their vault for existing sessions that match
4. Helping them generate new sessions with the right parameters

## SESSION PARAMETERS TO EXTRACT
These are the parameters needed to generate a good session. Ask about important missing ones:

**REQUIRED - Always ask if missing:**
- ageGroup: U8, U9, U10, U11, U12, U13, U14, U15, U16, U17, U18 (IMPORTANT: different ages need different complexity)
- gameModelId: What style of play?
  - POSSESSION: Build-up play, keeping the ball, patient attacking
  - PRESSING: High press, counter-pressing, winning ball back quickly  
  - TRANSITION: Quick switches between attack/defense, counter-attacks
  - COACHAI: General/mixed approach

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
  - GRASSROOTS: New/parent coach, basic drills
  - USSF_D: D License, foundational knowledge
  - USSF_C: C License, intermediate tactics
  - USSF_B: B License, advanced methodology
  - USSF_B_PLUS: B+ License, high-level tactics
  - USSF_A: A License, professional level
- playerLevel: BEGINNER, INTERMEDIATE, ADVANCED
- durationMin: 60, 75, or 90 minutes
- numbersMin/numbersMax: How many players will be at training?
- goalsAvailable: How many goals do you have? (0, 1, 2, 4 typical)
- hasGKs: Do you have goalkeepers? (true/false)
- formationAttacking: What formation do you play? e.g., "4-3-3", "4-4-2", "3-5-2", "3-2-3" (for smaller formats)
- formationDefending: Defensive shape if different
- spaceConstraint: FULL (full pitch), HALF, QUARTER

## CONVERSATION GUIDELINES
1. **Be conversational** - Don't interrogate. Weave questions naturally.
2. **Infer when possible** - "My U12s struggle with keeping possession" → ageGroup=U12, gameModelId=POSSESSION
3. **Ask the most important missing info first** - Age group and game model are most critical
4. **Translate problems to training needs**:
   - "We lose the ball too easily" → Possession training
   - "We can't score against packed defenses" → Attacking third, breaking low blocks
   - "We're slow getting back" → Transition defending
   - "Opposition always plays through us" → Pressing, defensive shape

## RESPONSE FORMAT
Respond ONLY with valid JSON:
{
  "intent": "search" | "generate" | "clarify" | "chat",
  "message": "Your friendly conversational response",
  "extractedParams": {
    "ageGroup": "U14" | null,
    "gameModelId": "POSSESSION" | null,
    "phase": "ATTACKING" | null,
    "zone": "MIDDLE_THIRD" | null,
    "topic": "specific focus" | null,
    "numberOfSessions": 1,
    "playerLevel": "INTERMEDIATE" | null,
    "coachLevel": "USSF_D" | null,
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
  "needsClarification": ["ageGroup", "gameModelId"] | null,
  "readyToGenerate": false
}

Set "readyToGenerate": true only when you have at least: ageGroup, gameModelId, and either phase or topic.
Set "intent": "clarify" when you need more info.
Set "intent": "search" when you have enough to look in the vault.
Set "intent": "generate" when coach confirms they want a new session.`;

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

    // Build conversation context
    const conversationHistory = history
      .slice(-6)
      .map((m: any) => `${m.role === "user" ? "Coach" : "Assistant"}: ${m.content}`)
      .join("\n");

    const prompt = `${SYSTEM_PROMPT}

Previous conversation:
${conversationHistory || "(New conversation)"}

Coach's latest message: "${message}"

Analyze this request and respond in the JSON format specified above.`;

    // Call the backend AI endpoint
    const aiResponse = await fetch("http://localhost:4000/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT),
    }).catch(async () => {
      // Fallback: call Gemini directly through our generate endpoint
      return null;
    });

    let parsed: any = null;

    if (aiResponse && aiResponse.ok) {
      const aiData = await aiResponse.json();
      try {
        // Try to parse the AI response as JSON
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
        extractedParams: extractBasicParams(message),
        searchQuery: message,
      };
    }

    // If intent is search or generate, search the vault
    let recommendations: any[] = [];
    if (parsed.intent === "search" || parsed.intent === "generate") {
      try {
        const vaultRes = await fetch("http://localhost:4000/vault/sessions/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    
    // Helper functions to format enum values
    const formatGameModel = (value: string) => {
      const labels: Record<string, string> = {
        POSSESSION: "Possession",
        PRESSING: "Pressing",
        TRANSITION: "Transition",
        COACHAI: "Balanced",
      };
      return labels[value] || value;
    };

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
        GRASSROOTS: "Grassroots",
        USSF_C: "USSF C",
        USSF_B_PLUS: "USSF B+",
        USSF_D: "USSF D",
      };
      return labels[value] || value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
    };

    // Show extracted parameters if we have some
    if (parsed.extractedParams && (parsed.intent === "search" || parsed.intent === "generate" || parsed.readyToGenerate)) {
      const params = parsed.extractedParams;
      const paramSummary = [];
      if (params.ageGroup) paramSummary.push(`• Age Group: ${params.ageGroup}`);
      if (params.gameModelId) paramSummary.push(`• Style: ${formatGameModel(params.gameModelId)}`);
      if (params.phase) paramSummary.push(`• Phase: ${formatPhase(params.phase)}`);
      if (params.zone) paramSummary.push(`• Zone: ${formatZone(params.zone)}`);
      if (params.topic) paramSummary.push(`• Topic: ${params.topic}`);
      if (params.numberOfSessions && params.numberOfSessions > 1) paramSummary.push(`• Sessions: ${params.numberOfSessions} (series)`);
      if (params.durationMin) paramSummary.push(`• Duration: ${params.durationMin} min`);
      if (params.numbersMin && params.numbersMax) paramSummary.push(`• Players: ${params.numbersMin}-${params.numbersMax}`);
      if (params.formationAttacking) paramSummary.push(`• Formation: ${params.formationAttacking}${params.formationDefending && params.formationDefending !== params.formationAttacking ? ` / ${params.formationDefending}` : ""}`);
      if (params.coachLevel) paramSummary.push(`• Coach Level: ${formatCoachLevel(params.coachLevel)}`);
      if (params.goalsAvailable !== null && params.goalsAvailable !== undefined) paramSummary.push(`• Goals: ${params.goalsAvailable}`);
      if (params.hasGKs !== null && params.hasGKs !== undefined) paramSummary.push(`• GKs: ${params.hasGKs ? "Yes" : "No"}`);
      
      if (paramSummary.length > 0) {
        responseMessage += `\n\n**Session Parameters:**\n${paramSummary.join("\n")}`;
      }
    }

    return NextResponse.json({
      ok: true,
      message: responseMessage,
      intent: parsed.intent,
      extractedParams: parsed.extractedParams,
      recommendations,
      needsClarification: parsed.needsClarification,
      readyToGenerate: parsed.readyToGenerate || false,
    });
  } catch (e: any) {
    console.error("[COACH_CHAT] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

// Simple parameter extraction fallback
function extractBasicParams(message: string): any {
  const lower = message.toLowerCase();
  const params: any = {
    numberOfSessions: 1,
  };

  // Age groups - multiple patterns
  const ageMatch = lower.match(/u-?(\d{1,2})s?(?:\s|$|,)/i) || 
                   lower.match(/under[- ]?(\d{1,2})/i) ||
                   lower.match(/(\d{1,2})\s*year/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1]);
    if (age >= 6 && age <= 19) {
      params.ageGroup = `U${age}`;
    }
  }

  // Game models - with problem-to-solution mapping
  if (lower.includes("possession") || lower.includes("keep the ball") || 
      lower.includes("build up") || lower.includes("build-up") ||
      lower.includes("lose the ball") || lower.includes("can't keep")) {
    params.gameModelId = "POSSESSION";
  } else if (lower.includes("press") || lower.includes("high press") ||
             lower.includes("win the ball") || lower.includes("recover")) {
    params.gameModelId = "PRESSING";
  } else if (lower.includes("transition") || lower.includes("counter") ||
             lower.includes("quick attack") || lower.includes("fast break")) {
    params.gameModelId = "TRANSITION";
  }

  // Phases
  if (lower.includes("attack") || lower.includes("offensive") || 
      lower.includes("score") || lower.includes("create chance") ||
      lower.includes("final third") || lower.includes("breaking")) {
    params.phase = "ATTACKING";
  } else if (lower.includes("defend") || lower.includes("defensive") ||
             lower.includes("stop") || lower.includes("prevent")) {
    params.phase = "DEFENDING";
  } else if (lower.includes("transition")) {
    params.phase = "TRANSITION";
  }

  // Zones
  if (lower.includes("defensive third") || lower.includes("own third") ||
      lower.includes("back line") || lower.includes("from the back")) {
    params.zone = "DEFENSIVE_THIRD";
  } else if (lower.includes("middle third") || lower.includes("midfield") ||
             lower.includes("central")) {
    params.zone = "MIDDLE_THIRD";
  } else if (lower.includes("attacking third") || lower.includes("final third") ||
             lower.includes("box") || lower.includes("penalty area")) {
    params.zone = "ATTACKING_THIRD";
  }

  // Duration
  const durationMatch = lower.match(/(\d+)\s*(?:min|minute)/i);
  if (durationMatch) {
    const dur = parseInt(durationMatch[1]);
    if ([60, 75, 90].includes(dur)) {
      params.durationMin = dur;
    }
  }

  // Player count
  const playerMatch = lower.match(/(\d+)\s*(?:player|kid|athlete)/i);
  if (playerMatch) {
    const count = parseInt(playerMatch[1]);
    if (count >= 8 && count <= 30) {
      params.numbersMin = Math.max(8, count - 2);
      params.numbersMax = count + 2;
    }
  }

  // Formation
  const formationMatch = lower.match(/(\d-\d-\d(?:-\d)?)/);
  if (formationMatch) {
    params.formationAttacking = formationMatch[1];
  }
  
  // Common formations by name
  if (lower.includes("4-3-3") || lower.includes("433")) params.formationAttacking = "4-3-3";
  else if (lower.includes("4-4-2") || lower.includes("442")) params.formationAttacking = "4-4-2";
  else if (lower.includes("4-2-3-1") || lower.includes("4231")) params.formationAttacking = "4-2-3-1";
  else if (lower.includes("3-5-2") || lower.includes("352")) params.formationAttacking = "3-5-2";
  else if (lower.includes("3-4-3") || lower.includes("343")) params.formationAttacking = "3-4-3";
  // 9v9 formations
  else if (lower.includes("3-2-3") || lower.includes("323")) params.formationAttacking = "3-2-3";
  else if (lower.includes("2-3-2-1")) params.formationAttacking = "2-3-2-1";
  // 7v7 formations
  else if (lower.includes("2-3-1") || lower.includes("231")) params.formationAttacking = "2-3-1";
  else if (lower.includes("3-2-1") || lower.includes("321")) params.formationAttacking = "3-2-1";

  // Goals available
  const goalsMatch = lower.match(/(\d+)\s*(?:goal|net)/i);
  if (goalsMatch) {
    params.goalsAvailable = parseInt(goalsMatch[1]);
  } else if (lower.includes("no goals") || lower.includes("no nets") || lower.includes("without goals")) {
    params.goalsAvailable = 0;
  } else if (lower.includes("full size goal") || lower.includes("big goal")) {
    params.goalsAvailable = 2;
  } else if (lower.includes("mini goal") || lower.includes("small goal") || lower.includes("pug")) {
    params.goalsAvailable = 4;
  }

  // GKs
  if (lower.includes("goalkeeper") || lower.includes("gk") || lower.includes("keeper")) {
    params.hasGKs = true;
  } else if (lower.includes("no goalkeeper") || lower.includes("no gk") || lower.includes("without keeper")) {
    params.hasGKs = false;
  }

  // Coach level
  if (lower.includes("grassroot") || lower.includes("parent coach") || lower.includes("volunteer")) {
    params.coachLevel = "GRASSROOTS";
  } else if (lower.includes("d license") || lower.includes("d-license")) {
    params.coachLevel = "USSF_D";
  } else if (lower.includes("c license") || lower.includes("c-license")) {
    params.coachLevel = "USSF_C";
  } else if (lower.includes("b+ license") || lower.includes("b plus")) {
    params.coachLevel = "USSF_B_PLUS";
  } else if (lower.includes("b license") || lower.includes("b-license")) {
    params.coachLevel = "USSF_B";
  } else if (lower.includes("a license") || lower.includes("a-license") || lower.includes("professional")) {
    params.coachLevel = "USSF_A";
  }

  // Series
  const seriesMatch = lower.match(/(\d+)\s*session/i);
  if (seriesMatch && parseInt(seriesMatch[1]) > 1) {
    params.numberOfSessions = Math.min(5, parseInt(seriesMatch[1]));
  } else if (lower.includes("series") || lower.includes("progressive") || lower.includes("multiple")) {
    params.numberOfSessions = 3;
  }

  // Player level inference
  if (lower.includes("beginner") || lower.includes("new to") || lower.includes("just started")) {
    params.playerLevel = "BEGINNER";
  } else if (lower.includes("advanced") || lower.includes("competitive") || lower.includes("travel team")) {
    params.playerLevel = "ADVANCED";
  } else if (lower.includes("intermediate") || lower.includes("rec")) {
    params.playerLevel = "INTERMEDIATE";
  }

  // Extract topic - look for specific coaching concepts
  const topicPatterns = [
    /(?:work on|train|practice|improve|focus on|session (?:on|for|about))\s+([^,.]+)/i,
    /(?:struggling with|problem with|issues? with|trouble with)\s+([^,.]+)/i,
    /(?:need help with|want to work on)\s+([^,.]+)/i,
  ];
  
  for (const pattern of topicPatterns) {
    const match = message.match(pattern);
    if (match) {
      params.topic = match[1].trim();
      break;
    }
  }

  return params;
}

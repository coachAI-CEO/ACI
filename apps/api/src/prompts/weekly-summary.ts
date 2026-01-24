import { WeeklySummary, WeeklySummaryEvent } from "../services/weekly-summary";

export interface WeeklySummaryPromptInput {
  summary: WeeklySummary;
  coachName?: string;
  teamName?: string;
  sessionsWithDetails?: Array<{
    event: WeeklySummaryEvent;
    sessionJson: any;
    sessionMeta: {
      title: string;
      ageGroup: string;
      gameModelId: string;
      durationMin: number | null;
    };
  }>;
}

/**
 * Build a prompt for generating a parent-friendly weekly training summary
 */
export function buildWeeklySummaryPrompt(input: WeeklySummaryPromptInput): string {
  const { summary, coachName, teamName, sessionsWithDetails } = input;
  const { weekStart, weekEnd, events, totalSessions, totalMinutes, ageGroups, gameModels } = summary;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Build session details for the prompt with drill information
  const sessionDetails = events.map((event) => {
    const session = event.session;
    const sessionDetail = sessionsWithDetails?.find((s) => s.event.id === event.id);
    const sessionJson = sessionDetail?.sessionJson;
    
    // Extract drill information from session JSON
    const drills = sessionJson?.drills || [];
    const drillSummaries = Array.isArray(drills) ? drills.map((drill: any) => ({
      title: drill.title || "Untitled Drill",
      type: drill.drillType || "Technical",
      focus: drill.focus || drill.coachingFocus || drill.objective || "General skills",
      description: drill.description || "",
    })) : [];

    return {
      date: formatDate(event.scheduledDate),
      time: formatTime(event.scheduledDate),
      title: session?.title || "Untitled Session",
      ageGroup: session?.ageGroup || "Unknown",
      gameModel: session?.gameModelId || "Unknown",
      duration: event.durationMin || session?.durationMin || 60,
      location: event.location,
      teamName: event.teamName,
      notes: event.notes,
      drills: drillSummaries,
      sessionSummary: sessionJson?.summary || sessionJson?.sessionSummary || "",
    };
  });

  const gameModelLabels: Record<string, string> = {
    POSSESSION: "Possession",
    PRESSING: "Pressing",
    TRANSITION: "Transition",
    COACHAI: "Balanced",
  };

  const ageGroupDescription = ageGroups.length > 0 
    ? ageGroups.join(" and ")
    : "the team";

  const focusAreas = gameModels.length > 0
    ? gameModels.map((gm) => gameModelLabels[gm] || gm).join(", ")
    : "various tactical concepts";

  return [
    "SYSTEM: You are a youth soccer coach creating a weekly training summary for parents.",
    "Your goal is to help parents understand what their children are learning and what to look for during training sessions.",
    "",
    "CRITICAL REQUIREMENTS:",
    "1. Write in a warm, encouraging, and parent-friendly tone",
    "2. Be age-appropriate for the age groups listed",
    "3. Explain what parents should look for when watching training (specific behaviors, skills, improvements)",
    "4. Describe what the team is working on in simple, understandable terms",
    "5. Link your explanations directly to the scheduled sessions",
    "6. Use positive, growth-mindset language",
    "7. Keep technical jargon to a minimum, but explain key concepts when needed",
    "8. Make it clear how parents can support their child's development at home",
    "",
    `WEEK INFORMATION:`,
    `Week: ${formatDate(weekStart)} - ${formatDate(weekEnd)}`,
    `Total Sessions: ${totalSessions}`,
    `Total Training Time: ${Math.round(totalMinutes / 60)} hours ${totalMinutes % 60} minutes`,
    `Age Groups: ${ageGroups.join(", ") || "Various"}`,
    `Focus Areas: ${focusAreas}`,
    teamName ? `Team: ${teamName}` : "",
    coachName ? `Coach: ${coachName}` : "",
    "",
    "SCHEDULED SESSIONS:",
    JSON.stringify(sessionDetails, null, 2),
    "",
    "INSTRUCTIONS:",
    "Generate a comprehensive weekly summary that includes:",
    "",
    "1. INTRODUCTION (2-3 sentences):",
    "   - Welcome parents to the week",
    "   - Highlight the overall focus for the week",
    "   - Set a positive, encouraging tone",
    "",
    "2. WHAT WE'RE WORKING ON (3-4 paragraphs):",
    "   - Explain the tactical concepts being developed",
    "   - Describe the skills and techniques being practiced",
    "   - Connect these to the age group's developmental stage",
    "   - Use age-appropriate language and examples",
    "",
    "3. WHAT TO LOOK FOR (2-3 paragraphs):",
    "   - Specific behaviors parents should observe during training",
    "   - Key moments that indicate learning and improvement",
    "   - Positive signs of development to celebrate",
    "   - How to recognize when their child is applying new concepts",
    "",
    "4. SESSION-BY-SESSION BREAKDOWN:",
    "   - For each scheduled session, provide:",
    "     * Date and time",
    "     * What will be covered in that session",
    "     * What parents should watch for",
    "     * How it connects to the week's overall goals",
    "",
    "5. HOW PARENTS CAN HELP (1-2 paragraphs):",
    "   - Simple activities or questions parents can use at home",
    "   - Ways to reinforce learning outside of training",
    "   - Encouragement strategies",
    "",
    "6. CLOSING (1-2 sentences):",
    "   - Positive reinforcement",
    "   - Looking forward to the week",
    "",
    "IMPORTANT:",
    "- Write in plain language that non-coaches can understand",
    "- Be specific about what to look for (e.g., 'Watch for your child making quick decisions with the ball' not just 'decision-making')",
    "- Connect everything back to the actual scheduled sessions",
    "- Keep the tone warm, supportive, and encouraging",
    "- Age-appropriate examples and expectations are critical",
    "",
    "Return ONLY the summary text. Do NOT include markdown formatting, headers, or code blocks.",
    "Write as if you are the coach speaking directly to parents.",
  ].filter(Boolean).join("\n");
}

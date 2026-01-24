/**
 * Prompt builder for adapting team drills into solo player exercises
 */

export interface PlayerPlanAdaptationInput {
  originalDrill: any;
  ageGroup: string;
  playerLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  focus?: string; // Optional focus area (e.g., "First Touch", "Finishing", "Fitness")
}

/**
 * Build AI prompt to adapt a team drill into a solo player exercise
 */
export function buildPlayerPlanAdaptationPrompt(
  input: PlayerPlanAdaptationInput
): string {
  const { originalDrill, ageGroup, playerLevel, focus } = input;
  
  const levelGuidance = getPlayerLevelGuidance(playerLevel);
  const drillTypeGuidance = getDrillTypeGuidance(originalDrill.drillType, playerLevel);
  const focusGuidance = focus ? getFocusGuidance(focus) : "";
  
  const originalDrillJson = JSON.stringify(originalDrill, null, 2);
  
  return [
    "SYSTEM: Convert this team training drill into a SOLO player exercise that can be done alone.",
    "",
    "CRITICAL CONSTRAINTS:",
    "- 1 player only (no teammates, no opponents)",
    "- Minimal equipment: ball, cones, wall (if available), small space",
    "- No contact or physical opposition",
    "- Clear, numbered step-by-step instructions",
    "- Include rep counts, time durations, or distance markers",
    "- Self-coaching cues (what to focus on)",
    "",
    `PLAYER LEVEL: ${playerLevel || "INTERMEDIATE"}`,
    levelGuidance,
    "",
    drillTypeGuidance,
    "",
    focusGuidance ? `FOCUS AREA: ${focus}\n${focusGuidance}\n` : "",
    "ORIGINAL DRILL:",
    originalDrillJson,
    "",
    "OUTPUT FORMAT (JSON object):",
    JSON.stringify({
      drillType: originalDrill.drillType || "TECHNICAL",
      title: "Solo Exercise Title",
      durationMin: 10, // Adjusted for solo work (typically shorter)
      description: "Brief description of what the player will work on",
      organization: {
        setupSteps: [
          "Step 1: Clear instruction",
          "Step 2: Clear instruction",
          // 3-5 steps total
        ],
        area: {
          lengthYards: 10,
          widthYards: 10,
          notes: "Small space suitable for solo work"
        },
        equipment: ["ball", "cones"], // Minimal equipment list
        reps: "3 sets of 10 reps", // Or time-based: "5 minutes continuous"
        rest: "30 seconds between sets",
      },
      coachingPoints: [
        "Self-coaching point 1",
        "Self-coaching point 2",
        // 2-4 points
      ],
      progressions: [
        "Progression 1: How to make it harder",
        "Progression 2: Advanced variation",
        // 1-3 progressions based on playerLevel
      ],
    }, null, 2),
    "",
    "REQUIREMENTS:",
    "- Title should clearly indicate it's a solo exercise",
    "- SetupSteps must be simple and achievable alone",
    "- Include specific rep counts or time durations",
    "- CoachingPoints should be self-coaching friendly (what to watch for)",
    "- Progressions should be appropriate for the player level",
    "- Maintain the technical/tactical intent of the original drill",
    "- Do NOT include diagrams (solo exercises don't need complex diagrams)",
    "",
    "Do NOT wrap JSON in markdown. Output ONLY the JSON object.",
  ].join("\n");
}

function getPlayerLevelGuidance(playerLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null): string {
  switch (playerLevel) {
    case "BEGINNER":
      return [
        "BEGINNER LEVEL ADAPTATION:",
        "- Simple movements and basic techniques",
        "- 1-2 progressions maximum",
        "- Longer rest periods (45-60 seconds)",
        "- Lower rep counts (5-10 reps per set)",
        "- Focus on technique over speed",
        "- Clear, simple instructions",
      ].join("\n");
    
    case "INTERMEDIATE":
      return [
        "INTERMEDIATE LEVEL ADAPTATION:",
        "- Moderate complexity, combination skills",
        "- 2-3 progressions",
        "- Moderate rest periods (30-45 seconds)",
        "- Moderate rep counts (10-15 reps per set)",
        "- Balance technique and intensity",
      ].join("\n");
    
    case "ADVANCED":
      return [
        "ADVANCED LEVEL ADAPTATION:",
        "- Complex patterns and advanced techniques",
        "- Multiple progressions (3-4)",
        "- Shorter rest periods (20-30 seconds)",
        "- Higher rep counts (15-20+ reps per set)",
        "- Higher intensity, time pressure variations",
        "- Advanced technical combinations",
      ].join("\n");
    
    default:
      return "INTERMEDIATE LEVEL (default): Moderate complexity, 2-3 progressions";
  }
}

function getDrillTypeGuidance(drillType: string | undefined, playerLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null): string {
  const baseGuidance: Record<string, string> = {
    WARMUP: [
      "WARMUP → Solo Activation:",
      "- Dynamic movements with ball",
      "- Light jogging and ball touches",
      "- Simple coordination exercises",
      playerLevel === "BEGINNER" ? "- 10-15 minutes, low intensity" :
      playerLevel === "ADVANCED" ? "- 5-10 minutes, higher intensity" :
      "- 10 minutes, moderate intensity",
    ].join("\n"),
    
    TECHNICAL: [
      "TECHNICAL → Solo Skill Work:",
      "- Wall passes, cone dribbling, solo finishing",
      "- First touch exercises with wall or rebounder",
      "- Ball control and manipulation",
      playerLevel === "BEGINNER" ? "- Basic technique focus, simple patterns" :
      playerLevel === "ADVANCED" ? "- Advanced techniques, complex patterns" :
      "- Combination skills, moderate complexity",
    ].join("\n"),
    
    TACTICAL: [
      "TACTICAL → Solo Pattern Practice:",
      "- Shadow play (imagining game situations)",
      "- Visualization exercises",
      "- Cone patterns for movement sequences",
      playerLevel === "BEGINNER" ? "- Simple patterns, basic decision-making cues" :
      playerLevel === "ADVANCED" ? "- Complex tactical scenarios, advanced decision-making" :
      "- Moderate tactical complexity, combination patterns",
    ].join("\n"),
    
    CONDITIONED_GAME: [
      "CONDITIONED_GAME → Solo Challenge Games:",
      "- 'Beat the wall' games",
      "- Target practice (cones, goals, markers)",
      "- Time-based challenges",
      playerLevel === "BEGINNER" ? "- Simple scoring games, basic targets" :
      playerLevel === "ADVANCED" ? "- Complex challenges, multiple targets, high intensity" :
      "- Moderate challenge, combination targets",
    ].join("\n"),
    
    COOLDOWN: [
      "COOLDOWN → Solo Recovery:",
      "- Static stretching",
      "- Light jogging",
      "- Reflection and mental recovery",
      "- Same across all levels (5 minutes)",
    ].join("\n"),
  };
  
  return baseGuidance[drillType || "TECHNICAL"] || baseGuidance.TECHNICAL;
}

function getFocusGuidance(focus: string): string {
  const focusMap: Record<string, string> = {
    "First Touch": "Emphasize first touch quality, receiving under control, turning with first touch",
    "Finishing": "Focus on shooting accuracy, finishing technique, goal-scoring scenarios",
    "Fitness": "Increase intensity, add conditioning elements, longer durations",
    "All": "Maintain balanced focus across all aspects of the original drill",
  };
  
  return focusMap[focus] || `Focus on: ${focus}`;
}

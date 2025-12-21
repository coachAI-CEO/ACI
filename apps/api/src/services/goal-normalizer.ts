/**
 * Goal normalization module
 * Provides a single function to normalize goal-related fields deterministically
 */

export type GoalMode = "MINI2" | "LARGE" | null;

interface NormalizeGoalsInput {
  goalsAvailable?: number | null;
  rawGoalMode?: string | null;
  json?: any;
}

interface NormalizeGoalsOutput {
  goalMode: GoalMode;
  goalsAvailable: number;
  goalsSupported: number[];
}

/**
 * Normalize goal mode and availability
 * 
 * Policy:
 * - goalsAvailable === 0 → goalMode = null
 * - goalsAvailable === 1 → goalMode = "LARGE" (one full-size goal + GK)
 * - goalsAvailable >= 2 → goalMode = "MINI2" (two mini goals)
 * - goalsSupported reflects adaptability (what goal configs this drill can support)
 */
export function normalizeGoalFields(input: NormalizeGoalsInput): NormalizeGoalsOutput {
  const goalsAvailable = typeof input.goalsAvailable === "number" 
    ? input.goalsAvailable 
    : 0;

  let goalMode: GoalMode = null;
  let goalsSupported: number[] = [];

  if (goalsAvailable === 0) {
    goalMode = null;
    goalsSupported = [0];
  } else if (goalsAvailable === 1) {
    goalMode = "LARGE";
    goalsSupported = [1];
  } else if (goalsAvailable >= 2) {
    goalMode = "MINI2";
    goalsSupported = [2];
  }

  // Check if drill JSON indicates flexibility (has both mini and large goal equipment)
  // This would allow goalsSupported to include multiple values
  if (input.json?.equipment) {
    const eq = Array.isArray(input.json.equipment) ? input.json.equipment : [];
    const hasMini = eq.some((e: string) => /mini[\-\s]?goal/i.test(String(e)));
    const hasLarge = eq.some((e: string) => /(full[\-\s]?size|large)[\s]?goal/i.test(String(e)));
    
    if (hasMini && hasLarge && !goalsSupported.includes(1) && !goalsSupported.includes(2)) {
      // Drill could support both configurations
      goalsSupported = [1, 2];
    }
  }

  return {
    goalMode,
    goalsAvailable,
    goalsSupported,
  };
}
